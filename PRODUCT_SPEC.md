# Build Brief: Multi-Creator Art & Handmade Marketplace

## 1. PRODUCT VISION

Build a premium, modern, visually immersive online marketplace for independent artists and handmade creators.

The platform allows multiple creators to create their own storefront, showcase their work, accept customer orders, manage products, and eventually grow their creative business.

This is NOT a generic e-commerce website.

The website itself must feel like an art gallery.

The design should communicate:

* creativity
* craftsmanship
* personality
* warmth
* authenticity
* modernity
* premium quality
* human-made work

The target reaction from a visitor should be:

> "This feels like an art platform."

not:

> "This looks like another online shopping website."

The platform starts with only a few creators, potentially 2–5 initially, but the architecture must support hundreds or thousands of creators later.

---

# 2. REAL-WORLD SCENARIO

Imagine two creators joining the platform.

### Creator 1 — Priya

Priya creates:

* Mandala art
* Paintings
* Hand-painted wall art

She currently has no dedicated place to sell her work online.

She signs up on the platform.

She creates:

> Priya Art Studio

Her creator page becomes:

`platform.com/@priyaart`

She uploads:

> Mandala Dream
> ₹1,500
> Original
> 12 × 12 inch
> Acrylic on canvas

She adds photos, description, availability and shipping information.

The platform approves the artwork.

A customer discovers it while browsing the marketplace.

The customer:

1. opens the artwork
2. views the gallery
3. reads about the creator
4. adds it to wishlist
5. purchases it
6. completes payment
7. receives order confirmation
8. receives shipping updates
9. receives the artwork
10. leaves a review

Priya can see everything from her creator dashboard.

---

### Creator 2 — Asha

Asha makes:

* Crochet
* Handmade gifts
* Crochet bags
* Custom handmade items

Her storefront becomes:

`platform.com/@ashahandmade`

Unlike Priya, some of Asha's products are:

> Made to Order

and others are:

> Custom Orders

A customer can therefore request:

> "Can you make this crochet flower in lavender?"

Asha receives the request and can respond with:

* price
* estimated completion time
* details

The customer accepts and places the order.

The platform supports both normal products and custom creative work.

---

# 3. CORE PRODUCT CONCEPT

The platform consists of 3 major experiences.

## A. Customer Experience

Customers can:

* discover artwork
* browse creators
* search
* filter
* view artwork
* follow creators
* like artwork
* add to wishlist
* add to cart
* purchase
* track orders
* communicate with creators
* request custom work
* leave reviews

## B. Creator Experience

Creators can:

* register
* create a storefront
* build a profile
* upload artwork/products
* manage inventory
* receive orders
* manage shipping
* communicate with customers
* see sales
* see earnings
* handle custom requests

## C. Admin Experience

Admins can:

* approve creators
* moderate artwork
* manage users
* manage orders
* manage categories
* manage reviews
* handle complaints
* handle refunds
* feature creators
* feature artwork
* monitor platform activity

---

# 4. BUSINESS MODEL

For the initial launch:

## Creator commission = 0%

The goal is to attract creators and prove that the marketplace generates value before monetizing them.

Creators should not be charged a platform commission initially.

Example:

Artwork price:

₹2,000

Platform commission:

₹0

Creator share:

₹2,000

Payment provider fees, taxes or settlement costs should be handled separately according to the configured payment provider terms.

The architecture must still support future commission models without requiring a database redesign.

Future possibilities include:

* percentage commission
* creator subscription
* featured listings
* promoted products
* premium storefronts
* advertising
* optional platform services

Do NOT implement monetization aggressively in the MVP.

---

# 5. PAYMENT STRATEGY

Use Cashfree as the preferred payment provider.

The payment system must be designed for a multi-creator marketplace.

Potential future architecture:

Customer
→ Cashfree
→ Platform order
→ Creator settlement

Initially:

Platform commission = 0%

The system must distinguish:

* order amount
* platform commission
* payment gateway fee
* tax
* creator amount
* payout amount
* refund amount

Never assume these are the same field.

Payment confirmation must be performed server-side.

Do NOT trust only frontend payment success.

Implement proper:

* server-side order creation
* payment verification
* webhook handling
* webhook signature verification
* idempotency
* payment status handling
* failed payment handling
* refund handling
* reconciliation

Use the current Cashfree integration patterns rather than deprecated payment flows.

---

# 6. DESIGN PHILOSOPHY

This is one of the MOST IMPORTANT requirements.

The website must NOT look like:

* Shopify default
* Amazon
* generic Bootstrap store
* standard admin template
* grid of identical cards
* boring SaaS dashboard

It must feel like a:

> Digital Art Gallery + Modern Editorial Magazine + Creator Marketplace

The artwork should be the visual hero.

---

# 7. VISUAL LANGUAGE

Use:

* editorial layouts
* asymmetric grids
* large artwork
* strong typography
* whitespace
* layered compositions
* subtle textures
* gallery-style labels
* sophisticated transitions
* visual rhythm
* carefully controlled color

Use a neutral visual foundation, such as:

* warm paper/off-white
* charcoal/ink
* muted neutral tones

Allow artwork itself to provide most of the color.

Do not use excessive gradients or random rainbow colors.

Do not overuse glassmorphism.

Do not make every element rounded like a SaaS dashboard.

---

# 8. TYPOGRAPHY

Use a sophisticated font pairing.

Recommended direction:

* elegant serif for major editorial headings
* modern sans-serif for UI, navigation and commerce information

Typography must feel premium and artistic while maintaining readability.

Headings should have personality.

Buttons, prices and utility information should remain highly readable.

---

# 9. MOTION DESIGN

Motion is a core requirement.

The platform should feel alive.

Use animation for:

* page transitions
* artwork image reveals
* hover interactions
* scroll-triggered sections
* subtle parallax
* image zoom
* cursor interactions where appropriate
* modal transitions
* filters
* cart interactions
* wishlist interactions
* creator profile transitions
* artwork-to-detail transitions
* loading states

Motion must feel intentional.

Avoid:

* excessive bouncing
* constant movement
* distracting animations
* slow transitions that hurt usability

The design principle is:

> cinematic when discovering, calm when buying.

---

# 10. RECOMMENDED MOTION STACK

Primary animation:

* Motion / Framer Motion

Optional:

* Lenis for smooth scrolling
* GSAP for complex scroll storytelling
* React Three Fiber only where a real 3D experience adds value

Do NOT introduce heavy 3D everywhere.

Performance is more important than visual gimmicks.

---

# 11. HOMEPAGE EXPERIENCE

The homepage should immediately feel artistic.

## Hero

Full-screen or near-full-screen immersive opening.

Possible concept:

> MADE BY PEOPLE.
> MEANT TO BE KEPT.

Supporting text:

> Discover original art, handmade creations and unique pieces from independent creators.

Primary CTA:

> Explore Art

Secondary CTA:

> Become a Creator

Use floating / layered artwork rather than a standard hero banner.

Artwork can subtly move as the user scrolls.

---

## Featured Art

Display selected artwork using an editorial composition.

Do NOT use only identical 4-column product cards.

Mix:

* large feature
* medium works
* small supporting pieces

---

## Discover Creators

Introduce real artists.

Show:

* creator image
* creator name
* creative discipline
* selected artwork
* follow button

---

## Explore by category

Possible categories:

### Art

* Paintings
* Mandala
* Sketches
* Illustration
* Digital Art
* Photography

### Handmade

* Crochet
* Embroidery
* Knitting
* Resin
* Pottery
* Crafts

### Gifts & Custom

* Handmade gifts
* Personalized creations
* Custom artwork

---

## Explore by feeling

This can create a unique art-discovery experience.

Examples:

* Calm
* Bold
* Dreamy
* Playful
* Minimal
* Warm
* Experimental

This is optional for MVP but encouraged as a future differentiator.

---

## New Creations

Show recently published pieces.

---

## CTA for creators

End homepage with:

> Made something you're proud of?

> Turn your creativity into your own online store.

CTA:

> Become a Creator

---

# 12. CREATOR STOREFRONT

Every approved creator gets a unique storefront.

Example:

`platform.com/@priya`

Creator storefront should feel like a digital personal gallery.

Include:

* cover image
* creator profile image
* creator name
* creative disciplines
* biography
* social links
* follower count
* rating
* artwork
* collections
* custom order availability
* reviews

Example:

> Priya Art Studio

> Mandala Artist · Painter

> "Patterns inspired by nature, geometry and quiet moments."

Buttons:

* Follow
* Contact
* Request Custom

Do NOT make creator pages look like Amazon seller profiles.

---

# 13. ARTWORK / PRODUCT MODEL

The marketplace must support multiple types of creative products.

## Type 1 — Original

Example:

> Original Mandala Painting

Quantity may be:

1

When sold:

> Sold Out

## Type 2 — Limited Edition

Example:

> Limited Edition Print

Track:

* edition number
* total edition size
* remaining units

Example:

> 17 / 100

## Type 3 — Open Edition

Multiple quantities available.

## Type 4 — Made to Order

Creator produces the item after purchase.

## Type 5 — Custom

Customer requests a personalized piece.

## Type 6 — Digital Artwork

Potentially downloadable.

Requires:

* secure file access
* download limits
* licensing information

Do not assume all products have the same inventory behavior.

---

# 14. ARTWORK CREATION FORM

Creator should be able to upload a product with a simple workflow.

## Basic information

* title
* description
* category
* subcategory
* tags

## Creative details

* medium
* material
* style
* subject
* color
* creation year

## Physical details

* width
* height
* depth
* weight
* orientation
* framing
* signed status

## Commercial

* price
* product type
* quantity
* edition details
* availability

## Images

* main image
* gallery images
* close-up/detail images
* framed preview

## Shipping

* processing time
* package dimensions
* package weight
* shipping options
* shipping availability

## Authenticity

* signature
* certificate of authenticity
* provenance information

## Publishing flow

Draft
→ Submitted
→ Under Review
→ Approved
→ Published

Possible rejection state:

Rejected / Needs Changes

---

# 15. ARTWORK DISCOVERY

Build a beautiful discovery experience.

Search by:

* title
* creator
* category
* medium
* material
* style
* subject
* tags

Support filters:

* price
* category
* creator
* medium
* style
* size
* color
* original/print
* framed/unframed
* ready-to-ship
* made-to-order
* custom

Sorting:

* Recommended
* Newest
* Popular
* Price low to high
* Price high to low
* Most liked

Search architecture should initially use PostgreSQL search.

Do not introduce Elasticsearch/OpenSearch unnecessarily in the MVP.

---

# 16. ARTWORK DETAIL PAGE

This page should feel like an online gallery.

Large artwork imagery.

Features:

* multiple images
* zoom
* fullscreen
* image transitions
* close-up details
* framed previews

Information:

* artwork title
* creator
* price
* availability
* medium
* dimensions
* material
* creation year
* style
* subject
* framing
* signed status
* authenticity
* shipping
* processing time

Actions:

* Buy Now
* Add to Cart
* Add to Wishlist
* Share
* Contact Creator
* Request Custom / Similar Work

Display creator context prominently.

---

# 17. ARTIST AUTHENTICITY

For original art, support:

* creator identity
* artwork ID
* certificate number
* signature status
* creation year
* provenance
* certificate of authenticity

Future feature:

Generate a digital/PDF certificate.

---

# 18. SHOPPING CART

Cart must support products from multiple creators.

Example:

Customer adds:

* Priya's Mandala
* Asha's Crochet Bag

The cart contains both.

Backend must correctly associate each order item with its creator.

The system may later split fulfillment by creator.

Do NOT assume one cart = one creator.

---

# 19. UNIQUE ARTWORK INVENTORY

For original art:

If stock is 1, two customers must not successfully purchase it simultaneously.

Implement server-side inventory protection.

Possible approach:

* transactional stock update
* reservation state
* payment timeout handling
* idempotency

Example:

Available
→ Reserved
→ Paid
→ Sold

If payment fails/timeouts:

Reserved
→ Available

---

# 20. CHECKOUT FLOW

Customer flow:

Cart
→ Address
→ Shipping
→ Payment
→ Confirmation

Use a clean, distraction-free interface.

Do NOT use excessive animations on payment screens.

Checkout should feel trustworthy and fast.

---

# 21. ORDER STATUS

Use explicit states.

Example:

Pending Payment
→ Payment Confirmed
→ Order Confirmed
→ Preparing
→ Packed
→ Shipped
→ Out for Delivery
→ Delivered

Alternative:

Cancelled
Refund Requested
Refunded
Return Requested
Returned
Disputed

Display an order timeline to customers.

---

# 22. CREATOR DASHBOARD

Dashboard should be simple and useful.

Show:

* sales this month
* orders
* artwork count
* views
* followers
* revenue

Main sections:

* My Products
* Add Product
* Orders
* Messages
* Earnings
* Reviews
* Analytics
* Storefront
* Settings

Do not create a huge enterprise dashboard.

---

# 23. CUSTOMER ACCOUNT

Customer can manage:

* profile
* addresses
* orders
* wishlist
* followed creators
* reviews
* messages
* notifications
* settings

---

# 24. WISHLIST / LIKES

Customers can:

* like artwork
* add/remove from wishlist
* create collections later

Show subtle animation when liking an artwork.

Avoid unnecessary gamification.

---

# 25. FOLLOW CREATOR

Customer can follow creators.

Example:

Customer follows Priya.

Later Priya publishes a new artwork.

Customer can receive:

> Priya just added a new creation.

Support:

* follow
* unfollow
* follower count
* following feed
* notifications

---

# 26. REVIEWS

Reviews should be tied to completed purchases.

Customer flow:

Delivered
→ Review available

Review contains:

* rating
* text
* optional image
* verified purchase indicator

Only customers who actually purchased the item should receive a verified purchase badge.

Creator reviews and artwork reviews may be separated.

Admin can:

* approve
* hide
* remove
* flag

---

# 27. CUSTOM ORDER SYSTEM

This is an important future differentiator.

Customer selects:

> Request Custom Artwork

Form:

* description
* reference image
* preferred size
* preferred medium
* budget
* deadline

Creator receives request.

Creator can respond:

* accepted
* rejected
* proposed price
* estimated completion
* notes

Then:

Customer accepts
→ Order/payment
→ Creation
→ Completion
→ Shipping/delivery

Keep this modular so it can initially be simpler.

---

# 28. MESSAGING

Customer ↔ creator communication.

Support:

* text
* image attachments
* order reference

Security/moderation should prevent abuse.

Do not expose unnecessary personal contact information.

---

# 29. SHIPPING

Artwork and handmade products can have different packaging requirements.

Creator should provide:

* package dimensions
* package weight
* processing time
* fragile flag
* shipping regions
* local pickup option where applicable

Order should track:

* shipment ID
* carrier
* tracking number
* pickup
* shipping
* delivery
* failed delivery
* return shipping

Integrate a shipping provider later as needed.

Do not hard-code assumptions about shipping providers.

---

# 30. ADMIN DASHBOARD

Admin modules:

## Dashboard

Show:

* users
* creators
* artwork
* orders
* sales
* pending approvals
* disputes

## Creator Management

* pending creators
* approved creators
* rejected creators
* verification
* suspension

## Artwork Moderation

* pending artwork
* approve
* reject
* request changes
* hide
* remove

## Orders

* view
* search
* filter
* inspect status
* refunds
* complaints

## Reviews

* moderation
* flagged reviews

## Categories

Admin can manage category structure.

## Featured content

Admin can select:

* featured artwork
* featured creators
* homepage collections

---

# 31. AUTHENTICATION

Support:

* email/password
* Google login
* email verification
* password reset
* optional phone verification

Use secure server-side sessions.

Do not implement authentication manually from scratch if a mature library is available.

Recommended direction:

* Better Auth or Auth.js

Use role-based access control.

Roles:

CUSTOMER
CREATOR
ADMIN
SUPER_ADMIN

Every protected action must be authorized server-side.

---

# 32. SECURITY

Security is a first-class requirement.

Implement:

* secure password hashing
* secure sessions
* HttpOnly cookies where appropriate
* role-based access control
* server-side authorization
* input validation
* Zod schemas
* rate limiting
* request size limits
* secure file uploads
* image validation
* webhook verification
* payment verification
* audit logs
* HTTPS
* secure headers
* appropriate CORS rules
* protection against common injection attacks
* protection against unauthorized object access

Creators must never be able to access another creator's:

* products
* orders
* earnings
* customer information

Customers must never be able to access another customer's private information.

---

# 33. FILE / IMAGE STORAGE

Artwork images are one of the most important technical considerations.

Do NOT store large image files directly in PostgreSQL.

Use:

* Cloudinary

OR:

* Cloudflare R2 + CDN

The architecture should support:

Original
→ processing
→ optimized derivatives
→ CDN
→ browser

Generate multiple image sizes.

Use:

* WebP
* AVIF where appropriate
* responsive image sizes
* lazy loading
* compression

Consider watermarked public previews for premium/original works.

Original high-resolution files should not be publicly exposed unnecessarily.

---

# 34. DATABASE

Use:

## PostgreSQL

with:

## Prisma

Use relational tables for business-critical entities.

Use JSONB for flexible artwork specifications.

Example:

Artwork

* id
* creatorId
* title
* description
* price
* categoryId
* productType
* stock
* status
* specifications JSONB
* createdAt
* updatedAt

Flexible specifications can contain:

For painting:

```json
{
  "medium": "Acrylic",
  "surface": "Canvas",
  "framed": true,
  "dimensions": "12 x 12 inch"
}
```

For crochet:

```json
{
  "material": "Cotton Yarn",
  "color": "Lavender",
  "dimensions": "20 x 15 cm",
  "handmade": true
}
```

Use proper relational tables for anything that needs strong querying, indexing, relationships, uniqueness or transactional consistency.

---

# 35. CORE DATABASE ENTITIES

Design the schema around entities such as:

User
Role
CustomerProfile
CreatorProfile
Address

Artwork
ArtworkImage
ArtworkCategory
ArtworkTag
ArtworkCollection
ArtworkEdition
Certificate

Cart
CartItem
Wishlist
WishlistItem

Order
OrderItem
Payment
PaymentTransaction
Refund

Shipment
ShipmentTracking

Review
ArtistReview

Follow
Conversation
Message
MessageAttachment

CustomRequest

CreatorEarning
PlatformCommission
Payout

Notification

Coupon
Promotion

Dispute
Report
AuditLog

The schema must be normalized where appropriate.

---

# 36. MULTI-CREATOR DATA MODEL

Every sellable product must have an owner:

Artwork
→ creatorId

Every order item must identify the creator:

OrderItem
→ artworkId
→ creatorId

This enables future:

* creator-specific fulfillment
* creator earnings
* creator payouts
* creator analytics
* split payments
* refunds
* commissions

Do not build the system around a single-store assumption.

---

# 37. FINANCIAL DATA MODEL

Track money explicitly.

Example:

Order:

* subtotal
* shipping
* tax
* discount
* total

OrderItem:

* unit price
* quantity
* creator amount
* platform commission

Payment:

* gateway
* transaction ID
* payment status
* gateway fee
* timestamps

Payout:

* creator
* amount
* status
* settlement reference

Use decimal-safe monetary handling.

Never use floating point numbers for financial calculations.

---

# 38. API / BACKEND MODULES

Design modular backend domains.

Suggested modules:

auth
users
creators
artworks
categories
collections
wishlist
cart
orders
payments
refunds
shipments
reviews
follows
messages
customRequests
earnings
payouts
notifications
admin
analytics

Keep these modules separated logically even if everything lives inside a single Next.js application.

---

# 39. RECOMMENDED ARCHITECTURE STYLE

Do NOT start with microservices.

Use a:

> Modular Monolith

Architecture:

Frontend
→ Next.js
→ application/business logic
→ PostgreSQL

External integrations:

* Cashfree
* image storage
* email
* shipping
* analytics

Extract services only when real scale requires it.

---

# 40. TECHNOLOGY STACK

## Frontend

Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
Motion

Optional:

Lenis
GSAP
React Three Fiber

## Backend

Next.js server
Server Actions
Route Handlers / APIs
Zod

## Database

PostgreSQL
Prisma

## Authentication

Better Auth or Auth.js
Google OAuth
Email verification

## Storage

Cloudinary
or
Cloudflare R2

## Payments

Cashfree

## Email

Resend

## Analytics

PostHog

## Error monitoring

Sentry

## Hosting

Vercel

## Database hosting

Neon / Supabase / managed PostgreSQL

## CDN/security

Cloudflare where useful

## Version control

GitHub

## CI/CD

GitHub Actions + Vercel

---

# 41. SEO

Because artwork pages should be discoverable through search engines, every public artwork and creator page should support:

* SEO title
* meta description
* canonical URL
* Open Graph
* social preview
* structured data where appropriate
* sitemap
* robots.txt
* semantic HTML
* image alt text

URL examples:

`/artwork/mandala-dream`

`/creator/priya`

or:

`/@priya`

Public artwork pages should be indexable unless intentionally hidden.

---

# 42. PERFORMANCE

Artwork websites can become extremely heavy.

Optimize aggressively.

Use:

* responsive images
* image CDN
* lazy loading
* compression
* caching
* pagination
* database indexes
* server rendering where appropriate
* streaming where beneficial
* code splitting
* minimized JavaScript
* efficient animations

Do not sacrifice performance for visual effects.

Target a fast, smooth experience on mobile as well as desktop.

---

# 43. RESPONSIVE DESIGN

Desktop and mobile are equally important.

Mobile should support:

* simplified navigation
* bottom navigation where appropriate
* swipeable artwork gallery
* sticky Buy button
* mobile filters
* fast checkout
* creator management essentials

Animations must respect:

`prefers-reduced-motion`

and should degrade gracefully on slower devices.

---

# 44. ACCESSIBILITY

Support:

* semantic HTML
* keyboard navigation
* sufficient contrast
* alt text
* focus states
* accessible forms
* accessible modals
* screen reader support
* reduced motion preferences

Do not prioritize visual effects over accessibility.

---

# 45. ANALYTICS

Track meaningful product events.

Examples:

* creator_registered
* creator_approved
* artwork_created
* artwork_published
* artwork_viewed
* artwork_liked
* creator_followed
* added_to_cart
* checkout_started
* payment_started
* payment_completed
* order_created
* order_delivered
* review_created
* custom_request_created

Use PostHog or equivalent.

---

# 46. NOTIFICATIONS

Support in-app and email notifications.

Examples:

Creator:

* account approved
* artwork approved
* artwork rejected
* new order
* payment received
* customer message
* review received
* payout update

Customer:

* order confirmed
* payment successful
* order shipped
* order delivered
* creator followed
* new artwork from followed creator
* custom request update

---

# 47. MVP SCOPE

Do NOT attempt to build every advanced feature immediately.

## MUST HAVE

### Customer

* registration/login
* home
* artwork discovery
* search
* filters
* artwork detail
* creator profiles
* wishlist
* cart
* checkout
* Cashfree payment
* orders
* order status
* reviews

### Creator

* registration
* creator profile
* storefront
* artwork upload
* edit/delete artwork
* inventory
* artwork approval
* order management
* earnings overview

### Admin

* dashboard
* creator approval
* artwork moderation
* user management
* order management
* review moderation
* categories

### Core infrastructure

* PostgreSQL
* authentication
* image storage
* payment integration
* email
* security
* monitoring

---

# 48. PHASE 2

After MVP:

* follow creators
* messaging
* custom orders
* collections
* advanced creator analytics
* limited editions
* certificates
* automated shipping
* personalized recommendations
* AI search
* AI-generated tags
* AI-assisted product descriptions
* promotional tools

---

# 49. PHASE 3

Potential future capabilities:

* immersive virtual galleries
* AR room preview
* live auctions
* creator memberships
* gift cards
* creator subscriptions
* international sales
* multi-currency
* multilingual support
* advanced personalization
* sophisticated provenance tracking

Do not implement these unless business demand justifies them.

---

# 50. PRODUCT PRINCIPLES

Always follow these principles:

### Principle 1

The artwork is the hero.

### Principle 2

The creator should feel proud of their storefront.

### Principle 3

Buying should be simple.

### Principle 4

Motion should enhance the experience, not distract from it.

### Principle 5

The MVP should be technically simple but architecturally future-proof.

### Principle 6

No creator should need technical knowledge to sell.

### Principle 7

Trust is essential.

### Principle 8

Never compromise payment/security correctness for convenience.

### Principle 9

Design for multiple creators from day one.

### Principle 10

Do not over-engineer before there is real traffic.

---

# 51. CORE USER FLOWS

## Customer purchase flow

Customer
→ discovers artwork
→ opens artwork page
→ views images/details
→ adds to cart
→ checkout
→ address
→ payment
→ payment verification
→ order created
→ creator notified
→ creator prepares order
→ shipment
→ delivery
→ review

---

## Creator onboarding flow

Creator
→ registers
→ creates profile
→ submits creator information
→ verification/review
→ admin approves
→ storefront activated
→ uploads artwork
→ admin/moderation
→ artwork published
→ receives orders

---

## Custom artwork flow

Customer
→ creator profile
→ Request Custom
→ submit details
→ creator responds
→ customer accepts
→ payment
→ creation
→ fulfillment
→ delivery
→ review

---

# 52. UI PAGE MAP

## Public

Home
Explore
Search
Artwork Details
Creator Directory
Creator Profile
Categories
Collections
About
Contact
FAQ
Blog
Terms
Privacy
Refund Policy
Shipping Policy

## Customer

Login
Register
Account
Orders
Order Details
Wishlist
Following
Messages
Reviews
Addresses
Notifications
Settings
Checkout

## Creator

Creator Registration
Creator Dashboard
Storefront
Products
Add Product
Edit Product
Orders
Order Details
Messages
Earnings
Analytics
Reviews
Settings

## Admin

Admin Dashboard
Users
Creators
Artwork
Orders
Payments
Refunds
Reviews
Categories
Collections
Reports
Disputes
Settings

---

# 53. DESIGN DETAILS THAT MUST BE AVOIDED

Do NOT generate:

* generic hero with one static image and text
* repetitive 4-column cards everywhere
* excessive rounded cards
* default Tailwind appearance
* default shadcn appearance
* generic blue/purple SaaS colors
* excessive gradients
* fake testimonials
* stock-photo-heavy layouts
* irrelevant illustrations
* unnecessary dashboards
* animation for every button
* huge loading times
* complicated checkout

The site should look custom-designed.

---

# 54. QUALITY BAR

Before considering a page complete, ask:

1. Does it feel like an art platform?
2. Is the artwork visually dominant?
3. Is the experience smooth?
4. Is the interaction intuitive?
5. Is the page responsive?
6. Is it accessible?
7. Is the implementation performant?
8. Is security handled server-side?
9. Does this support multiple creators?
10. Can this feature scale later without rewriting core architecture?

---

# 55. DEVELOPMENT APPROACH

Do not generate the whole system blindly in one pass.

Work in this order:

### Step 1

Establish product architecture and database schema.

### Step 2

Create the design system.

### Step 3

Build the public visual experience.

### Step 4

Build authentication and user roles.

### Step 5

Build creator onboarding and storefronts.

### Step 6

Build artwork management.

### Step 7

Build discovery/search/filtering.

### Step 8

Build cart and checkout.

### Step 9

Integrate Cashfree securely.

### Step 10

Build orders and fulfillment.

### Step 11

Build reviews, wishlist and follows.

### Step 12

Build admin moderation.

### Step 13

Add analytics, monitoring and production hardening.

---

# 56. EXPECTED OUTPUT FROM THE DEVELOPMENT AGENT

Before writing significant code, produce:

1. system architecture
2. database ER diagram/schema
3. route/page structure
4. API/module structure
5. authentication/authorization design
6. payment architecture
7. image-storage architecture
8. creator/order/payment data flow
9. MVP feature breakdown
10. design system
11. component architecture
12. folder structure

Then implement incrementally.

Do NOT make irreversible architectural assumptions without explaining them.

---

# 57. FINAL PRODUCT DESCRIPTION

The final platform should feel like:

> A beautifully designed digital marketplace where independent artists and handmade creators can turn their creativity into an online storefront.

A visitor should be able to discover beautiful work.

A creator should be able to confidently say:

> "This is my shop."

And a customer should be able to go from:

> "I love this."

to:

> "I bought it."

with as little friction as possible.

The platform should feel:

**ARTISTIC.**
**HUMAN.**
**MODERN.**
**PREMIUM.**
**FAST.**
**TRUSTWORTHY.**

Build the product around these qualities rather than around generic e-commerce conventions.
