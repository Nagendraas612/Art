"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { useCart } from "@/context/CartContext";
import { processCheckout } from "@/app/actions/checkout";
import { usePincodeLookup } from "@/hooks/usePincodeLookup";
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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // The order created before the Razorpay modal opens. If the buyer cancels
  // the modal, this is their way back — guests never get an email (no
  // webhook fires on cancel), so without this link the order is stranded.
  const [pendingOrder, setPendingOrder] = useState<{
    orderNumber: string;
    guestAccessToken: string | null;
    cancelled: boolean;
  } | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);

  // Live insured-logistics quote from /api/shipping-quote: cheapest
  // Shiprocket rate per creator pickup location, summed. The server action
  // recomputes this independently at order time — this is display only.
  const [quote, setQuote] = useState<{ fee: number; live: boolean } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pincode -> city/state auto-fill for the delivery address.
  const pincodeLookup = usePincodeLookup(formData.postalCode);
  const [cityTouched, setCityTouched] = useState(false);
  const [stateTouched, setStateTouched] = useState(false);
  useEffect(() => {
    if (pincodeLookup.city && !cityTouched) {
      setFormData((prev) => ({ ...prev, city: pincodeLookup.city }));
    }
    if (pincodeLookup.state && !stateTouched) {
      setFormData((prev) => ({ ...prev, state: pincodeLookup.state }));
    }
  }, [pincodeLookup.city, pincodeLookup.state, cityTouched, stateTouched]);

  const fetchQuote = useCallback(async () => {
    const code = formData.postalCode.trim();
    // Server-side pinCodeSchema rejects leading-zero pincodes — match it
    // here so the quote doesn't fire for a code the server will refuse.
    if (!/^[1-9]\d{5}$/.test(code) || items.length === 0) {
      setQuote(null);
      setQuoteFailed(false);
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    setQuoteFailed(false);
    try {
      const res = await fetch("/api/shipping-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
          pincode: code,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { fee: number; live: boolean };
        setQuote({ fee: Math.round(Number(data.fee) || 0), live: !!data.live });
        setQuoteFailed(false);
      } else {
        setQuote(null);
        setQuoteFailed(true);
      }
    } catch {
      setQuote(null);
      setQuoteFailed(true);
    } finally {
      setQuoteLoading(false);
    }
  }, [formData.postalCode, items]);

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    const code = formData.postalCode.trim();
    if (!/^[1-9]\d{5}$/.test(code) || items.length === 0) {
      setQuote(null);
      setQuoteFailed(false);
      setQuoteLoading(false);
      return;
    }
    quoteTimer.current = setTimeout(() => {
      void fetchQuote();
    }, 600);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [formData.postalCode, items, fetchQuote]);

  const formatINR = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  const shippingFee = quote === null ? null : quote.fee;
  // If the live quote failed, the buyer may still proceed: the server
  // recomputes the fee authoritatively at order time. Show the subtotal as
  // the working total and label shipping honestly instead of dead-ending.
  const grandTotal = quoteFailed ? subtotal : shippingFee === null ? null : subtotal + shippingFee;

  const formattedSubtotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(subtotal);

  const formattedShipping =
    quoteLoading
      ? "Recalculating…"
      : quoteFailed
        ? "Calculated at order time"
        : shippingFee === null
          ? "Enter delivery pincode"
          : shippingFee === 0
            ? "Complimentary"
            : formatINR(shippingFee);

  const formattedGrandTotal =
    grandTotal === null ? "—" : formatINR(grandTotal);

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

    if (grandTotal === null) {
      setErrorMessage("Enter your 6-digit delivery pincode to calculate insured logistics.");
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
      });

      if (res.error || !("orderNumber" in res) || !res.orderNumber) {
        setErrorMessage(res.error || "Could not create your order. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Remember the order BEFORE the Razorpay modal opens — a modal cancel
      // fires no webhook and sends no email, so this state is the guest's
      // only way back to their pending order.
      setPendingOrder({
        orderNumber: res.orderNumber,
        guestAccessToken: res.guestAccessToken ?? null,
        cancelled: false,
      });
      setPriceNotice(null);

      // The server recomputes prices authoritatively. If a price moved
      // between bag and checkout (creator edit, edition sold out), say so
      // explicitly instead of silently charging a different number.
      if (typeof res.grandTotal === "number" && grandTotal !== null) {
        const serverTotal = Math.round(res.grandTotal);
        const shownTotal = Math.round(grandTotal);
        if (serverTotal !== shownTotal) {
          setPriceNotice(
            `The total was updated to ${formatINR(serverTotal)} (a price changed since you added items to your bag).`
          );
        }
      }

      if (res.razorpayOrderId) {
        // Initialize Razorpay Checkout. The key is the public key id only —
        // the secret never leaves the server.
        const RazorpayCtor = (window as any).Razorpay;
        if (!RazorpayCtor) {
          setErrorMessage("Payment gateway failed to load. Please refresh and try again.");
          setIsSubmitting(false);
          return;
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: Math.round(grandTotal * 100), // paise; the order's amount takes precedence
          currency: "INR",
          name: "Kalaa Bhadra",
          description: `Order ${res.orderNumber}`,
          order_id: res.razorpayOrderId,
          handler: async function (response: any) {
            // Verify the payment signature server-side before redirecting.
            // Guests carry their order token — without it the order page
            // would 404 for them.
            try {
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderNumber: res.orderNumber,
                }),
              });
              const verifyData = await verifyRes.json();
              if (verifyData.verified) {
                // Payment verified — the bag can go now. (Clearing it
                // earlier stranded guests who cancelled the modal.)
                clearCart();
                const tokenParam = res.guestAccessToken ? `?t=${res.guestAccessToken}&` : "?";
                router.push(`/orders/${res.orderNumber}${tokenParam}verified=1`);
              } else {
                setErrorMessage(verifyData.error || "Payment verification failed. Please try again.");
                setIsSubmitting(false);
              }
            } catch {
              setErrorMessage("Payment verification failed. Please try again.");
              setIsSubmitting(false);
            }
          },
          prefill: {
            name: formData.fullName,
            email: formData.email,
            contact: formData.phone,
          },
          theme: { color: "#1c1917" },
          modal: {
            ondismiss: function () {
              // No webhook fires on cancel, so no email goes out — the
              // pending-order link below is the guest's only way back.
              setPendingOrder((prev) =>
                prev ? { ...prev, cancelled: true } : prev
              );
              setIsSubmitting(false);
            },
          },
        };

        const rzp = new RazorpayCtor(options);
        rzp.on("payment.failed", function (resp: any) {
          console.error("Payment failed", resp.error);
          setErrorMessage(resp.error?.description || "Payment failed. Please try again.");
          setIsSubmitting(false);
        });
        rzp.open();
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
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
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
          {priceNotice && <div className={styles.noticeBanner}>{priceNotice}</div>}
          {pendingOrder?.cancelled && (
            <div className={styles.noticeBanner}>
              Payment was cancelled — no amount was charged. Your order{" "}
              <strong>#{pendingOrder.orderNumber}</strong> is saved.{" "}
              <Link
                href={`/orders/${pendingOrder.orderNumber}${pendingOrder.guestAccessToken ? `?t=${pendingOrder.guestAccessToken}` : ""}`}
                style={{ fontWeight: 700, textDecoration: "underline" }}
              >
                View your pending order to retry payment
              </Link>
            </div>
          )}
          {quoteFailed && !quoteLoading && (
            <div className={styles.noticeBanner}>
              We couldn&apos;t fetch live courier rates right now. You can still
              continue — the exact insured-logistics fee is calculated when
              your order is placed.{" "}
              <button
                type="button"
                onClick={() => void fetchQuote()}
                style={{ fontWeight: 700, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "inherit", padding: 0 }}
              >
                Retry
              </button>
            </div>
          )}

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
                    <label htmlFor="postalCode">Postal / ZIP Code *</label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="400001"
                      value={formData.postalCode}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setFormData((prev) => ({ ...prev, postalCode: digits }));
                        setCityTouched(false);
                        setStateTouched(false);
                      }}
                    />
                    {pincodeLookup.loading && (
                      <small className={styles.hint}>Looking up city &amp; state…</small>
                    )}
                    {pincodeLookup.error && (
                      <small className={styles.hint}>{pincodeLookup.error}</small>
                    )}
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
                      onChange={(e) => {
                        handleChange(e);
                        setCityTouched(true);
                      }}
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
                      onChange={(e) => {
                        handleChange(e);
                        setStateTouched(true);
                      }}
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
                  {/* Payment mode is decided server-side only. The gateway shown
                      here is informational; the client never selects it. */}
                  <div className={`${styles.paymentOption} ${styles.selectedOption}`}>
                    <div className={styles.paymentInfo}>
                      <div className={styles.paymentNameRow}>
                        <span className={styles.paymentName}>
                          Credit / Debit Card, UPI, Netbanking (Razorpay)
                        </span>
                      </div>
                      <p className={styles.paymentDesc}>
                        Secured by Razorpay. Supports all major cards, UPI apps, and netbanking.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <button
                type="submit"
                disabled={isSubmitting || grandTotal === null}
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
