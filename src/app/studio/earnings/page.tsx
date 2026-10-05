import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { OrderStatus } from "@prisma/client";
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

  // Refund state per order: a cancelled order is "refund pending" until the
  // refund is actually settled — the old label claimed "refunded" as fact.
  const refunds = await prisma.refund.findMany({
    where: { orderId: { in: orderItems.map((i) => i.orderId) } },
    select: { orderId: true, status: true },
  });
  const refundByOrderId = new Map(refunds.map((r) => [r.orderId, r.status]));

  // Cancelled orders must not inflate gross sales: their earnings rows were
  // deleted at cancellation, so including their line totals would overstate
  // both gross and the implied platform fee. They stay visible in the ledger
  // with an explicit Cancelled state instead of vanishing or pretending to
  // await payment.
  const activeItems = orderItems.filter((i) => i.order.status !== OrderStatus.CANCELLED);

  const totalGross = activeItems.reduce(
    (acc, curr) => acc + parseFloat(curr.lineTotal.toString()),
    0
  );

  const totalNet = earnings.reduce(
    (acc, curr) => acc + parseFloat(curr.amount.toString()),
    0
  );

  // Sum the platform fee actually booked per line item — never derive it as
  // gross − net, because the two sums come from different row sets (active
  // items vs earning ledger rows) and the arithmetic lied.
  const totalCommission = activeItems.reduce(
    (acc, curr) => acc + parseFloat(curr.platformCommission.toString()),
    0
  );

  const paidOut = earnings
    .filter((e) => e.isPaidOut)
    .reduce((acc, curr) => acc + parseFloat(curr.amount.toString()), 0);

  const pendingPayout = totalNet - paidOut;

  // Honest per-row payout status: an order item's earning row tells whether
  // the studio has actually been paid for it (never hardcode one status).
  const earningByOrderItemId = new Map(earnings.map((e) => [e.orderItemId, e]));

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
          <span className={styles.metricSub}>Settled by the Kalaa Bhadra team after each sale</span>
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
                  <th>Platform Fee</th>
                  <th>Net Studio Payout</th>
                  <th>Payout Status</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item) => {
                  const gross = parseFloat(item.lineTotal.toString());
                  const fee = parseFloat(item.platformCommission.toString());
                  const net = parseFloat(item.creatorAmount.toString());
                  const earning = earningByOrderItemId.get(item.id);

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
                        {item.order.status === OrderStatus.CANCELLED ? (
                          <span className={styles.statusCancelled}>
                            {refundByOrderId.get(item.orderId) === "COMPLETED"
                              ? "Cancelled — refunded"
                              : "Cancelled — refund pending"}
                          </span>
                        ) : earning?.isPaidOut ? (
                          <span className={styles.statusPaid}>
                            Settled{earning.payout?.settlementReference ? ` (Ref ${earning.payout.settlementReference})` : ""}
                          </span>
                        ) : earning ? (
                          <span className={styles.statusPending}>
                            Queued for Settlement
                          </span>
                        ) : (
                          <span className={styles.statusPending}>
                            Awaiting Payment Confirmation
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Payout history: money actually transferred to the studio, latest first */}
        {(() => {
          const settled = earnings
            .filter((e) => e.isPaidOut)
            .sort((a, b) => +new Date(b.payout?.processedAt || b.createdAt) - +new Date(a.payout?.processedAt || a.createdAt));
          if (settled.length === 0) return null;
          return (
            <div style={{ marginTop: 32 }}>
              <div className={styles.ledgerHeader}>
                <h2 className={styles.ledgerTitle}>Payout History</h2>
                <span className={styles.ledgerCount}>{settled.length} payouts</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settled.map((e) => (
                      <tr key={e.id} className={styles.tr}>
                        <td>
                          {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                            new Date(e.payout?.processedAt || e.createdAt)
                          )}
                        </td>
                        <td>{e.payout?.settlementReference || e.orderItemId || "—"}</td>
                        <td className={styles.netCell}>
                          <strong>₹{parseFloat(e.amount.toString()).toLocaleString("en-IN")}</strong>
                        </td>
                        <td>{e.payout?.status ? String(e.payout.status).replace(/_/g, " ") : "Settled"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
