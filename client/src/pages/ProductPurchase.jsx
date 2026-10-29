import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  getProductPublic,
  sendOtp,
  createProductOrder,
  verifyProductPayment,
  freeDownloadProduct,
  downloadProduct,
  resendProductLink,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { analytics, EVENTS, gaClientId } from "../services/analytics";
import useUtm from "../hooks/useUtm";
import { isValidHex } from "../utils/themeUtils";
import { INDIAN_STATES } from "../lib/indianStates";
import { useMinimalFooter } from "../context/ChromeContext";
import loadRazorpay from "../utils/loadRazorpay";
import Seo from "../components/common/Seo";
import { SITE_URL } from "../utils/seo";
import toast from "react-hot-toast";

const TYPE_ICONS = {
  pdf: "📄",
  template: "🗂️",
  ebook: "📚",
  prompt_pack: "✨",
  resource: "🔗",
  other: "📦",
};
const TYPE_LABELS = {
  pdf: "PDF",
  template: "Template",
  ebook: "eBook",
  prompt_pack: "Prompt Pack",
  resource: "Resource",
  other: "Digital Product",
};

// Only treat http(s) URLs as navigable. Anything else (javascript:, data:, …)
// is rejected so a malicious stored URL can't be opened as a link.
const safeUrl = (url) =>
  /^https?:\/\//i.test(String(url || "")) ? url : null;

const ProductPurchase = () => {
  const { profileSlug: username, productId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  // Not-found state gets the stripped minimal footer, header kept.
  useMinimalFooter(!loading && !product);

  // step: 'details' | 'otp' | 'payment' | 'done'
  const [step, setStep] = useState("details");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  // Optional place-of-supply for the GST invoice on the platform fee.
  const [buyerState, setBuyerState] = useState("");
  const [gstin, setGstin] = useState("");
  const [otp, setOtp] = useState("");
  const [order, setOrder] = useState(null); // Razorpay order, created at the OTP step (paid)
  const utm = useUtm(); // first-touch ad attribution → carried into the paid conversion event
  const [otpSending, setOtpSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [downloadToken, setDownloadToken] = useState("");
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Lost-link recovery (re-issue a lapsed download link).
  const [resendOpen, setResendOpen] = useState(false);
  const [resendStage, setResendStage] = useState("idle"); // 'idle' | 'otp'
  const [resendOtp, setResendOtp] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    getProductPublic(username, productId)
      .then(({ data }) => setProduct(data))
      .catch(() => toast.error("Product not found"))
      .finally(() => setLoading(false));
  }, [productId, username]);

  // Deep link from the download email (?dl=<token>) jumps straight to download.
  useEffect(() => {
    const dl = searchParams.get("dl");
    if (dl) {
      setDownloadToken(dl);
      setStep("done");
    }
  }, [searchParams]);

  // Host accent — themes the purchase page like the rest of the host's profile,
  // instead of the old hardcoded indigo. Falls back to the brand orange.
  const accent = isValidHex(product?.profiles?.theme_color)
    ? product.profiles.theme_color
    : "#0079C1";
  // Platform fee comes from the server (never hardcoded here, so it can't drift
  // from what's actually charged).
  const fee = Number(product?.platform_fee ?? 0);
  const gst = Number(product?.platform_fee_gst ?? 0);
  const total = product
    ? (product.total != null ? Number(product.total) : Number(product.price) + fee + gst)
    : 0;

  const handleSendOtp = async () => {
    if (!name || !email || !phone) {
      toast.error("Name, email and mobile number are required");
      return;
    }
    setOtpSending(true);
    try {
      // WhatsApp-keyed OTP: send phone-first so the code is issued (and delivered
      // on WhatsApp) under the same identifier the server verifies against in
      // createProductOrder / freeDownload. (Email-keying here diverged from the
      // phone-first verify and broke the flow for anyone who entered a phone.)
      await sendOtp({ phone, name });
      toast.success("Verification code sent to your WhatsApp!");
      setStep("otp");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send code");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      if (product.price === 0) {
        // Free product — the server verifies the OTP itself (single-use) and
        // issues the download token only on a valid code.
        const { data } = await freeDownloadProduct({
          product_id: product.id,
          buyer_name: name,
          buyer_email: email,
          buyer_phone: phone,
          otp,
        });
        setDownloadToken(data.download_token);
        setStep("done");
        toast.success("Download ready!");
      } else {
        // Paid product — the OTP is verified server-side as part of order
        // creation, which also binds the verified buyer + the price-at-order
        // into the Razorpay order. No separate verify-OTP round trip.
        const { data } = await createProductOrder({
          product_id: product.id,
          buyer_name: name,
          buyer_email: email,
          buyer_phone: phone,
          buyer_state: buyerState,
          buyer_gstin: gstin,
          otp,
        });
        setOrder(data);
        setStep("payment");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handlePayment = async () => {
    const loaded = await loadRazorpay();
    if (!loaded) {
      toast.error("Payment gateway failed to load");
      return;
    }
    if (!order) {
      toast.error("Please verify your email first");
      setStep("details");
      return;
    }
    setPaymentLoading(true);
    try {
      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "Meeticulous",
        description: product.title,
        order_id: order.razorpay_order_id,
        handler: async (response) => {
          try {
            // The server reads the buyer + amount from the order it created, so
            // we only need to hand back the Razorpay payment proof.
            const { data } = await verifyProductPayment({
              product_id: product.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              ga_client_id: gaClientId(), // join server GA4 hit to this web session
            });
            setDownloadToken(data.download_token);
            setStep("done");
            toast.success("Payment successful!");
            // Browser-side conversion for retargeting. Server CAPI/MP is the
            // authoritative count; de-dupe on event_id = razorpay_payment_id.
            analytics.track(EVENTS.PRODUCT_PURCHASED, {
              product_id: product.id,
              value: Number(total) || 0, currency: "INR",
              event_id: response.razorpay_payment_id,
              transaction_id: response.razorpay_payment_id, // GA4 purchase de-dupe key
              ...utm,
            });
          } catch {
            toast.error("Payment verification failed. Contact support.");
          }
        },
        prefill: { name, email, contact: phone },
        theme: { color: accent },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            toast("Payment cancelled — you can try again when ready.", { icon: "🫤" });
          },
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        setPaymentLoading(false);
        toast.error(resp?.error?.description || "Payment failed — please try again.");
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to initiate payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data } = await downloadProduct(downloadToken);
      setDownloadInfo(data);
      const url = safeUrl(data.file_url);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Download link is invalid. Contact the seller.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  // ── Lost-link recovery ───────────────────────────────────────
  const handleResendStart = async () => {
    if (!email) {
      toast.error("Enter the email you purchased with");
      return;
    }
    setResending(true);
    try {
      await sendOtp({ email, name });
      setResendStage("otp");
      toast.success("Verification code sent to your email");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send code");
    } finally {
      setResending(false);
    }
  };

  const handleResendConfirm = async () => {
    if (resendOtp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setResending(true);
    try {
      const { data } = await resendProductLink({
        product_id: product.id,
        buyer_email: email,
        otp: resendOtp,
      });
      if (data.download_token) {
        setDownloadToken(data.download_token);
        setStep("done");
        toast.success("Download link restored!");
      } else {
        toast.success(data.message || "If a purchase exists, a link is on its way.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not resend link");
    } finally {
      setResending(false);
    }
  };

  if (loading)
    return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!product)
    return (
      <div className="text-center py-20 text-gray-400">Product not found</div>
    );

  const host = product.profiles;

  return (
    <div className="min-h-screen bg-canvas">
      <Seo
        title={`${product.title} — ${host?.name || "Meeticulous"}`}
        description={(product.description || `Buy ${product.title} from ${host?.name || "this creator"} on Meeticulous.`).slice(0, 160)}
        canonical={`${SITE_URL}/${username}/product/${productId}`}
        image={product.cover_image || host?.profile_image || undefined}
        robots="noindex"
      />
      <div className="app-container py-8 max-w-2xl">
        <Link
          to={`/${username}`}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to {host?.name}'s profile
        </Link>

        {/* Product card */}
        <div className="fb-card overflow-hidden mb-6">
          {product.thumbnail_url && (
            <div className="aspect-[16/9] w-full">
              <img
                src={product.thumbnail_url}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">
                    {TYPE_ICONS[product.type] || "📦"}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    {TYPE_LABELS[product.type]}
                  </span>
                </div>
                <h1 className="text-xl font-bold">{product.title}</h1>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold" style={{ color: accent }}>
                  {product.price === 0 ? "Free" : `₹${product.price}`}
                </p>
                {product.price > 0 && fee > 0 && (
                  <p className="text-xs text-gray-400">+ ₹{fee} platform fee + GST</p>
                )}
              </div>
            </div>
            {product.description && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {product.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              {host?.profile_image ? (
                <img
                  src={host.profile_image}
                  alt={host.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${accent}1A`, color: accent }}
                >
                  {host?.name?.charAt(0)}
                </div>
              )}
              <p className="text-sm text-gray-500">
                by{" "}
                <span className="font-medium text-gray-700">{host?.name}</span>
              </p>
              <span className="text-xs text-gray-400 ml-auto">
                {product.purchase_count} sold
              </span>
            </div>
          </div>
        </div>

        {/* Purchase flow */}
        <div className="fb-card p-5 sm:p-6">
          {/* Step: details */}
          {step === "details" && (
            <>
              <h2 className="text-lg font-bold mb-4">
                {product.price === 0
                  ? "Get this for free"
                  : "Complete your purchase"}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="fb-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="fb-input"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Download link will be sent here
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      WhatsApp number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="fb-input"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Your verification code is sent to this number on WhatsApp.
                    </p>
                  </div>
                </div>
                {product.price > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-500">Product</span>
                      <span>₹{product.price}</span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Platform Fee (₹{fee} + GST)</span>
                        <span>₹{fee}</span>
                      </div>
                    )}
                    {gst > 0 && (
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">GST</span>
                        <span>₹{gst}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Total</span>
                      <span style={{ color: accent }}>₹{total}</span>
                    </div>
                  </div>
                )}

                {/* Optional place-of-supply for the GST invoice on the platform fee. */}
                {product.price > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        State <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <select
                        value={buyerState}
                        onChange={(e) => setBuyerState(e.target.value)}
                        className="fb-input"
                      >
                        <option value="">Select state</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s.code} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        GSTIN <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        placeholder="For a GST invoice"
                        className="fb-input"
                      />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleSendOtp}
                  disabled={otpSending || !name || !email}
                  className="btn w-full text-white py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: accent }}
                >
                  {otpSending ? "Sending..." : "Send OTP"}
                </button>

                {/* Lost-link recovery */}
                <div className="text-center pt-1">
                  {!resendOpen ? (
                    <button
                      type="button"
                      onClick={() => setResendOpen(true)}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Already purchased? Resend my download link
                    </button>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-left mt-2">
                      <p className="text-sm font-medium mb-2">Resend download link</p>
                      {resendStage === "idle" ? (
                        <>
                          <p className="text-xs text-gray-500 mb-3">
                            We'll email a fresh link to the address you bought with above.
                          </p>
                          <button
                            type="button"
                            onClick={handleResendStart}
                            disabled={resending || !email}
                            className="btn w-full text-white py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ background: accent }}
                          >
                            {resending ? "Sending..." : "Send verification code"}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500 mb-2">
                            Enter the 6-digit code sent to <strong>{email}</strong>
                          </p>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="000000"
                            className="fb-input text-center tracking-[0.4em] font-mono mb-3"
                            value={resendOtp}
                            onChange={(e) => setResendOtp(e.target.value.replace(/\D/g, ""))}
                          />
                          <button
                            type="button"
                            onClick={handleResendConfirm}
                            disabled={resending || resendOtp.length !== 6}
                            className="btn w-full text-white py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ background: accent }}
                          >
                            {resending ? "Verifying..." : "Verify & restore link"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <div className="text-center max-w-xs mx-auto">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: `${accent}1A` }}
              >
                <svg
                  className="w-7 h-7"
                  style={{ color: accent }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="font-bold mb-1">Check your email</h2>
              <p className="text-sm text-gray-500 mb-5">
                Code sent to <strong>{email}</strong>
              </p>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                autoFocus
                className="w-full border-2 rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] font-mono focus:outline-none mb-4"
                style={{ borderColor: "#e5e7eb" }}
                onFocus={(e) => (e.target.style.borderColor = accent)}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
              <button
                onClick={handleVerify}
                disabled={verifying || otp.length !== 6}
                className="btn w-full text-white py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: accent }}
              >
                {verifying
                  ? "Verifying..."
                  : product.price === 0
                    ? "Verify & Get Download"
                    : "Verify & Continue to Payment"}
              </button>
              <button
                onClick={handleSendOtp}
                className="mt-3 text-xs text-gray-400 hover:text-gray-600"
              >
                Resend code
              </button>
            </div>
          )}

          {/* Step: payment */}
          {step === "payment" && (
            <div className="text-center max-w-xs mx-auto">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: `${accent}1A` }}
              >
                <svg
                  className="w-7 h-7"
                  style={{ color: accent }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <h2 className="font-bold mb-1">Complete Payment</h2>
              <p className="text-sm text-gray-500 mb-5">
                You'll receive a secure download link after payment
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-left mb-5">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Product</span>
                  <span>₹{product.price}</span>
                </div>
                {fee > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Platform Fee (₹{fee} + GST)</span>
                    <span>₹{fee}</span>
                  </div>
                )}
                {gst > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">GST</span>
                    <span>₹{gst}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base pt-2 border-t">
                  <span>Total</span>
                  <span style={{ color: accent }}>₹{total}</span>
                </div>
              </div>
              <button
                onClick={handlePayment}
                disabled={paymentLoading}
                className="btn w-full text-white py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: accent }}
              >
                {paymentLoading
                  ? "Opening payment..."
                  : `Pay ₹${total} with Razorpay`}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                UPI · Card · Wallet accepted
              </p>
            </div>
          )}

          {/* Step: done */}
          {step === "done" && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-green-700 mb-1">
                {product.price === 0 ? "You got it!" : "Purchase Complete!"}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {downloadInfo
                  ? `${downloadInfo.downloads_remaining} download${downloadInfo.downloads_remaining !== 1 ? "s" : ""} remaining`
                  : "Ready to download"}
              </p>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn w-full bg-gray-900 text-white py-3 text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {downloading ? "Opening..." : `Download ${product.title}`}
              </button>
              <p className="text-xs text-gray-400">
                Link expires in 24 hours · Max 3 downloads · A copy has been
                sent to {email || "your email"}
              </p>
              <Link
                to={`/${username}`}
                className="block mt-4 text-sm hover:underline"
                style={{ color: accent }}
              >
                Back to {host?.name}'s profile
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPurchase;
