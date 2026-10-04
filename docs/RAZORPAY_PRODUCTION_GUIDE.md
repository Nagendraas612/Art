# 💳 Razorpay Payments: Test & Production Go-Live Guide

This document covers the Razorpay Standard Checkout integration for the Kalaa Bhadra marketplace: test mode verification and the switch to live (production) keys.

The integration replaced the former Cashfree gateway (full replacement, October 2026).

---

## 1. How the integration works

| Piece | Location |
|---|---|
| Server-side SDK wrapper (lazy init, fail-closed config check) | `src/lib/razorpay.ts` |
| Order creation (amount in **paise**, receipt = our order number) | `processCheckout` / `retryOrderPaymentAction` in `src/app/actions/checkout.ts` |
| Checkout.js modal + signature handoff | `src/app/(public)/checkout/page.tsx`, `src/components/checkout/RetryPaymentButton.tsx` |
| Signature verification (HMAC-SHA256, never marks paid) | `src/app/api/verify-payment/route.ts` |
| Webhook: `payment.captured` / `payment.failed` → order confirm | `src/app/api/webhooks/razorpay/route.ts` |
| CSP allow-list for Razorpay hosts | `next.config.ts` |

Key security properties (kept from the previous gateway):
- Checkout **fails closed** when `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are absent — no free orders.
- The webhook is the **only** path that confirms an order. `/api/verify-payment` only authenticates the Checkout.js callback so the UI can redirect; it never changes order state.
- Webhook signature (`x-razorpay-signature`, HMAC-SHA256 of the raw body with `RAZORPAY_WEBHOOK_SECRET`) is verified before any processing.
- Idempotency via `gatewayEventId` (`razorpay:<event>:<payment_id>`); amount reconciliation (paise → rupees vs `grandTotal`); stock re-check under row locks before confirming; creator earnings booked only after confirmed payment.

---

## 2. Test mode (do this first)

1. In the [Razorpay Dashboard](https://dashboard.razorpay.com), stay in **Test Mode**. Copy:
   - **Key ID** (`rzp_test_...`) → `RAZORPAY_KEY_ID`
   - **Key Secret** → `RAZORPAY_KEY_SECRET`
2. **Webhooks** → Add webhook:
   - URL: `https://kalaabhadra.vercel.app/api/webhooks/razorpay`
     (for local testing, use a tunnel such as ngrok pointing at `localhost:3000`)
   - Events: `payment.captured`, `payment.failed`
   - Copy the generated **Webhook Secret** → `RAZORPAY_WEBHOOK_SECRET`
3. Set the public key for the browser: `NEXT_PUBLIC_RAZORPAY_KEY_ID` = same Key ID.
4. Ensure `SANDBOX_CHECKOUT_ENABLED` is **unset or `false`** (when `true`, checkout uses the local simulator and never touches Razorpay).
5. Run `npm install` (adds the `razorpay` package), then start the app and place a test order:
   - Razorpay test cards: `4111 1111 1111 1111` (any future expiry, any CVV), or test UPI.
   - Complete the payment in the Razorpay modal → you should land on the order page with `success=true`.
   - Confirm in the DB: order → `ORDER_CONFIRMED`, payment → `PAID`, and a `PaymentTransaction` row with `gatewayEventId` like `razorpay:payment.captured:pay_...`.
   - Also test: modal dismiss (cancel), a failed payment, and the retry button on a failed order.
6. Check the Razorpay Dashboard → Webhooks → logs: `payment.captured` delivered with HTTP 200.

### Test checklist
- [ ] Successful test payment confirms the order end-to-end (webhook 200, order confirmed, emails sent)
- [ ] Failed payment marks the order `PAYMENT_FAILED` and sends the buyer email
- [ ] Retry payment works from the order page
- [ ] Amount-tamper test: webhook with a wrong amount leaves the order `DISPUTED` (manual review path)

---

## 3. Going live (production)

1. Complete Razorpay **account activation / KYC** in the dashboard, then switch to **Live Mode**.
2. Generate **live** keys (`rzp_live_...`) and a **live webhook secret**.
3. In Vercel → Project → Settings → Environment Variables, set for **Production**:
   - `RAZORPAY_KEY_ID` = live key id
   - `RAZORPAY_KEY_SECRET` = live key secret
   - `RAZORPAY_WEBHOOK_SECRET` = live webhook secret
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` = live key id
   - Confirm `SANDBOX_CHECKOUT_ENABLED` is **absent** in production.
4. Add the **production** webhook (`https://kalaabhadra.vercel.app/api/webhooks/razorpay`, events `payment.captured` + `payment.failed`) under the live-mode webhooks section.
5. Redeploy, then run **one real low-value payment** (e.g. a ₹100 test artwork or a minimal-price piece) and verify the full flow before announcing launch.
6. Optional: set your brand name/logo in Razorpay Dashboard → Settings → Checkout appearance so buyers see "Kalaa Bhadra" in the payment modal.

---

## 4. Notes

- Test and live are **separate** in Razorpay: keys, webhook secrets, and webhook subscriptions do not carry over. Configure both.
- Creator payouts are **not** automatic splits: the full amount settles to the platform's Razorpay account. Pay creators out manually (or via RazorpayX) until volume justifies Razorpay Route with linked creator accounts.
- Refunds are processed from the Razorpay Dashboard (Payments → select payment → Refund). The integration does not auto-refund; disputed orders are flagged to the admin for manual review.
