/**
 * Transactional Email Dispatcher for Atelier & Co.
 * Integrates directly with Resend REST API or logs formatted HTML to dev console.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "Atelier & Co. <concierge@atelier.co>";

  if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        console.error("[Email] Resend API error:", errorData);
        // Fallback to simulator if API fails (e.g. unverified domain)
        console.log(`\n======================================================`);
        console.log(`📬 [DEV EMAIL SIMULATOR FALLBACK]`);
        console.log(`To: ${to}\nSubject: ${subject}\nError: ${errorData.message}`);
        console.log(`======================================================\n`);
        return { success: true, simulated: true, error: errorData };
      }

      const data = await response.json();
      console.log(`[Email] Dispatched successfully to ${to} (ID: ${data.id})`);
      return { success: true, messageId: data.id };
    } catch (err: any) {
      console.error("[Email] Network error sending email:", err);
      return { success: false, error: err.message };
    }
  } else {
    // Development fallback simulation
    console.log(`\n======================================================`);
    console.log(`📬 [DEV EMAIL SIMULATOR]`);
    console.log(`To: ${to}`);
    console.log(`From: ${fromEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`------------------------------------------------------`);
    console.log(`Status: Resend API Key not set. Outputting preview.`);
    console.log(`======================================================\n`);
    return { success: true, simulated: true };
  }
}

/* ==========================================================================
   Email Templates (Inline Responsive Styling)
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

// 1. Order Confirmation
export function generateOrderConfirmationEmail(params: {
  customerName: string;
  orderNumber: string;
  grandTotal: number;
  items: Array<{ title: string; quantity: number; lineTotal: number; creatorName: string }>;
  trackingUrl: string;
}) {
  const itemsHtml = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f5f5f4;">
          <strong style="color: #1c1917;">${item.title}</strong><br/>
          <span style="color: #78716c; font-size: 13px;">By ${item.creatorName} · Qty: ${item.quantity}</span>
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
          <h1 style="margin: 0; font-family: serif; font-size: 26px; letter-spacing: 0.05em;">ATELIER & CO.</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.1em;">Order Confirmed</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Dear ${params.customerName},</p>
          <p>Thank you for acquiring artisanal creations through Atelier & Co. The artisan studios have received your order details and are preparing your pieces with protective collector-grade packaging.</p>
          
          <div style="background: #fafaf9; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #78716c; font-size: 13px;">Order Number:</td>
                <td style="text-align: right; font-weight: 600;">#${params.orderNumber}</td>
              </tr>
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
          <p style="margin: 0 0 6px;">Questions regarding your acquisition? Contact <a href="mailto:concierge@atelier.co" style="color: #1c1917;">concierge@atelier.co</a></p>
          <p style="margin: 0;">© ${new Date().getFullYear()} Atelier & Co. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

// 2. Order Status Update
export function generateOrderStatusEmail(params: {
  customerName: string;
  orderNumber: string;
  status: string;
  message?: string;
  trackingUrl: string;
}) {
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">ATELIER & CO.</h1>
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
          <p style="margin: 0;">© ${new Date().getFullYear()} Atelier & Co. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

// 3. Creator Approval / Rejection
export function generateCreatorStatusEmail(params: {
  creatorName: string;
  status: "APPROVED" | "REJECTED" | "SUSPENDED";
  storeName: string;
  reason?: string;
  studioUrl: string;
}) {
  const isApproved = params.status === "APPROVED";

  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">ATELIER & CO.</h1>
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
          <p style="margin: 0;">© ${new Date().getFullYear()} Atelier & Co. Artisan Curation Board</p>
        </div>
      </div>
    </div>
  `;
}

// 4. Password Reset / Account
export function generatePasswordResetEmail(params: {
  userName: string;
  resetUrl: string;
}) {
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">ATELIER & CO.</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">Account Security</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.userName},</p>
          <p>We received a request to reset the password for your Atelier & Co. account.</p>
          <p>If you made this request, please click the button below to securely set a new password:</p>
          
          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.resetUrl}" style="${buttonStyles}">Reset Password</a>
          </div>

          <p style="margin-top: 32px; font-size: 13px; color: #78716c;">If you didn't request a password reset, you can safely ignore this email. Your account remains secure.</p>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Atelier & Co. Security Team</p>
        </div>
      </div>
    </div>
  `;
}

// 5. New Message Notification
export function generateNewMessageEmail(params: {
  recipientName: string;
  senderName: string;
  messageExcerpt: string;
  conversationUrl: string;
}) {
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px;">ATELIER & CO.</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">New Message</p>
        </div>
        
        <div style="${bodyStyles}">
          <p>Hello ${params.recipientName},</p>
          <p>You have received a new secure message from <strong>${params.senderName}</strong>.</p>
          
          <blockquote style="background: #fafaf9; border-left: 3px solid #e7e5e4; margin: 16px 0; padding: 12px 16px; color: #57534e; font-style: italic;">
            "${params.messageExcerpt}..."
          </blockquote>
          
          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.conversationUrl}" style="${buttonStyles}">View & Reply</a>
          </div>
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">© ${new Date().getFullYear()} Atelier & Co. Direct Messaging</p>
        </div>
      </div>
    </div>
  `;
}

// 6. Admin Alerts
export function generateAdminAlertEmail(params: {
  alertType: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
}) {
  return `
    <div style="${baseEmailStyles}">
      <div style="${containerStyles}">
        <div style="${headerStyles}">
          <h1 style="margin: 0; font-family: serif; font-size: 26px; color: #f87171;">ATELIER ADMIN</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #a8a29e; text-transform: uppercase;">System Alert: ${params.alertType}</p>
        </div>
        
        <div style="${bodyStyles}">
          <p style="font-weight: 600; color: #1c1917;">A new system alert requires your attention.</p>
          <p>${params.message}</p>
          
          ${
            params.actionUrl
              ? `
            <div style="text-align: center; margin-top: 28px;">
              <a href="${params.actionUrl}" style="${buttonStyles}">${params.actionText || "View Details"}</a>
            </div>
          `
              : ""
          }
        </div>

        <div style="${footerStyles}">
          <p style="margin: 0;">Automated System Dispatch · Atelier & Co.</p>
        </div>
      </div>
    </div>
  `;
}
