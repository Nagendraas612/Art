# 📧 Sending Real Emails from Personal Gmail (@gmail.com) Without a Domain

If you do not own a custom domain yet, you can send transactional emails directly from your **personal Gmail account** (`nagias612@gmail.com`) to any customer or creator inbox.

---

## 🚀 2-Minute Setup: Generate Google App Password

Because Google blocks automated logins using regular passwords, Google provides **App Passwords** for secure server SMTP access.

### Step 1: Enable 2-Step Verification (if not already enabled)
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Under "How you sign in to Google", ensure **2-Step Verification** is turned **ON**.

---

### Step 2: Generate an App Password
1. In Google Account search bar, type: **App passwords** (or go directly to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
2. Under **App name**, type: `Atelier Marketplace`
3. Click **Create**.
4. Google will display a **16-character password** (e.g. `abcd efgh ijkl mnop`).
5. Copy this 16-character code (without spaces).

---

### Step 3: Add to `.env` and Vercel

In your local `.env` and in **Vercel → Project Settings → Environment Variables**, add:

```env
# Gmail SMTP Configuration
GMAIL_USER="nagias612@gmail.com"
GMAIL_APP_PASSWORD="abcdefghijklmnop"
```

---

## 🎯 How It Works in Atelier & Co.
1. Our email engine ([`src/lib/email.ts`](file:///p:/Art/src/lib/email.ts)) detects `GMAIL_USER` and `GMAIL_APP_PASSWORD`.
2. It sends real emails via **Gmail SMTP (`smtp.gmail.com`)** directly from `nagias612@gmail.com`.
3. Every email sent:
   - **Delivers directly** to any recipient's inbox (Gmail, Outlook, Yahoo, Apple Mail).
   - **Appears in your Gmail "Sent" folder**.
   - **Logs into your database** (`EmailLog` table in Neon Postgres).
