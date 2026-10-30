import { useEffect, useState } from 'react';
import Modal from './Modal';
import { getAvailableSlots, rescheduleBooking, createRescheduleFeeOrder } from '../../services/api';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import loadRazorpay from '../../utils/loadRazorpay';
import toast from 'react-hot-toast';

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export default function RescheduleModal({ open, booking, onClose, onDone }) {
  const host = booking['profiles!bookings_host_id_fkey'] || booking.profiles || {};
  const svc = booking.services || {};
  const count = Number(booking.reschedule_count) || 0;
  const vendorFee = Number(host.reschedule_fee) || 0;
  const { on } = useFeatureFlags();
  const feeDue = (count >= 1 && on('reschedule_fee')) ? vendorFee : 0; // first reschedule free; server is authoritative

  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    setSlots(null); setPicked(null);
    getAvailableSlots(booking.host_id, svc.id || booking.service_id, date)
      .then(({ data }) => setSlots(Array.isArray(data?.slots) ? data.slots : []))
      .catch(() => setSlots([]));
  }, [date]);

  const confirm = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      let feeRefs = {};
      if (feeDue > 0) {
        feeRefs = await payFee(); // rejects with Error('cancelled') if dismissed
      }
      await rescheduleBooking(booking.id, { scheduled_at: picked, ...feeRefs });
      toast.success('Rescheduled');
      onDone?.(picked);
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error('That slot was just taken — pick another');
        getAvailableSlots(booking.host_id, svc.id || booking.service_id, date)
          .then(({ data }) => setSlots(Array.isArray(data?.slots) ? data.slots : []));
      } else if (err?.message !== 'cancelled') {
        toast.error(err?.response?.data?.message || 'Could not reschedule');
      }
    } finally {
      setBusy(false);
    }
  };

  // Razorpay checkout for the reschedule fee. Resolves with payment refs.
  const payFee = () => new Promise(async (resolve, reject) => {
    try {
      const ok = await loadRazorpay();
      if (!ok) return reject(new Error('Could not load payment SDK'));
      const { data } = await createRescheduleFeeOrder(booking.id);
      const rzp = new window.Razorpay({
        key: data.key,
        order_id: data.razorpay_order_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Reschedule fee',
        handler: (r) => resolve({
          fee_order_id: data.razorpay_order_id,
          fee_payment_id: r.razorpay_payment_id,
          fee_signature: r.razorpay_signature,
        }),
        modal: { ondismiss: () => reject(new Error('cancelled')) },
      });
      rzp.open();
    } catch (e) { reject(e); }
  });

  return (
    <Modal open={open} title="Reschedule booking" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-3">
        Currently: {new Date(booking.scheduled_at).toLocaleString('en-IN')}
        {feeDue > 0 && <> · <span className="text-[#960D32] font-medium">₹{feeDue} fee applies</span></>}
        {count === 0 && vendorFee > 0 && <> · <span className="text-green-600">first reschedule free</span></>}
      </p>
      <label className="block text-sm font-medium mb-1" htmlFor="resched-date">New date</label>
      <input data-testid="resched-date" id="resched-date" type="date" className="fb-input mb-3"
        value={date} min={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setDate(e.target.value)} />
      {date && (
        slots === null ? <p className="text-sm text-gray-400">Loading slots…</p>
        : slots.length === 0 ? <p className="text-sm text-gray-400">No slots — try another date.</p>
        : <div className="grid grid-cols-3 gap-2 mb-4">
            {slots.map((s) => (
              <button key={s} type="button" onClick={() => setPicked(s)}
                className={`text-sm py-2 rounded-lg border ${picked === s ? 'bg-[#960D32] text-white border-[#960D32]' : 'border-gray-200'}`}>
                {fmtTime(s)}
              </button>
            ))}
          </div>
      )}
      <button type="button" onClick={confirm} disabled={!picked || busy}
        className="w-full bg-[#960D32] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
        {busy ? 'Working…' : feeDue > 0 ? `Pay ₹${feeDue} & Confirm` : 'Confirm reschedule'}
      </button>
    </Modal>
  );
}
