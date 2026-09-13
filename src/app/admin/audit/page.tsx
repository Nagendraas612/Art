import { getAuditLogsAction } from "@/app/actions/admin";
import { AuditTrailClient } from "./AuditTrailClient";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const res = await getAuditLogsAction({ limit: 100 });
  const logs = res.success && res.logs ? res.logs : [];

  return <AuditTrailClient logs={logs} />;
}
