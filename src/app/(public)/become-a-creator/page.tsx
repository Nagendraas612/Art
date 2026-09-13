import { getSession } from "@/modules/auth/guards";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { CreatorOnboardingForm } from "./CreatorOnboardingForm";
import styles from "./become-a-creator.module.css";

export const metadata = {
  title: "Join as a Creator — Atelier & Co.",
  description: "Set up your independent artisan studio and showcase original artworks directly to collectors.",
};

export default async function BecomeACreatorPage() {
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
              {existingProfile ? "Your Creator Studio Profile" : "Launch Your Atelier Studio"}
            </h1>
            <p className={styles.subtitle}>
              Share your craft, set your studio identity, and connect directly with collectors looking
              for authentic original art and handcrafted objects.
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
