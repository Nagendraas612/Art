import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { Role } from "@prisma/client";

export async function dispatchAdminAlert({
  type,
  message,
  refType,
  refId,
  actionUrl,
  actionText,
}: {
  type: string;
  message: string;
  refType?: string;
  refId?: string;
  actionUrl?: string;
  actionText?: string;
}) {
  try {
    // 1. Create a system Notification for all users with Role.ADMIN or SUPER_ADMIN
    const admins = await prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
      },
      select: { id: true, email: true, name: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: `SYSTEM_ALERT_${type}`,
          title: `Admin Alert: ${type.replace(/_/g, " ")}`,
          body: message,
          refType: refType || null,
          refId: refId || null,
        },
      });
    }

    // 2. Dispatch Email to all admin users
    const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fullActionUrl = actionUrl ? `${domain}${actionUrl}` : `${domain}/admin`;

    for (const admin of admins) {
      if (admin.email) {
        const emailHtml = generateAdminAlertEmail({
          adminName: admin.name || "Admin",
          alertType: type,
          message,
          actionUrl: fullActionUrl,
          actionText: actionText || "View in Admin Panel",
        });

        // Fire and forget
        sendEmail({
          to: admin.email,
          subject: `[Admin Alert] ${type.replace(/_/g, " ")} — Atelier & Co.`,
          html: emailHtml,
          templateType: `ADMIN_ALERT_${type}`,
          metadata: { type, refType, refId },
        }).catch((err) => console.error("[Admin Alert Email Error]", err));
      }
    }

    console.log(`[Admin Alert] Dispatched "${type}" to ${admins.length} admin(s).`);
  } catch (err) {
    console.error("Failed to dispatch admin alert:", err);
  }
}

/* ==========================================================================
   Admin Alert Email Template (self-contained)
   ========================================================================== */

function generateAdminAlertEmail(params: {
  adminName: string;
  alertType: string;
  message: string;
  actionUrl: string;
  actionText: string;
}) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917; background-color: #fafaf9; margin: 0; padding: 40px 20px;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="padding: 32px 32px 24px; background: #1c1917; color: #f5f5f4; text-align: center;">
          <h1 style="margin: 0; font-family: serif; font-size: 26px; letter-spacing: 0.05em;">ATELIER ADMIN</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.1em;">Platform Alert</p>
        </div>
        
        <div style="padding: 32px; line-height: 1.6; font-size: 15px;">
          <p>Hello ${params.adminName},</p>
          
          <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px; text-transform: uppercase; color: #92400e;">${params.alertType.replace(/_/g, " ")}</p>
            <p style="margin: 0; color: #1c1917;">${params.message}</p>
          </div>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${params.actionUrl}" style="display: inline-block; background: #1c1917; color: #ffffff; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 14px;">${params.actionText}</a>
          </div>
        </div>

        <div style="padding: 24px 32px; background: #fafaf9; border-top: 1px solid #e7e5e4; font-size: 12px; color: #78716c; text-align: center;">
          <p style="margin: 0;">Automated Admin Alert · © ${new Date().getFullYear()} Atelier & Co.</p>
        </div>
      </div>
    </div>
  `;
}
