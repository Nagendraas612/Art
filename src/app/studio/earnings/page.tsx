import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import styles from "./earnings.module.css";

export default async function StudioEarningsPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    return <div className={styles.empty}>Studio not found.</div>;
  }

  const earnings = await prisma.creatorEarning.findMany({
    where: { creatorId: creator.id },
    include: {
      payout: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const orderItems = await prisma.orderItem.findMany({
    where: { creatorId: creator.id },
    include: {
      order: true,
    },
  });

  const totalGross = orderItems.reduce(
    (acc, curr) => acc + parseFloat(curr.lineTotal.toString()),
    0
  );

  const totalNet = earnings.reduce(
    (acc, curr) => acc + parseFloat(curr.amount.toString()),
    0
  );

  const totalCommission = totalGross - totalNet;

  const paidOut = earnings
    .filter((e) => e.isPaidOut)
    .reduce((acc, curr) => acc + parseFloat(curr.amount.toString()), 0);

  const pendingPayout = totalNet - paidOut;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Earnings &amp; Studio Financials</h1>
          <p className={styles.subtitle}>
            Transparent ledger of your studio sales, platform commission, and direct payouts.
          </p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Net Studio Sales</span>
          <div className={styles.metricValue}>
            ₹{totalNet.toLocaleString("en-IN")}
          </div>
          <span className={styles.metricSub}>90% artist revenue share</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Pending Settlement</span>
          <div className={`${styles.metricValue} ${styles.pendingVal}`}>
            ₹{pendingPayout.toLocaleString("en-IN")}
          </div>
          <span className={styles.metricSub}>Next settlement cycle: Friday</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Settled &amp; Paid</span>
          <div className={`${styles.metricValue} ${styles.paidVal}`}>
            ₹{paidOut.toLocaleString("en-IN")}
          </div>
          <span className={styles.metricSub}>Direct NEFT / IMPS transfer</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Platform Fees (10%)</span>
          <div className={styles.metricValue}>
            ₹{totalCommission.toLocaleString("en-IN")}
          </div>
          <span className={styles.metricSub}>Covers hosting &amp; payment fees</span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className={styles.ledgerCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Artisanal Sales Ledger</h2>
          <span className={styles.ledgerCount}>{earnings.length} Transactions</span>
        </div>

        {earnings.length === 0 ? (
          <div className={styles.emptyTable}>
            <p>No sales transactions recorded yet.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order Reference</th>
                  <th>Sale Amount</th>
                  <th>Platform Fee (10%)</th>
                  <th>Net Studio Payout</th>
                  <th>Payout Status</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item) => {
                  const gross = parseFloat(item.lineTotal.toString());
                  const fee = parseFloat(item.platformCommission.toString());
                  const net = parseFloat(item.creatorAmount.toString());

                  const txDate = new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                  }).format(item.order.createdAt);

                  return (
                    <tr key={item.id} className={styles.tr}>
                      <td>{txDate}</td>
                      <td>
                        <div className={styles.orderRefCol}>
                          <strong>{item.order.orderNumber}</strong>
                          <span className={styles.itemTitle}>{item.titleSnapshot}</span>
                        </div>
                      </td>
                      <td>₹{gross.toLocaleString("en-IN")}</td>
                      <td className={styles.feeCell}>-₹{fee.toLocaleString("en-IN")}</td>
                      <td className={styles.netCell}>
                        <strong>₹{net.toLocaleString("en-IN")}</strong>
                      </td>
                      <td>
                        <span className={styles.statusPending}>
                          Queued for Settlement
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
