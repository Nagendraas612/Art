import { getSession } from "@/modules/auth/guards";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { CreatorOnboardingForm } from "./CreatorOnboardingForm";
import styles from "./become-a-creator.module.css";

export const metadata = {
  title: "Join as a Creator",
  description: "Set up your independent artisan studio and showcase original artworks directly to collectors.",
};

export default async function BecomeACreatorPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const session = await getSession();

  let existingProfile = null;
  if (session?.user?.id) {
    existingProfile = await prisma.creatorProfile.findUnique({
      where: { userId: session.user.id },
    });
  }

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          <div className={styles.header}>
            <span className={styles.kicker}>Artisan Onboarding</span>
            <h1 className={styles.title}>
              {existingProfile ? "Your Creator Studio Profile" : "Launch Your Kalaa Bhadra Studio"}
            </h1>
            {notice === "studio_access_required" && (
              <div className={styles.noticeBanner} role="status">
                <strong>Studio access requires an approved creator profile.</strong>
                <span>
                  {" "}
                  Complete the application below — once approved, your studio dashboard unlocks.
                </span>
              </div>
            )}
            <p className={styles.subtitle}>
              Open your own studio storefront and sell your work directly to buyers across India.
            </p>
          </div>

          <div className={styles.formContainer}>
            <CreatorOnboardingForm
              user={
                session?.user
                  ? {
                      id: session.user.id,
                      name: session.user.name,
                      email: session.user.email,
                      image: session.user.image,
                    }
                  : null
              }
              existingProfile={
                existingProfile
                  ? {
                      handle: existingProfile.handle,
                      storeName: existingProfile.storeName,
                      tagline: existingProfile.tagline,
                      bio: existingProfile.bio,
                      disciplines: existingProfile.disciplines,
                      coverImageUrl: existingProfile.coverImageUrl,
                      profileImageUrl: existingProfile.profileImageUrl,
                      acceptsCustomOrders: existingProfile.acceptsCustomOrders,
                      pickupAddressLine: existingProfile.pickupAddressLine,
                      pickupPincode: existingProfile.pickupPincode,
                      pickupCity: existingProfile.pickupCity,
                      pickupState: existingProfile.pickupState,
                    }
                  : null
              }
            />
          </div>
        </div>
      </main>
    </>
  );
}
