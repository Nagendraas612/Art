import { prisma } from "@/lib/prisma";
import { sendEmail, generateAdminAlertEmail } from "@/lib/email";
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
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: `SYSTEM_ALERT_${type}`,
          title: `Admin Alert: ${type}`,
          body: message,
          refType,
          refId,
        },
      });
    }

    // 2. Dispatch Email
    // Dispatch to nagias612@gmail.com
    const adminEmailAddress = process.env.EMAIL_FROM || "nagias612@gmail.com";
    
    const emailHtml = generateAdminAlertEmail({
      alertType: type,
      message,
      actionUrl,
      actionText,
    });

    // Fire and forget
    sendEmail({
      to: adminEmailAddress,
      subject: `[Admin Alert] ${type} — Atelier & Co.`,
      html: emailHtml,
    }).catch(console.error);

  } catch (err) {
    console.error("Failed to dispatch admin alert:", err);
  }
}
