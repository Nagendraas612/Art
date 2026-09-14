# 💳 Cashfree Payments: Production Migration & Go-Live Guide

This document provides complete, step-by-step instructions for switching **Cashfree PG v6** from **SANDBOX (Test Mode)** to **PRODUCTION (Live Mode)** for your art marketplace.

---

## 1. Prerequisites Checklist
- [ ] Registered business or individual merchant account on [Cashfree Payments](https://www.cashfree.com).
- [ ] Completed merchant **KYC & Bank Account Verification** on the Cashfree dashboard.
- [ ] Active Vercel deployment with HTTPS (`https://ateliernco.vercel.app` or your custom domain).

---

## 2. Step-by-Step Production Setup

### Step 1: Access the Production Merchant Dashboard
1. Log in to [Cashfree Merchant Dashboard](https://merchant.cashfree.com).
2. Look at the top environment toggle switch:
   - Switch from **Test Environment (Sandbox)** to **Production Environment (Live)**.

---

### Step 2: Generate Live Production API Credentials
1. In the Cashfree dashboard sidebar, navigate to:
   **Payment Gateway** → **Developers** → **API Keys**.
2. Click **Generate API Keys** (or **Generate New Key**).
3. Copy the two generated credentials:
   - **App ID** (starts with `CF...` or your merchant ID)
   - **Secret Key** (starts with `cfsk_ma_prod_...`)
   > [!CAUTION]
   > Store the Secret Key securely immediately. Cashfree will only show it once.

---

### Step 3: Configure Live Webhooks
Webhooks allow Cashfree to automatically notify your application when a customer completes payment on UPI, Cards, or NetBanking.

1. In Cashfree Dashboard, navigate to:
   **Payment Gateway** → **Developers** → **Webhooks**.
2. Click **Add Webhook Endpoint**:
   - **Endpoint URL**: `https://ateliernco.vercel.app/api/webhooks/cashfree`
   - **Events to Select**:
     - `ORDER.PAID` (Payment Success)
     - `PAYMENT.FAILED` (Payment Failure)
     - `PAYMENT.USER_DROPPED`
     - `REFUND.PROCESSED`
   - **API Version**: `2023-08-01` (or latest v6)
3. Save the webhook endpoint.

---

### Step 4: Configure Your Brand Name & Logo on Cashfree Checkout
When customers enter the Cashfree payment window (UPI QR, Card details, NetBanking), Cashfree displays your brand identity:

1. In Cashfree Dashboard, go to **Settings** → **Branding / Checkout Settings**.
2. Set:
   - **Business / Brand Name**: e.g., `Atelier & Co.` (or your finalized brand name)
   - **Brand Logo**: Upload high-resolution square logo (PNG, min 256x256)
   - **Theme Accent Color**: `#1c1917` (Deep Luxury Noir matching your marketplace)
3. Save changes.

---

### Step 5: Update Environment Variables on Vercel
Go to **[vercel.com](https://vercel.com) → Your Project → Settings → Environment Variables**:

Update/Add these variables for the **Production** environment:

| Environment Variable | Production Value | Description |
| :--- | :--- | :--- |
| `CASHFREE_ENVIRONMENT` | `PRODUCTION` | Switches SDK from sandbox to live banking gateways |
| `CASHFREE_APP_ID` | `<Your Live Cashfree App ID>` | Production merchant App ID |
| `CASHFREE_SECRET_KEY` | `<Your Live Cashfree Secret Key>` | Production secret key |
| `NEXT_PUBLIC_APP_URL` | `https://ateliernco.vercel.app` | Production root URL for return callbacks |

---

### Step 6: Redeploy on Vercel
1. Go to **Deployments** tab on Vercel.
2. Click `⋯` on the latest deployment → **Redeploy**.
3. Test a real transaction (e.g. ₹1 or ₹10 test purchase) using a live UPI app (GPay / PhonePe / Paytm).
4. Verify the order status transitions to `ORDER_CONFIRMED` and customer/artisan receive email confirmation!
