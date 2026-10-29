import { useState, useEffect } from 'react';
import Modal from './Modal';
import { createReview, updateReview } from '../../services/api';
import toast from 'react-hot-toast';

export default function ReviewModal({ open, booking, onClose, onDone, direction = 'guest_to_host', existing = null }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRating(existing?.rating || 0);
    setComment(existing?.comment || '');
  }, [existing]);

  const isEdit = !!existing;
  const isHostReviewing = direction === 'host_to_guest';
  const title = isEdit ? 'Edit your review' : (isHostReviewing ? 'Review your guest' : 'Leave a review');
  const subjectName = isHostReviewing
    ? (booking?.guest_name || 'your guest')
    : (booking?.['profiles!bookings_host_id_fkey']?.name || booking?.profiles?.name || 'your host');

  const submit = async () => {
    if (rating < 1) { toast.error('Pick a rating'); return; }
    setBusy(true);
    try {
      const { data } = isEdit
        ? await updateReview(booking.id, { rating, comment })
        : await createReview({ booking_id: booking.id, rating, comment, direction });
      toast.success(isEdit ? 'Review updated' : 'Thanks for the review!');
      onDone?.(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not submit review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-gray-500 mb-3">How was your experience with {subjectName}?</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`rate ${n}`} onClick={() => setRating(n)}
            className={`text-2xl ${n <= rating ? 'text-[#2E1065]' : 'text-gray-300'}`}>★</button>
        ))}
      </div>
      <textarea className="fb-input mb-4" rows={3} placeholder="Optional comment"
        value={comment} onChange={(e) => setComment(e.target.value)} />
      <button type="button" onClick={submit} disabled={busy}
        className="w-full bg-[#2E1065] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
        {busy ? 'Saving…' : (isEdit ? 'Update review' : 'Submit review')}
      </button>
    </Modal>
  );
}
