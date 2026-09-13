"use client";

import React from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useCart } from "@/context/CartContext";
import styles from "./cart.module.css";

export default function CartPage() {
  const { items, removeItem, updateQuantity, itemCount, subtotal, isHydrated } = useCart();

  const formattedSubtotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(subtotal);

  // Complimentary insured shipping for orders over ₹10,000, else flat ₹500
  const shippingFee = subtotal > 10000 || subtotal === 0 ? 0 : 500;
  const formattedShipping = shippingFee === 0 ? "Complimentary" : "₹500";
  const grandTotal = subtotal + shippingFee;
  const formattedGrandTotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(grandTotal);

  if (!isHydrated) {
    return (
      <>
        <Nav />
        <main className={styles.main}>
          <div className="wrap">
            <div className={styles.loading}>Loading your curated bag...</div>
          </div>
        </main>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Nav />
        <main className={styles.main}>
          <div className="wrap">
            <div className={styles.emptyContainer}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <h1 className={styles.emptyTitle}>Your Bag is Empty</h1>
              <p className={styles.emptySubtitle}>
                You haven&apos;t added any artisanal artworks or unique handmade creations yet.
              </p>
              <Link href="/explore" className={styles.exploreBtn}>
                Discover Curated Works &rarr;
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          <div className={styles.header}>
            <h1 className={styles.title}>Shopping Bag</h1>
            <span className={styles.itemCountBadge}>
              {itemCount} {itemCount === 1 ? "Piece" : "Pieces"}
            </span>
          </div>

          <div className={styles.layout}>
            {/* Items List */}
            <div className={styles.itemsColumn}>
              <div className={styles.itemsList}>
                {items.map((item) => {
                  const isOriginal = item.productType === "ORIGINAL";
                  const itemTotal = item.price * item.quantity;
                  const formattedItemPrice = new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: item.currency || "INR",
                    maximumFractionDigits: 0,
                  }).format(itemTotal);

                  return (
                    <div key={item.id} className={styles.itemCard}>
                      <div className={styles.imageWrap}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className={styles.itemImage} />
                        ) : (
                          <div className={styles.noImage}>No Image</div>
                        )}
                      </div>

                      <div className={styles.itemDetails}>
                        <div className={styles.itemTopRow}>
                          <div>
                            <Link href={`/artwork/${item.slug || item.id}`} className={styles.itemTitle}>
                              {item.title}
                            </Link>
                            <div className={styles.artistAttribution}>
                              by{" "}
                              <Link href={`/creators/${item.creatorHandle}`} className={styles.artistLink}>
                                {item.creatorStore}
                              </Link>
                            </div>
                          </div>
                          <span className={styles.itemPrice}>{formattedItemPrice}</span>
                        </div>

                        <div className={styles.badgeRow}>
                          {isOriginal ? (
                            <span className={styles.originalBadge}>Unique 1/1 Original</span>
                          ) : (
                            <span className={styles.editionBadge}>Limited Artisan Craft</span>
                          )}
                        </div>

                        <div className={styles.itemBottomRow}>
                          <div className={styles.quantityControls}>
                            {isOriginal ? (
                              <span className={styles.singleQtyNote}>Qty: 1 (Unique Original)</span>
                            ) : (
                              <div className={styles.qtyPicker}>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className={styles.qtyBtn}
                                  aria-label="Decrease quantity"
                                >
                                  -
                                </button>
                                <span className={styles.qtyValue}>{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= (item.stock || 10)}
                                  className={styles.qtyBtn}
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className={styles.removeBtn}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.continueWrap}>
                <Link href="/explore" className={styles.continueLink}>
                  &larr; Continue Exploring Artworks
                </Link>
              </div>
            </div>

            {/* Summary Column */}
            <div className={styles.summaryColumn}>
              <div className={styles.summaryCard}>
                <h2 className={styles.summaryTitle}>Order Summary</h2>

                <dl className={styles.summaryBreakdown}>
                  <div className={styles.summaryRow}>
                    <dt>Subtotal</dt>
                    <dd>{formattedSubtotal}</dd>
                  </div>
                  <div className={styles.summaryRow}>
                    <dt>Insured Art Logistics</dt>
                    <dd className={shippingFee === 0 ? styles.complimentary : ""}>
                      {formattedShipping}
                    </dd>
                  </div>
                  <div className={styles.summaryRow}>
                    <dt>Estimated Tax &amp; GST</dt>
                    <dd>Included</dd>
                  </div>
                </dl>

                <div className={styles.totalRow}>
                  <span>Total</span>
                  <span className={styles.totalAmount}>{formattedGrandTotal}</span>
                </div>

                <Link href="/checkout" className={styles.checkoutBtn}>
                  Proceed to Checkout &rarr;
                </Link>

                <div className={styles.guaranteeBox}>
                  <div className={styles.guaranteeItem}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Secure encrypted checkout &bull; Stripe Verified</span>
                  </div>
                  <div className={styles.guaranteeItem}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>Direct-from-studio insured transit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
