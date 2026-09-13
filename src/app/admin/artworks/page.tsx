import { getArtworkModerationQueueAction } from "@/app/actions/admin";
import { ArtworkModerationClient } from "./ArtworkModerationClient";

export const dynamic = "force-dynamic";

export default async function AdminArtworksPage() {
  const res = await getArtworkModerationQueueAction({ status: "ALL" });

  return <ArtworkModerationClient initialArtworks={res.artworks || []} />;
}
