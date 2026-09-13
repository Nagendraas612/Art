# Art & Handmade Marketplace — System Architecture

**Step 1 deliverable** — architecture + database schema, per the build brief.
Companion file: `schema.prisma` (full Prisma schema implementing the model below).

---

## 1. Guiding Constraints (from the brief)

- Modular monolith, not microservices, until real scale forces extraction.
- Multi-creator from day one: every sellable thing has an owner (`creatorId`), every order line records which creator it belongs to.
- 0% commission at launch, but the money model must already separate order amount / commission / gateway fee / tax / payout so a future commission rollout is a config change, not a schema migration.
- Payment correctness is server-side only. Never trust a client-reported "payment succeeded."
- Unique physical artwork (stock = 1) must never be sold twice — needs a real concurrency-safe reservation mechanism.
- Flexible per-craft attributes (medium, yarn color, framing…) live in JSONB; anything that needs indexing, uniqueness, joins, or transactions lives in relational columns.

---

## 2. High-Level Architecture

```
                            ┌─────────────────────────────┐
                            │        Next.js App          │
                            │  (App Router, single repo)  │
                            │                              │
   Browser  ───HTTPS───▶    │  ┌────────────┐  ┌────────┐ │
   (Customer/Creator/Admin) │  │  UI Layer  │  │ Server │ │
                            │  │ RSC/Client │◀▶│ Actions│ │
                            │  │ Components │  │ /Route │ │
                            │  └────────────┘  │Handlers│ │
                            │                   └───┬────┘ │
                            │                       │      │
                            │            ┌──────────▼───┐  │
                            │            │ Domain Modules│ │
                            │            │ (auth, orders,│ │
                            │            │  payments...) │ │
                            │            └──────┬────────┘ │
                            │                   │          │
                            │            ┌──────▼───────┐  │
                            │            │ Prisma Client │  │
                            └────────────┴──────┬────────┴──┘
                                                 │
                                     ┌───────────▼────────────┐
                                     │   PostgreSQL (Neon/     │
                                     │   Supabase, managed)    │
                                     └─────────────────────────┘

        External integrations (all called from domain modules, never from UI):
        ┌───────────┐ ┌───────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
        │ Cashfree  │ │ Cloudinary /  │ │ Resend  │ │ PostHog  │ │ Sentry   │
        │ (payments)│ │ Cloudflare R2 │ │ (email) │ │(analytics│ │(errors)  │
        └───────────┘ └───────────────┘ └─────────┘ └──────────┘ └──────────┘
```

Single deployable unit on Vercel. Internally partitioned into modules so any one of them (e.g. `payments`, `search`) can be lifted into its own service later without touching the others, because they only talk to each other through typed module APIs, never by reaching into each other's Prisma models directly.

---

## 3. Module Boundaries

Each folder under `src/modules/<name>` owns its own Prisma models, server actions, validation schemas, and emits/consumes domain events. Cross-module calls go through an exported service interface, not raw Prisma queries.

| Module | Owns | Depends on |
|---|---|---|
| `auth` | User, Session, Role | — |
| `users` | CustomerProfile, Address | auth |
| `creators` | CreatorProfile, storefront settings | auth |
| `artworks` | Artwork, ArtworkImage, ArtworkEdition, Certificate | creators, categories |
| `categories` | ArtworkCategory, ArtworkTag, ArtworkCollection | — |
| `search` | Postgres full-text search over artworks | artworks |
| `wishlist` | Wishlist, WishlistItem | users, artworks |
| `cart` | Cart, CartItem | users, artworks |
| `inventory` | stock reservation state machine | artworks |
| `orders` | Order, OrderItem | cart, inventory, creators |
| `payments` | Payment, PaymentTransaction, Refund | orders, Cashfree SDK |
| `shipments` | Shipment, ShipmentTracking | orders |
| `reviews` | Review, ArtistReview | orders, artworks |
| `follows` | Follow | users, creators |
| `messages` | Conversation, Message, MessageAttachment | users, creators |
| `customRequests` | CustomRequest | creators, orders |
| `earnings` | CreatorEarning, PlatformCommission, Payout | orders, payments |
| `notifications` | Notification | all modules (consumer only) |
| `admin` | moderation queues, AuditLog, Dispute, Report | all modules (read + action) |
| `analytics` | PostHog event dispatch | all modules (consumer only) |

Rule of thumb: if a feature needs to read another module's data, it calls that module's exported query function. It does not import that module's Prisma model directly. This is what keeps the "modular" in "modular monolith" real instead of aspirational.

---

## 4. Authentication & Authorization

**Library:** Better Auth (session-based, server-side, HttpOnly cookies), with Google OAuth and email/password providers, email verification required before checkout or publishing.

**Roles:** `CUSTOMER`, `CREATOR`, `ADMIN`, `SUPER_ADMIN` — stored on `User.role`, plus a `CreatorProfile.status` (`PENDING`, `APPROVED`, `SUSPENDED`, `REJECTED`) since "is a creator" and "is an approved, active creator" are different things.

A single `User` can hold `CUSTOMER` and `CREATOR` capability at once (a creator can also buy). Model this as `User` + optional `CreatorProfile` (1:0..1), not a separate table per role.

**Authorization pattern:**
- Every server action / route handler re-checks the session server-side; never trust a role claim from the client.
- Ownership checks are explicit and centralized, e.g. `assertOwnsArtwork(userId, artworkId)` used by every artwork-mutating action, `assertOwnsOrder`, `assertOwnsConversation`. These live in each module, not scattered inline, so the "creator can't touch another creator's data" rule in §32 of the brief has exactly one implementation to audit.
- Admin actions are additionally logged to `AuditLog` (actor, action, target, before/after diff where feasible).

---

## 5. Payment Architecture (Cashfree)

### 5.1 Principles
- Order creation, payment verification, and status transitions all happen server-side.
- Frontend payment "success" callbacks are treated as **hints to re-check**, never as truth.
- Webhooks are the source of truth for final payment state; signature verification is mandatory on every webhook.
- Every write to payment state is idempotent, keyed by Cashfree's order/payment IDs, so a retried webhook or duplicate client callback can't double-credit or double-fulfill.

### 5.2 Flow

```
1. Customer clicks "Pay"
   → Server Action: createOrder(cartId, addressId)
      - validates cart, re-prices server-side (never trust client price)
      - reserves inventory for unique/limited items (see §6)
      - creates Order (status = PENDING_PAYMENT) + OrderItems in a DB transaction
      - calls Cashfree "create order" API → gets cf_order_id, payment_session_id
      - stores PaymentTransaction (status = INITIATED, gateway_order_id)
      - returns payment_session_id to client

2. Client redirects into Cashfree checkout using payment_session_id.

3a. Cashfree webhook (server-to-server, source of truth)
      POST /api/webhooks/cashfree
      - verify signature (Cashfree webhook secret)
      - look up PaymentTransaction by gateway_order_id — idempotency check:
        if already in a terminal state, ack and return 200 without reprocessing
      - on SUCCESS: mark PaymentTransaction PAID, Order → PAYMENT_CONFIRMED → ORDER_CONFIRMED,
        commit reserved inventory → SOLD, create CreatorEarning rows, enqueue notifications
      - on FAILED: PaymentTransaction FAILED, Order → PAYMENT_FAILED, release inventory reservation
      - on webhook signature failure: reject with 400, log, never trust the payload

3b. Client return URL (UX only)
      - server re-fetches order status from DB (not from Cashfree directly, not from client)
        to render the confirmation screen — webhook may arrive slightly before or after
        the browser redirect, so the confirmation page polls/re-checks briefly if still PENDING.

4. Reconciliation job (scheduled)
      - periodically compares PaymentTransactions stuck in INITIATED/PENDING beyond a timeout
        against Cashfree's order-status API, to catch missed webhooks.
```

### 5.3 Field separation (never collapse these)

`Order`: `subtotal`, `shippingTotal`, `taxTotal`, `discountTotal`, `grandTotal`
`OrderItem`: `unitPrice`, `quantity`, `lineTotal`, `platformCommission`, `creatorAmount`
`PaymentTransaction`: `gatewayAmount`, `gatewayFee`, `gatewayOrderId`, `gatewayPaymentId`, `status`
`Refund`: `amount`, `gatewayRefundId`, `status`, `reason`
`Payout`: `creatorId`, `amount`, `status`, `settlementReference`, `periodStart`, `periodEnd`

All monetary columns are `Decimal` (Prisma `Decimal` / Postgres `numeric`), never `Float`.

### 5.4 Commission = 0% today, without a future migration

`PlatformCommission` is its own table keyed by a rule (global default, category override, or creator override) with an `effectiveFrom` date and a `percentage` (currently `0.00` for all creators). `OrderItem.platformCommission` is computed at order time from whatever rule applied then, and stored — so historical orders don't retroactively change if the rule changes later. Turning on commissions later is: insert new `PlatformCommission` rows; zero code/schema change.

---

## 6. Inventory & Concurrency (unique-artwork safety)

State machine per artwork (for `ORIGINAL` and `LIMITED_EDITION` types):

```
AVAILABLE ──(add to cart / begin checkout)──▶ RESERVED ──(payment success)──▶ SOLD
    ▲                                             │
    └─────────────(reservation expires/──────────┘
                    payment fails/cancelled)
```

Implementation:
- `Artwork.stock` (int) + a `StockReservation` table (`artworkId`, `orderId`, `quantity`, `expiresAt`, `status`).
- Reservation is created inside the same DB transaction as `Order`/`OrderItem` creation, using `SELECT ... FOR UPDATE` (or a conditional `UPDATE ... WHERE stock >= qty RETURNING`) so two simultaneous checkouts on a 1-of-1 piece can't both succeed — the second transaction sees `stock = 0` and fails cleanly with "just sold."
- Reservations carry a TTL (e.g. 15 minutes). An expiry sweep (cron or lazy check-on-read) releases stock back to `AVAILABLE` if payment never completes.
- `OPEN_EDITION` and `MADE_TO_ORDER` types skip hard reservation (no scarcity to protect) but still decrement/track counts for analytics.
- `CUSTOM` products don't touch this table at all — they're created as a one-off `Artwork` (or directly an `Order`) once the `CustomRequest` is accepted.

---

## 7. Image / File Storage Architecture

```
Creator uploads image
        │
        ▼
Next.js server action (validates: type, size, dimensions, magic-byte check — never trust extension)
        │
        ▼
Direct upload to Cloudinary (signed upload, server issues a short-lived signature — file bytes never
transit through our own server beyond the signature step, avoiding memory pressure on Vercel functions)
        │
        ▼
Cloudinary generates derivatives on the fly via URL transformations:
  - thumbnail, card, detail, zoom sizes
  - WebP/AVIF via f_auto, quality via q_auto
        │
        ▼
ArtworkImage row stores: publicId, originalUrl, altText, width, height, sortOrder, isWatermarked
        │
        ▼
Browser requests responsive srcset — Cloudinary/CDN edge serves optimized derivative
```

- Original high-resolution files are stored but not linked from any public page; public detail/zoom views use a capped-resolution + optional watermark derivative for `ORIGINAL` artwork type, per §33 of the brief.
- Digital-download artwork (`DIGITAL` type) uses a separate, access-controlled asset (signed, time-limited download URL issued only to the purchasing customer, with a download-count cap stored on `OrderItem` or a dedicated `DigitalAsset` access table).

---

## 8. Core Purchase Data Flow (end to end)

```
Browse/Search ─▶ Artwork Detail ─▶ Add to Cart ─▶ Checkout (address) ─▶
createOrder() [reserve stock, price server-side] ─▶ Cashfree session ─▶
Cashfree webhook confirms ─▶ Order CONFIRMED, CreatorEarning rows created,
notifications fired (customer: order confirmed; creator: new order) ─▶
Creator updates Shipment ─▶ ShipmentTracking events ─▶ Delivered ─▶
Review unlocked for that OrderItem
```

Every arrow above is a module boundary crossing through an exported function call (e.g. `orders.createOrder()`, `inventory.reserve()`, `payments.createCashfreeSession()`), not a shared transaction spanning unrelated modules' internals — except the single atomic DB transaction that must cover **order + order items + stock reservation together**, since that one has to be all-or-nothing.

---

## 9. Route Structure (high level)

```
/                              home
/explore                       discovery grid
/search                        search + filters
/artwork/[slug]                artwork detail
/creator/[handle]               = /@handle, storefront
/category/[slug]
/collection/[slug]

/account/*                     customer account (orders, wishlist, addresses, settings)
/checkout/*                    cart → address → payment → confirmation

/creator-dashboard/*           creator: products, orders, earnings, messages, storefront settings
/become-a-creator              creator onboarding/application

/admin/*                       admin dashboard, moderation, users, orders, categories

/api/webhooks/cashfree         payment webhook (route handler, not a page)
```

Route groups: `(public)`, `(customer)`, `(creator)`, `(admin)` in the App Router, each with its own layout enforcing the relevant auth/role check at the layout level as a first line of defense — in addition to, not instead of, per-action server-side checks.

---

## 10. Folder Structure

```
src/
  app/
    (public)/...
    (customer)/account/...
    (creator)/creator-dashboard/...
    (admin)/admin/...
    api/webhooks/cashfree/route.ts
  modules/
    auth/
    users/
    creators/
    artworks/
    categories/
    search/
    wishlist/
    cart/
    inventory/
    orders/
    payments/
    shipments/
    reviews/
    follows/
    messages/
    customRequests/
    earnings/
    notifications/
    admin/
    analytics/
    <each module>/
      actions.ts        (server actions)
      queries.ts         (read-only exported query fns for other modules)
      schemas.ts         (Zod)
      service.ts         (business logic, calls Prisma)
      types.ts
  components/
    ui/                  (shadcn primitives)
    gallery/              (artwork imagery, zoom, transitions)
    marketing/             (homepage editorial sections)
  lib/
    prisma.ts
    auth.ts
    cashfree.ts
    cloudinary.ts
    email.ts
prisma/
  schema.prisma
  migrations/
```

---

## 11. Scalability / Future Extraction Points

- `search` module is Postgres full-text (`tsvector` + GIN index) at launch; if/when it can't keep up, it's the one module designed to be swapped for OpenSearch without touching `artworks`' write path, since search only *reads* artwork data via its own indexed view.
- `payments` and `earnings` are natural first candidates for extraction into a separate service if transaction volume grows, since they already only communicate via typed calls and events, not shared transactions with unrelated modules.
- `notifications` is consumer-only and event-driven, so adding new event producers never requires touching it.

---

## 12. What This Doc Deliberately Leaves for Later Steps

- Full UI/component design system (Step 2)
- Detailed API contracts per module (fleshed out alongside each module's build step)
- Shipping-provider integration specifics (brief says don't hard-code a provider yet)
- Custom-request and messaging UX details (Phase 2 per the brief)

See `schema.prisma` for the concrete database implementation of everything above.
