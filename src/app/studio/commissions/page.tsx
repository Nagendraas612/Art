import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { CommissionProposalForm } from "@/components/studio/CommissionProposalForm";
import styles from "./studio-commissions.module.css";

export const metadata = {
  title: "Bespoke Commissions — Creator Studio",
  description: "Manage and quote bespoke handcrafted commission requests",
};

export default async function StudioCommissionsPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    return <div className={styles.empty}>Studio not found.</div>;
  }

  const requests = await prisma.customRequest.findMany({
    where: { creatorId: creator.id },
    include: {
      customer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Bespoke Commissions &amp; Projects</h1>
          <p className={styles.subtitle}>
            Review patron commission briefs, send custom quotations, and manage artisanal project milestones.
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className={styles.emptyCard}>
          <h2>No Commission Inquiries Yet</h2>
          <p>
            When collectors submit custom commission briefs through your studio storefront, they will appear here for review.
          </p>
        </div>
      ) : (
        <div className={styles.requestsGrid}>
          {requests.map((req) => {
            const createdDate = new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
            }).format(req.createdAt);

            const deadlineDate = req.deadline
              ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(req.deadline)
              : "Flexible";

            const budgetNum = req.budget ? parseFloat(req.budget.toString()) : null;
            const proposedNum = req.proposedPrice ? parseFloat(req.proposedPrice.toString()) : null;

            return (
              <div key={req.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <span className={styles.dateTag}>Received: {createdDate}</span>
                    <h3 className={styles.customerHeading}>
                      Inquiry from {req.customer.name} ({req.customer.email})
                    </h3>
                  </div>

                  <div className={styles.budgetMeta}>
                    {budgetNum ? (
                      <span className={styles.budgetValue}>
                        Patron Budget: ₹{budgetNum.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className={styles.flexibleBudget}>Budget: Open / Quote Needed</span>
                    )}
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.descSection}>
                    <h4>Project Brief</h4>
                    <p className={styles.descText}>{req.description}</p>
                  </div>

                  <div className={styles.specsRow}>
                    {req.preferredMedium && (
                      <div className={styles.specItem}>
                        <span>Medium</span>
                        <strong>{req.preferredMedium}</strong>
                      </div>
                    )}
                    {req.preferredSize && (
                      <div className={styles.specItem}>
                        <span>Dimensions</span>
                        <strong>{req.preferredSize}</strong>
                      </div>
                    )}
                    <div className={styles.specItem}>
                      <span>Target Deadline</span>
                      <strong>{deadlineDate}</strong>
                    </div>
                  </div>

                  {req.referenceImageUrl && (
                    <div className={styles.refImageWrap}>
                      <h4>Patron Reference Photo</h4>
                      <img
                        src={req.referenceImageUrl}
                        alt="Commission Reference"
                        className={styles.refImage}
                      />
                    </div>
                  )}

                  {/* Proposal Manager */}
                  <div className={styles.proposalSection}>
                    <CommissionProposalForm
                      requestId={req.id}
                      currentStatus={req.status}
                      initialProposedPrice={proposedNum}
                      initialEstimatedDays={req.estimatedDays}
                      initialNotes={req.creatorNotes}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
