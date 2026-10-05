import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Transactional Email Dispatcher for Kalaa Bhadra.
 * Supports:
 * 1. Gmail SMTP (via Nodemailer) - Send from your personal @gmail.com without needing a domain!
 * 2. Resend REST API - For custom verified domains.
 * 3. Database Logging (Prisma EmailLog) - All emails and templates are permanently recorded in Neon DB.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateType?: string;
  metadata?: Record<string, any>;
}

/**
 * Escape a single value for interpolation into HTML email templates.
 */
function esc(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Recursively escape every string in a template's params object.
 *
 * Each generate*Email function calls this once on entry
 * (`params = escDeep(params);`). Names, titles, messages, addresses and
 * rejection reasons are all attacker-influenced, and these emails are sent
 * from our own domain — unescaped interpolation is an HTML-injection /
 * phishing vector. Numbers, booleans, arrays and optional (undefined)
 * fields pass through untouched so `.toLocaleString()`, `.join()` and
 * ternaries keep working exactly as before.
 */
export function escDeep<T>(value: T): T {
  if (typeof value === "string") return esc(value) as T;
  if (Array.isArray(value)) return value.map(escDeep) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = escDeep(v);
    }
    return out as T;
  }
  return value;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  templateType = "TRANSACTIONAL",
  metadata,
}: SendEmailParams) {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  const resendApiKey = process.env.RESEND_API_KEY;
  let fromEmail = process.env.EMAIL_FROM || (gmailUser ? `Kalaa Bhadra <${gmailUser}>` : "Kalaa Bhadra <onboarding@resend.dev>");

  const jsonMetadata = metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull;

  // 1. GMAIL SMTP DISPATCH (Best for personal @gmail.com without custom domain)
  if (gmailUser && gmailPass) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
        text: text || "Please view this email in an HTML-compatible email reader.",
      });

      console.log(`[Email:Gmail-SMTP] Successfully sent to ${to} (MessageID: ${info.messageId})`);

      // Log into database
      await prisma.emailLog.create({
        data: {
          to,
          from: gmailUser,
          subject,
          templateType,
          status: "DELIVERED",
          provider: "GMAIL_SMTP",
          messageId: info.messageId,
          metadata: jsonMetadata,
        },
      }).catch((e) => console.error("[EmailLog DB Error]", e));

      return { success: true, messageId: info.messageId, provider: "GMAIL_SMTP" };
    } catch (err: any) {
      console.error("[Email:Gmail-SMTP] Error sending via Gmail:", err);

      await prisma.emailLog.create({
        data: {
          to,
          from: gmailUser || "unknown",
          subject,
          templateType,
          status: "FAILED",
          provider: "GMAIL_SMTP",
          errorDetails: err.message,
          metadata: jsonMetadata,
        },
      }).catch(() => {});

      return { success: false, error: err.message };
    }
  }

  // 2. RESEND REST API DISPATCH
  if (resendApiKey) {
    if (fromEmail.includes("@gmail.com") || fromEmail.includes("@yahoo.com")) {
      fromEmail = "Kalaa Bhadra <onboarding@resend.dev>";
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
          text: text || "Please view this message in an HTML-compatible email reader.",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Email:Resend] API error:", errorData);

        await prisma.emailLog.create({
          data: {
            to,
            from: fromEmail,
            subject,
            templateType,
            status: "FAILED",
            provider: "RESEND",
            errorDetails: JSON.stringify(errorData),
            metadata: jsonMetadata,
          },
        }).catch(() => {});

        return { success: false, error: `Resend rejected the email: ${JSON.stringify(errorData).slice(0, 300)}` };
      }

      const data = await response.json();
      console.log(`[Email:Resend] Dispatched successfully to ${to} (ID: ${data.id})`);

      await prisma.emailLog.create({
        data: {
          to,
          from: fromEmail,
          subject,
          templateType,
          status: "DELIVERED",
          provider: "RESEND",
          messageId: data.id,
          metadata: jsonMetadata,
        },
      }).catch(() => {});

      return { success: true, messageId: data.id, provider: "RESEND" };
    } catch (err: any) {
      console.error("[Email:Resend] Network error sending email:", err);
      return { success: false, error: err.message };
    }
  }

  // 3. FALLBACK CONSOLE SIMULATOR (development only).
  // In production a missing provider is a hard failure, not a silent
  // success — callers must know the email never left the building.
  if (process.env.NODE_ENV === "production") {
    const errMsg = "Email provider not configured (set GMAIL_USER/GMAIL_APP_PASSWORD or RESEND_API_KEY).";
    console.error(`[Email] ${errMsg} To: ${to} | Subject: ${subject}`);
    await prisma.emailLog.create({
      data: {
        to,
        from: fromEmail,
        subject,
        templateType,
        status: "FAILED",
        provider: "NONE_CONFIGURED",
        errorDetails: errMsg,
        metadata: jsonMetadata,
      },
    }).catch(() => {});
    return { success: false, error: errMsg };
  }

  console.log(`[DEV EMAIL SIMULATOR] To: ${to} | Subject: ${subject}`);

  await prisma.emailLog.create({
    data: {
      to,
      from: fromEmail,
      subject,
      templateType,
      status: "SIMULATED",
      provider: "CONSOLE_DEV",
      metadata: jsonMetadata,
    },
  }).catch(() => {});

  return { success: true, simulated: true };
}

/* ==========================================================================
   Email Templates (Collector-Grade Inline Styling)
   ========================================================================== */

const baseEmailStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1c1917;
  background-color: #fafaf9;
  margin: 0;
  padding: 40px 20px;
`;

const containerStyles = `
  max-width: 580px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e7e5e4;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const headerStyles = `
  padding: 32px 32px 24px;
  background: #1c1917;
  color: #f5f5f4;
  text-align: center;
`;

const bodyStyles = `
  padding: 32px;
  line-height: 1.6;
  font-size: 15px;
`;

const buttonStyles = `
  display: inline-block;
  background: #1c1917;
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 9999px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  margin-top: 20px;
`;

const footerStyles = `
  padding: 24px 32px;
  background: #fafaf9;
  border-top: 1px solid #e7e5e4;
  font-size: 12px;
  color: #78716c;
  text-align: center;
`;

// 1. Order Confirmation (To Buyer)
export function generateOrderConfirmationEmail(params: {
  customerName: string;
  orderNumber: string;
  grandTotal: number;
  subtotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  shippingAddress?: string;
  items: Array<{ title: string; quantity: number; lineTotal: number; creatorName: string }>;
  trackingUrl: string;
}) {
  params = escDeep(params);
  const itemsHtml = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f5f5f4;">
          <strong style="color: #1c1917;">${item.title}</strong><br/>
          <span style="color: #78716c; font-size: 13px;">Studio: ${item.creatorName} · Qty: ${item.quantity}</span>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f5f5f4; text-align: right; font-weight: 600;">
          ₹${item.lineTotal.toLocaleString("en-IN")}
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px; letter-spacing: 0.05em;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.1em;">Order Confirmed</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Dear ${params.customerName},</p>
          <p>Thank you for acquiring original artisanal pieces through Kalaa Bhadra. The artisan studios have received your order details and are preparing your pieces with protective collector-grade packaging.</p>
          
          <div style="background: #fafaf9; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #78716c; font-size: 13px;">Order Number:</td>
                <td style="text-align: right; font-weight: 600;">#${params.orderNumber}</td>
              </tr>
              ${
                params.shippingAddress
                  ? `
              <tr>
                <td style="color: #78716c; font-size: 13px; padding-top: 8px;">Delivery Address:</td>
                <td style="text-align: right; font-size: 13px; color: #1c1917; padding-top: 8px;">${params.shippingAddress}</td>
              </tr>
              `
                  : ""
              }
            </table>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="border-bottom: 2px solid #e7e5e4; text-align: left; font-size: 12px; color: #78716c; text-transform: uppercase;">
                <th style="padding-bottom: 8px;">Artwork Item</th>
                <th style="padding-bottom: 8px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td style="padding-top: 16px; font-weight: bold; font-size: 16px;">Total Paid</td>
                <td style="padding-top: 16px; text-align: right; font-weight: bold; font-size: 18px;">₹${params.grandTotal.toLocaleString("en-IN")}</td>
              </tr>
            </tfoot>
          </table>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.trackingUrl}" style="${buttonStyles}">Track Order Status & Certificate</a>
          </div>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0 0 6px;">Questions regarding your acquisition? Contact our curator team.</p>
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

// 2. New Order Notification (To Artisan / Creator)
export function generateCreatorNewOrderEmail(params: {
  creatorName: string;
  orderNumber: string;
  itemTitle: string;
  quantity: number;
  creatorPayout: number;
  customerName: string;
  shippingAddress: string;
  studioUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA STUDIO</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">New Collector Order</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.creatorName},</p>
          <p>Great news! A collector has just acquired your piece: <strong>${params.itemTitle}</strong> (Qty: ${params.quantity}).</p>
          
          <div style="background: #fafaf9; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #78716c; font-size: 13px;">Order Number:</td>
                <td style="text-align: right; font-weight: 600;">#${params.orderNumber}</td>
              </tr>
              <tr>
                <td style="color: #78716c; font-size: 13px; padding-top: 6px;">Collector Name:</td>
                <td style="text-align: right; font-weight: 600; padding-top: 6px;">${params.customerName}</td>
              </tr>
              <tr>
                <td style="color: #78716c; font-size: 13px; padding-top: 6px;">Your Net Payout (90%):</td>
                <td style="text-align: right; font-weight: bold; color: #15803d; font-size: 16px; padding-top: 6px;">₹${params.creatorPayout.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td style="color: #78716c; font-size: 13px; padding-top: 6px;">Ship To:</td>
                <td style="text-align: right; font-size: 13px; padding-top: 6px;">${params.shippingAddress}</td>
              </tr>
            </table>
          </div>

          <p>Please prepare collector-grade packaging and include the printed Certificate of Authenticity with the shipment.</p>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.studioUrl}" style="${buttonStyles}">View Studio Orders & Fulfill</a>
          </div>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra Creator Desk</p>
        </div>
      </div>
    </div>
  `;
}

// 3. New Artwork Submitted for Curation (To Admin)
export function generateArtworkSubmittedAdminEmail(params: {
  artworkTitle: string;
  creatorName: string;
  storeName: string;
  price: number;
  category: string;
  reviewUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px; color: #f59e0b;">CURATION BOARD</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">New Artwork Pending Review</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>A new piece has been submitted by an artisan studio and requires curation review before going live.</p>
          
          <div style="background: #fafaf9; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #78716c; font-size: 13px;">Artwork Title:</td>
                <td style="text-align: right; font-weight: 600;">${params.artworkTitle}</td>
              </tr>
              <tr>
                <td style="color: #78716c; font-size: 13px; padding-top: 6px;">Artisan Studio:</td>
                <td style="text-align: right; padding-top: 6px;">${params.storeName} (${params.creatorName})</td>
              </tr>
              <tr>
                <td style="color: #78716c; font-size: 13px; padding-top: 6px;">Category:</td>
                <td style="text-align: right; padding-top: 6px;">${params.category}</td>
              </tr>
              <tr>
                <td style="color: #78716c; font-size: 13px; padding-top: 6px;">List Price:</td>
                <td style="text-align: right; font-weight: bold; padding-top: 6px;">₹${params.price.toLocaleString("en-IN")}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.reviewUrl}" style="${buttonStyles}">Review &amp; Approve in Admin Panel</a>
          </div>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">Automated Curation Dispatch · Kalaa Bhadra</p>
        </div>
      </div>
    </div>
  `;
}

// 4. Artwork Curation Result (To Creator)
export function generateArtworkCurationResultEmail(params: {
  creatorName: string;
  artworkTitle: string;
  isApproved: boolean;
  rejectionReason?: string;
  artworkUrl?: string;
  studioUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Curation Status Update</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.creatorName},</p>
          
          ${
            params.isApproved
              ? `
            <p>Congratulations! Your artwork <strong>"${params.artworkTitle}"</strong> has been approved by our curation board and is now <strong>Live in the Kalaa Bhadra Collection</strong>.</p>
            <p>Collectors can now discover, bookmark, and acquire this piece directly from your storefront.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${params.artworkUrl || params.studioUrl}" style="${buttonStyles}">View Live Piece</a>
            </div>
          `
              : `
            <p>Our curation board has reviewed your submission for <strong>"${params.artworkTitle}"</strong>.</p>
            <p>Status: <strong style="color: #dc2626;">Needs Changes / Not Approved</strong></p>
            ${
              params.rejectionReason
                ? `<blockquote style="background: #fafaf9; border-left: 3px solid #f87171; margin: 16px 0; padding: 12px 16px; color: #57534e;">${params.rejectionReason}</blockquote>`
                : ""
            }
            <p>You may update the craft details, imagery, or provenance in your Creator Studio and resubmit for evaluation.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${params.studioUrl}" style="${buttonStyles}">Edit in Creator Studio</a>
            </div>
          `
          }
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra Curation Board</p>
        </div>
      </div>
    </div>
  `;
}

// 5. Creator Studio Application Status
export function generateCreatorStatusEmail(params: {
  creatorName: string;
  status: "APPROVED" | "REJECTED" | "SUSPENDED";
  storeName: string;
  reason?: string;
  studioUrl: string;
}) {
  params = escDeep(params);
  const isApproved = params.status === "APPROVED";

  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Studio Application</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.creatorName},</p>
          
          ${
            isApproved
              ? `
            <p>Congratulations! Your studio application for <strong>${params.storeName}</strong> has been approved by our curation board.</p>
            <p>Your studio storefront is now live in our Artisan Directory. You have full access to publish original creations, manage customer commissions, and receive direct buyer inquiries.</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${params.studioUrl}" style="${buttonStyles}">Enter Creator Studio</a>
            </div>
          `
              : `
            <p>We are writing to update you on your application for <strong>${params.storeName}</strong>.</p>
            <p>Status: <strong>${params.status}</strong></p>
            ${params.reason ? `<blockquote style="background: #fafaf9; border-left: 3px solid #e7e5e4; margin: 16px 0; padding: 12px 16px; color: #57534e;">${params.reason}</blockquote>` : ""}
            <p>If you have questions or would like to request re-evaluation, feel free to contact our curator desk.</p>
          `
          }
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra Artisan Curation Board</p>
        </div>
      </div>
    </div>
  `;
}

// 6. Direct Message Notification
export function generateNewMessageEmail(params: {
  recipientName: string;
  senderName: string;
  messageExcerpt: string;
  conversationUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">New Message</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.recipientName},</p>
          <p>You have received a new secure message from <strong>${params.senderName}</strong>:</p>
          
          <blockquote style="background: #fafaf9; border-left: 3px solid #e7e5e4; margin: 16px 0; padding: 12px 16px; color: #57534e; font-style: italic;">
            "${params.messageExcerpt}..."
          </blockquote>
          
          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.conversationUrl}" style="${buttonStyles}">View & Reply</a>
          </div>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra Direct Messaging</p>
        </div>
      </div>
    </div>
  `;
}

// 7. Password Reset Email
export function generatePasswordResetEmail(params: {
  userName: string;
  resetUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Account Security</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.userName},</p>
          <p>We received a request to reset the password for your Kalaa Bhadra account.</p>
          <p>If you made this request, please click the button below to securely set a new password:</p>
          
          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.resetUrl}" style="${buttonStyles}">Reset Password</a>
          </div>

          <p style="margin-top: 32px; font-size: 13px; color: #78716c;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra Security Team</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Review request email — sent when an order is marked DELIVERED, inviting
 * the collector to appraise the piece. Reviews require a paid order item
 * (enforced in the review action), so this email can only ever reach genuine
 * buyers.
 */
export function generateReviewRequestEmail(params: {
  customerName: string;
  orderNumber: string;
  artworkTitles: string[];
  reviewUrl: string;
}) {
  params = escDeep(params);
  const titles =
    params.artworkTitles.length > 0
      ? params.artworkTitles.join(", ")
      : "your recent acquisition";
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Share Your Appraisal</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Dear ${params.customerName},</p>
          <p>Your order <strong>#${params.orderNumber}</strong> has been delivered. We hope ${params.artworkTitles.length > 1 ? "the pieces have" : "the piece has"} found a worthy wall.</p>
          <p>Collectors value the appraisals of fellow collectors — would you share a few words on ${titles}?</p>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.reviewUrl}" style="${buttonStyles}">Write a Review</a>
          </div>

          <p style="margin-top: 32px; font-size: 13px; color: #78716c;">Only verified buyers can leave reviews, so your appraisal carries real weight.</p>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

// 7b. Email Verification
export function generateVerificationEmail(params: {
  userName: string;
  verificationUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Email Verification</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.userName},</p>
          <p>Welcome to Kalaa Bhadra. Please verify your email address to secure your account and unlock the full collector experience:</p>
          
          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.verificationUrl}" style="${buttonStyles}">Verify Email Address</a>
          </div>

          <p style="margin-top: 32px; font-size: 13px; color: #78716c;">If you didn't create a Kalaa Bhadra account, you can safely ignore this email.</p>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra</p>
        </div>
      </div>
    </div>
  `;
}

// 8. Order Status Update Email
export function generateOrderStatusEmail(params: {
  customerName: string;
  orderNumber: string;
  status: string;
  message?: string;
  trackingUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Order Update</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Dear ${params.customerName},</p>
          <p>There is an update regarding your recent order <strong>#${params.orderNumber}</strong>.</p>
          
          <div style="background: #fafaf9; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
            <span style="font-size: 13px; color: #78716c; text-transform: uppercase;">Current Status</span><br/>
            <strong style="font-size: 18px; color: #1c1917;">${params.status}</strong>
          </div>

          ${params.message ? `<p>${params.message}</p>` : ""}

          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.trackingUrl}" style="${buttonStyles}">View Order Details</a>
          </div>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Payout settlement email (P8). Honest copy: the transfer was completed
 * externally by the operations team; this email records the settlement,
 * it does not claim the code dispatched money.
 */
export function generatePayoutSettledEmail(params: {
  creatorName: string;
  amount: number;
  settlementReference: string;
  earningsCount: number;
  dashboardUrl: string;
}) {
  params = escDeep(params);
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">KALAA BHADRA</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Payout Settled</p>
        </div>

        <div style="${bodyStyles}">
          <p>Dear ${params.creatorName},</p>
          <p>Your payout has been recorded as settled by the Kalaa Bhadra team.</p>

          <div style="background: #fafaf9; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
            <span style="font-size: 13px; color: #78716c; text-transform: uppercase;">Settlement Amount</span><br/>
            <strong style="font-size: 22px; color: #1c1917;">₹${params.amount.toLocaleString("en-IN")}</strong><br/>
            <span style="font-size: 12px; color: #78716c;">${params.earningsCount} earning${params.earningsCount === 1 ? "" : "s"} · Ref #${params.settlementReference}</span>
          </div>

          <p>Please allow 2-3 business days for the amount to reflect in your bank account. If it doesn't arrive, reply to this email with the settlement reference above.</p>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.dashboardUrl}" style="${buttonStyles}">View Earnings</a>
          </div>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Kalaa Bhadra. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}
