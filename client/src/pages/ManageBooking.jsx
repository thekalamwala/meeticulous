import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Calendar, Clock, Video, MapPin, CheckCircle2, XCircle, AlertTriangle, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import { getManageBooking, cancelManageBooking, payManageBooking, verifyPayment } from "../services/api";
import loadRazorpay from "../utils/loadRazorpay";
import PetalSpinner from "../components/common/PetalSpinner";

// /manage-booking/:token — public, token-authorized self-service for anonymous
// (no-session) guests (MF3 #516). View + cancel exactly one booking. Reschedule
// via link is a deliberate follow-up; guests are pointed at support for now.

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";

const StatusPill = ({ status }) => {
  const map = {
    confirmed: ["Confirmed", "bg-green-100 text-green-800"],
    pending:   ["Pending payment", "bg-amber-100 text-amber-800"],
    cancelled: ["Cancelled", "bg-red-100 text-red-700"],
    completed: ["Completed", "bg-gray-100 text-gray-700"],
    no_show:   ["Missed", "bg-gray-100 text-gray-700"],
  };
  const [label, cls] = map[status] || [status, "bg-gray-100 text-gray-700"];
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
};

export default function ManageBooking() {
  const { token } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let alive = true;
    getManageBooking(token)
      .then(({ data }) => { if (alive) setBooking(data); })
      .catch((err) => { if (alive) setError(err.response?.data?.message || "This link is invalid or has expired."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  // F7: finish paying for this booking straight from the link (the abandoned-
  // payment recovery email lands here). Token possession authorizes it server-side.
  const onPay = async () => {
    if (paying) return;
    setPaying(true);
    const loaded = await loadRazorpay();
    if (!loaded) {
      toast.error("Payment gateway failed to load. Please try again.");
      setPaying(false);
      return;
    }
    try {
      const { data: order } = await payManageBooking(token);
      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "Meeticulous",
        description: booking.service_title || "Booking",
        order_id: order.razorpay_order_id,
        handler: async (response) => {
          try {
            const { data } = await verifyPayment({
              booking_id: booking.id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            setBooking((prev) => ({ ...prev, ...(data?.booking || {}), status: "confirmed", payment_status: "paid" }));
            toast.success("Payment successful — your booking is confirmed!");
          } catch (e) {
            // The webhook/reconciler will still finalize; tell the guest it's in hand.
            toast.success("Payment received — confirming your booking now.");
            try { const { data } = await getManageBooking(token); setBooking(data); } catch (_) { /* keep current */ }
          } finally {
            setPaying(false);
          }
        },
        prefill: { name: booking.guest_name || "" },
        modal: {
          ondismiss: () => {
            setPaying(false);
            toast("Payment cancelled — you can finish whenever you're ready.", { icon: "🫤" });
          },
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        setPaying(false);
        toast.error(resp?.error?.description || "Payment failed — please try again.");
      });
      rzp.open();
    } catch (err) {
      setPaying(false);
      if (err.response?.data?.code === "BILLING_STATE_REQUIRED") {
        toast.error("We need your billing state to issue the invoice — please finish from your original booking link.");
      } else {
        toast.error(err.response?.data?.message || "Couldn't start payment. Please try again.");
      }
    }
  };

  const onCancel = async () => {
    if (!window.confirm("Cancel this booking? This can't be undone.")) return;
    setCancelling(true);
    try {
      const { data } = await cancelManageBooking(token);
      setBooking(data);
      toast.success("Booking cancelled");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel. Please try again or contact support.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-12 sm:py-16">
      <h1 className="text-2xl font-bold text-ink">Manage your booking</h1>

      {loading ? (
        <div className="py-16 text-center">
          <PetalSpinner size={40} />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-3 font-semibold text-red-800">{error}</p>
          <p className="mt-1 text-sm text-red-600">
            Need help? Email{" "}
            <a href="mailto:bolt@meeticulous.in" className="font-medium underline">bolt@meeticulous.in</a>.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5 rounded-2xl border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-gray-900">{booking.service_title || "Your booking"}</p>
              {booking.host_name && <p className="text-sm text-gray-500">with {booking.host_name}</p>}
            </div>
            <StatusPill status={booking.status} />
          </div>

          <div className="space-y-2.5 border-t pt-4 text-sm text-gray-700">
            <p className="flex items-center gap-2"><Calendar size={16} className="text-gray-400" /> {fmtDate(booking.scheduled_at)}</p>
            <p className="flex items-center gap-2"><Clock size={16} className="text-gray-400" /> {fmtTime(booking.scheduled_at)}</p>
            {booking.meeting_mode === "offline" && booking.location && (
              <p className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" />
                <span>
                  {booking.location}
                  {booking.map_link && (
                    <> · <a href={booking.map_link} target="_blank" rel="noreferrer" className="font-medium text-[#960D32] underline">Directions</a></>
                  )}
                </span>
              </p>
            )}
            {booking.meeting_mode !== "offline" && booking.meeting_link && (
              <p className="flex items-center gap-2">
                <Video size={16} className="text-gray-400" />
                <a href={booking.meeting_link} target="_blank" rel="noreferrer" className="font-medium text-[#960D32] underline">Join link</a>
              </p>
            )}
          </div>

          {booking.status === "cancelled" ? (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              <CheckCircle2 size={16} className="text-gray-400" /> This booking has been cancelled.
            </div>
          ) : booking.cancellable ? (
            <div className="border-t pt-4">
              {booking.payment_status !== "paid" && booking.status === "pending" && (
                <div className="mb-3">
                  <button
                    onClick={onPay}
                    disabled={paying}
                    className="btn flex w-full items-center justify-center gap-2 rounded-xl bg-[#960D32] py-3 text-sm font-semibold text-white hover:bg-[#2A1416] disabled:opacity-60"
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard size={16} />}
                    {paying ? "Opening payment…" : "Complete payment"}
                  </button>
                  <p className="mt-2 text-center text-xs text-gray-500">
                    Your slot is held for you — finish paying to confirm it.
                  </p>
                </div>
              )}
              <button
                onClick={onCancel}
                disabled={cancelling}
                className="btn w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Cancel this booking"}
              </button>
              {booking.payment_status === "paid" && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Cancellations are generally non-refundable — refunds apply only in limited cases (e.g. host no-show). See our{" "}
                    <a href="/refund" target="_blank" rel="noreferrer" className="underline">Refund Policy</a>.
                  </span>
                </p>
              )}
              <p className="mt-3 text-center text-xs text-gray-400">
                Need to reschedule instead? Email{" "}
                <a href="mailto:bolt@meeticulous.in" className="underline">bolt@meeticulous.in</a>.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">This booking can no longer be changed.</div>
          )}
        </div>
      )}
    </main>
  );
}
