import { getPlatformEconomicsAction } from "@/app/actions/admin";
import { EconomicsClient } from "./EconomicsClient";

export const dynamic = "force-dynamic";

export default async function AdminEconomicsPage() {
  const res = await getPlatformEconomicsAction();

  const defaultData = {
    globalCommissionRate: 0,
    commissionsList: [],
    pendingCreatorsPayouts: [],
    recentPayouts: [],
  };

  return <EconomicsClient initialData={res.success && res.data ? res.data : defaultData} />;
}
