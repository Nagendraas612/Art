# Atelier & Co.

Atelier & Co. is a multi-creator marketplace for original art and handmade work. It brings together a gallery-style shopping experience, creator storefronts and studio tools, and an admin area for marketplace operations.

**Live site:** [kalaabhadra.vercel.app](https://kalaabhadra.vercel.app/)\
**Source:** [github.com/Nagendraas612/Art](https://github.com/Nagendraas612/Art)

## What’s in the app

- **Discover and shop:** homepage gallery, artwork search and category browsing, artwork details, creator profiles, cart, checkout, and order history.
- **Collector accounts:** email/password and Google sign-in, wishlist, creator follows, direct messages, notifications, and artwork and artist reviews.
- **Creator studio:** creator applications, artwork listings, order management, commissions, messaging, and earnings.
- **Marketplace administration:** creator and artwork moderation, order oversight, trust and safety tools, platform economics, payouts, and audit history.
- **Commerce foundations:** product types for originals, editions, made-to-order and digital work; shipping and order records; Cashfree checkout and webhook handling; sandbox checkout when live payment credentials are not configured.

The interface follows a warm, editorial gallery design system. Product, architecture, and visual design details are documented in [PRODUCT_SPEC.md](PRODUCT_SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- PostgreSQL with Prisma 7
- Better Auth for sessions, email/password, and Google OAuth
- Cashfree PG for online payments
- Optional Cloudinary image uploads, with a data-URI fallback
- Transactional email through Gmail SMTP or Resend
- CSS Modules for page and component styling

## Run locally

### Requirements

- Node.js compatible with the versions required by Next.js 16
- PostgreSQL database
- npm

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set at least `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `NEXT_PUBLIC_APP_URL`. The database URL should point to your PostgreSQL database.

3. Create/update the database schema and generate the Prisma client:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

   `npm install` also runs Prisma client generation through the `postinstall` script.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example` for the variable names and example values.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma |
| `BETTER_AUTH_SECRET` | Secret used by Better Auth |
| `BETTER_AUTH_URL` | Optional auth base URL; defaults to `NEXT_PUBLIC_APP_URL` |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL, used for auth callbacks and generated links |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google sign-in credentials |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Cashfree payment credentials; without them checkout uses the sandbox flow |
| `CASHFREE_ENVIRONMENT` | `SANDBOX` or `PRODUCTION` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional Resend transactional email setup |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional Gmail SMTP email setup; see [Gmail SMTP setup](docs/GMAIL_SMTP_SETUP.md) |
| `SMTP_USER`, `SMTP_PASS` | Alternate SMTP credential names supported by the email dispatcher |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Optional Cloudinary upload configuration |
| `CLOUDINARY_UPLOAD_PRESET` | Optional Cloudinary upload preset; defaults to `atelier_uploads` |

Keep real credentials in `.env` or your deployment provider’s secret store. Do not commit them.

## Useful commands

```bash
npm run dev       # Start the local development server
npm run build     # Generate Prisma client and build the production app
npm run start     # Serve the production build
npm run lint      # Run ESLint
```

## Main routes

| Area | Routes |
| --- | --- |
| Public marketplace | `/`, `/explore`, `/artwork/[id]`, `/creators`, `/creators/[handle]` |
| Shopping and account | `/cart`, `/checkout`, `/orders`, `/wishlist`, `/messages`, `/notifications`, `/account` |
| Authentication | `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` |
| Creator studio | `/studio`, `/studio/artworks`, `/studio/orders`, `/studio/commissions`, `/studio/messages`, `/studio/earnings` |
| Administration | `/admin`, `/admin/creators`, `/admin/artworks`, `/admin/economics`, `/admin/trust-safety`, `/admin/audit` |
| API endpoints | `/api/auth/*`, `/api/upload`, `/api/webhooks/cashfree` |

## Project structure

```text
src/app/          App Router pages, layouts, server actions, and API routes
src/components/   Shared marketplace, studio, admin, and UI components
src/context/      Client-side application context, including the cart
src/lib/          Prisma, auth, payments, email, and shared server utilities
src/modules/      Domain-level auth and creator helpers
prisma/           PostgreSQL Prisma schema and seed data
docs/             Integration setup guides
scripts/          Maintenance and QA scripts
```

## Deployment

The app is deployed at [kalaabhadra.vercel.app](https://kalaabhadra.vercel.app/). A deployment needs a reachable PostgreSQL database and the corresponding environment variables configured in Vercel. Configure Cashfree credentials and its webhook URL at `/api/webhooks/cashfree` to enable live payment processing. Configure an email provider for transactional email delivery.
