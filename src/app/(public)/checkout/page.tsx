"use client";

import React, { useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { useCart } from "@/context/CartContext";
import { processCheckout } from "@/app/actions/checkout";
import styles from "./checkout.module.css";

export default function CheckoutPage() {
  const { items, subtotal, isHydrated, clearCart } = useCart();
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    paymentMethod: "SANDBOX" as "SANDBOX" | "CASHFREE",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shippingFee = subtotal > 10000 || subtotal === 0 ? 0 : 500;
  const grandTotal = subtotal + shippingFee;

  const formattedSubtotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(subtotal);

  const formattedShipping = shippingFee === 0 ? "Complimentary" : "₹500";

  const formattedGrandTotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(grandTotal);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (items.length === 0) {
      setErrorMessage("Your bag is empty. Please add artworks before checkout.");
      return;
    }

    if (!formData.fullName || !formData.email || !formData.phone) {
      setErrorMessage("Please complete all contact details.");
      return;
    }

    if (!formData.line1 || !formData.city || !formData.state || !formData.postalCode) {
      setErrorMessage("Please complete all required shipping address fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await processCheckout({
        items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        customer: {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        },
        shippingAddress: {
          line1: formData.line1,
          line2: formData.line2,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
        },
        paymentMethod: formData.paymentMethod,
      });

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      // Clear local cart on success
      clearCart();

      if (res.paymentSessionId) {
        // Initialize Cashfree Checkout
        const cashfree = await (window as any).Cashfree({ mode: "sandbox" }); // or production based on env
        
        let checkoutOptions = {
          paymentSessionId: res.paymentSessionId,
          redirectTarget: "_modal",
        };

        cashfree.checkout(checkoutOptions).then(function (result: any) {
          if (result.error) {
            console.error("Payment failed", result.error);
            setErrorMessage(result.error.message || "Payment failed. Please try again.");
          }
          if (result.redirect) {
            console.log("Payment will be redirected");
          }
          if (result.paymentDetails) {
            console.log("Payment has been completed, Check for Payment Status");
            // Verify payment and redirect
            router.push(`/orders/${res.orderNumber}?success=true`);
          }
        });
      } else if (res.redirectUrl) {
        // Redirect to local confirmation page
        router.push(res.redirectUrl);
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setErrorMessage(err.message || "Something went wrong while processing your order.");
      setIsSubmitting(false);
    }
  };

  if (!isHydrated) {
    return (
      <>
        <Nav />
        <main className={styles.main}>
          <div className="wrap">
            <div className={styles.loading}>Loading secure checkout...</div>
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
            <div className={styles.emptyCard}>
              <h2>No items to checkout</h2>
              <p>Your shopping bag is currently empty.</p>
              <Link href="/explore" className={styles.btnSecondary}>
                Explore Artworks &rarr;
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="lazyOnload" />
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          <div className={styles.header}>
            <Link href="/cart" className={styles.backLink}>
              &larr; Return to Shopping Bag
            </Link>
            <h1 className={styles.title}>Secure Checkout</h1>
          </div>

          {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}

          <form onSubmit={handleSubmit} className={styles.checkoutLayout}>
            {/* Left Form Column */}
            <div className={styles.formColumn}>
              {/* Contact Details */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.stepNumber}>1</span>
                  <h2 className={styles.sectionTitle}>Contact Information</h2>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.fullWidth}>
                    <label htmlFor="fullName">Full Name *</label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      required
                      placeholder="e.g. Maya Chen"
                      value={formData.fullName}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label htmlFor="email">Email Address *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      placeholder="maya@example.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label htmlFor="phone">Phone Number *</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </section>

              {/* Shipping Address */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.stepNumber}>2</span>
                  <h2 className={styles.sectionTitle}>Delivery Destination</h2>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.fullWidth}>
                    <label htmlFor="line1">Street Address *</label>
                    <input
                      type="text"
                      id="line1"
                      name="line1"
                      required
                      placeholder="House/Apartment #, Street name"
                      value={formData.line1}
                      onChange={handleChange}
                    />
                  </div>

                  <div className={styles.fullWidth}>
                    <label htmlFor="line2">Apartment, Suite, Landmark (Optional)</label>
                    <input
                      type="text"
                      id="line2"
                      name="line2"
                      placeholder="Suite 4B, near Art District"
                      value={formData.line2}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label htmlFor="city">City *</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      required
                      placeholder="e.g. Mumbai"
                      value={formData.city}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label htmlFor="state">State / Province *</label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      required
                      placeholder="e.g. Maharashtra"
                      value={formData.state}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label htmlFor="postalCode">Postal / ZIP Code *</label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      required
                      placeholder="400001"
                      value={formData.postalCode}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label htmlFor="country">Country</label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </section>

              {/* Payment Method Selection */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.stepNumber}>3</span>
                  <h2 className={styles.sectionTitle}>Payment Method</h2>
                </div>

                <div className={styles.paymentMethods}>
                  <label
                    className={`${styles.paymentOption} ${
                      formData.paymentMethod === "SANDBOX" ? styles.selectedOption : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="SANDBOX"
                      checked={formData.paymentMethod === "SANDBOX"}
                      onChange={handleChange}
                    />
                    <div className={styles.paymentInfo}>
                      <div className={styles.paymentNameRow}>
                        <span className={styles.paymentName}>
                          Atelier Sandbox Simulator (1-Click Test Checkout)
                        </span>
                        <span className={styles.recommendedBadge}>Dev Recommended</span>
                      </div>
                      <p className={styles.paymentDesc}>
                        Instant verification for local environments. Creates authentic database orders, updates stock, and generates fulfillment records without needing live Stripe cards.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`${styles.paymentOption} ${
                      formData.paymentMethod === "CASHFREE" ? styles.selectedOption : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="CASHFREE"
                      checked={formData.paymentMethod === "CASHFREE"}
                      onChange={handleChange}
                    />
                    <div className={styles.paymentInfo}>
                      <div className={styles.paymentNameRow}>
                        <span className={styles.paymentName}>
                          Credit / Debit Card, UPI, Netbanking (Cashfree Gateway)
                        </span>
                      </div>
                      <p className={styles.paymentDesc}>
                        Secured by Cashfree Payments. Supports all major cards, UPI apps, and netbanking.
                      </p>
                    </div>
                  </label>
                </div>
              </section>

              <button
                type="submit"
                disabled={isSubmitting}
                className={styles.submitOrderBtn}
              >
                {isSubmitting ? (
                  <span>Processing Order...</span>
                ) : (
                  <span>
                    Confirm &amp; Place Order &bull; {formattedGrandTotal}
                  </span>
                )}
              </button>
            </div>

            {/* Right Summary Column */}
            <div className={styles.summaryColumn}>
              <div className={styles.orderSummaryCard}>
                <h3 className={styles.summaryTitle}>In Your Bag</h3>

                <div className={styles.itemList}>
                  {items.map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      <div className={styles.itemThumbWrap}>
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt={item.title} className={styles.itemThumb} />
                        )}
                        <span className={styles.itemQtyBadge}>{item.quantity}</span>
                      </div>
                      <div className={styles.itemMeta}>
                        <h4 className={styles.itemTitle}>{item.title}</h4>
                        <span className={styles.itemCreator}>{item.creatorStore}</span>
                      </div>
                      <span className={styles.itemPrice}>
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: item.currency || "INR",
                          maximumFractionDigits: 0,
                        }).format(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.costBreakdown}>
                  <div className={styles.costRow}>
                    <span>Artworks Subtotal</span>
                    <span>{formattedSubtotal}</span>
                  </div>
                  <div className={styles.costRow}>
                    <span>Insured Logistics</span>
                    <span className={shippingFee === 0 ? styles.freeText : ""}>
                      {formattedShipping}
                    </span>
                  </div>
                  <div className={styles.costRow}>
                    <span>Taxes &amp; Studio Stamping</span>
                    <span>Included</span>
                  </div>
                  <div className={styles.grandTotalRow}>
                    <span>Total</span>
                    <span className={styles.grandTotalVal}>{formattedGrandTotal}</span>
                  </div>
                </div>

                <div className={styles.safeNotice}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>256-bit SSL encrypted &bull; Studio authenticity guaranteed</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
