import { getCreatorApplicationsAction } from "@/app/actions/admin";
import { CreatorModerationClient } from "./CreatorModerationClient";

export const dynamic = "force-dynamic";

export default async function AdminCreatorsPage() {
  const res = await getCreatorApplicationsAction({ status: "ALL" });

  return <CreatorModerationClient initialCreators={res.creators || []} />;
}
