import { getDisputesAndReportsAction } from "@/app/actions/admin";
import { TrustSafetyClient } from "./TrustSafetyClient";

export const dynamic = "force-dynamic";

export default async function AdminTrustSafetyPage() {
  const res = await getDisputesAndReportsAction();

  return (
    <TrustSafetyClient
      initialDisputes={res.disputes || []}
      initialReports={res.reports || []}
    />
  );
}
