// BookingDetail — one booking, readable at a glance (Kept, founder call 2026-11-25).
// The pattern hosts know from Calendly / Google Calendar event details: who, when,
// how to reach them, what they paid (in the header), what they wrote. Opens from Today in the side
// drawer; the Bookings page is meant to reuse it.
//
// Display only. Same data the list already loaded and plain links (Meet, WhatsApp,
// tel:, mailto:). Nothing here confirms, reschedules, cancels or refunds a booking:
// those flows stay on the Bookings page, behind their own checks.
import { ArrowRight, CalendarClock, Mail, Phone } from 'lucide-react';
import { cn, fmtTime, inr, relDay, StatusPill, MeetIcon, WhatsAppIcon } from './ui/v2';

const lower = (v) => String(v || '').toLowerCase();
const amountOf = (b) => Number(b.customer_total ?? b.amount ?? 0) || 0;
// Same clock as the rest of Today: start + the service's duration. end_at is only a
// fallback, so this panel never disagrees with the schedule card it opened from.
const endOf = (b) => {
  const start = new Date(b.scheduled_at).getTime();
  const dur = Number(b.services?.duration);
  if (dur) return new Date(start + dur * 60_000);
  return b.end_at ? new Date(b.end_at) : new Date(start + 30 * 60_000);
};
const waLink = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d ? `https://wa.me/${d}` : null; };
const dayLong = (iso) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']; const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// Pure, tested: the one line that says where this booking stands right now.
export const bookingPhaseLine = (b, now = new Date()) => {
  if (lower(b.status) === 'cancelled') return 'Cancelled';
  const start = new Date(b.scheduled_at);
  const end = endOf(b);
  if (start <= now && end > now) return `On now · until ${fmtTime(end.toISOString())}`;
  if (end <= now) return `Done · ${relDay(b.scheduled_at)}`;
  const mins = Math.round((start - now) / 60_000);
  if (mins < 60) return `Starts in ${mins} min`;
  return `Coming up · ${relDay(b.scheduled_at)}`;
};

// Pure, tested: which visit this is for the guest, from the bookings already loaded.
export const guestVisit = (b, bookings = []) => {
  const same = (x) => (b.guest_id && x.guest_id === b.guest_id)
    || (!b.guest_id && b.guest_email && lower(x.guest_email) === lower(b.guest_email));
  const mine = bookings.filter((x) => same(x) && lower(x.status) !== 'cancelled')
    .sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
  const i = mine.findIndex((x) => x.id === b.id);
  if (i < 0 || mine.length < 2) return 'First booking with you';
  return `${ordinal(i + 1)} booking with you · ${mine.length} in all`;
};

const Chip = ({ children }) => <span className="inline-flex items-center rounded-[8px] bg-white/[0.12] px-2.5 py-1 text-[13px] text-white">{children}</span>;
const Card = ({ title, children }) => (
  <section className="rounded-[20px] bg-white p-4 sm:p-5">
    <h3 className="mb-3 font-display text-[16px] font-bold tracking-[-0.02em] text-ink">{title}</h3>
    {children}
  </section>
);
const Row = ({ icon: Icon, children, href }) => {
  const body = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-pink-100 text-maroon"><Icon className="h-[18px] w-[18px]" strokeWidth={2} /></span>
      <span className="min-w-0 flex-1">{children}</span>
    </>
  );
  return href
    ? <a href={href} className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-1.5 transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">{body}</a>
    : <div className="flex items-center gap-3 py-1.5">{body}</div>;
};
const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';

export const BookingDetailFooter = ({ onAll }) => (
  <button type="button" onClick={onAll} className={cn(btn, 'w-full bg-cream text-maroon hover:bg-blush')}>
    Open in Bookings <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
  </button>
);

export default function BookingDetail({ booking: b, bookings = [], now = new Date() }) {
  const start = new Date(b.scheduled_at);
  const end = endOf(b);
  const isToday = start.toDateString() === now.toDateString();
  const done = end <= now;
  const cancelled = lower(b.status) === 'cancelled';
  const wa = waLink(b.guest_phone || b.profiles?.phone);
  const email = b.guest_email || b.profiles?.email;
  const phone = b.guest_phone || b.profiles?.phone;
  const amount = amountOf(b);
  const discount = Number(b.discount_amount) || 0;
  const refunded = Number(b.refunded_amount) || 0;
  const mins = Math.round((end - start) / 60_000);
  const mode = lower(b.services?.meeting_mode);
  const canJoin = b.meeting_link && !done && !cancelled;
  const payWord = { paid: 'Paid', unpaid: 'Unpaid', refunded: 'Refunded', pending: 'Payment pending', failed: 'Payment failed' }[lower(b.payment_status)];
  const payLabel = amount ? `${inr(amount)}${payWord ? ` · ${payWord}` : ''}` : 'Free';
  const payNotes = [
    amount > 0 && b.paid_at && `Paid ${dayShort(b.paid_at)}`,
    discount > 0 && `${inr(discount)} off with a discount code`,
    refunded > 0 && `${inr(refunded)} refunded${b.refunded_at ? ` on ${dayShort(b.refunded_at)}` : ''}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      {/* Header card: the booking in one look, maroon like the focal band it came from. */}
      <section className="relative isolate overflow-hidden rounded-[24px] bg-maroon-700 p-5 text-white">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-50"
          style={{ backgroundImage: 'url(/brand/ds/03-patterns/mt-pattern-loop-on-maroon.svg)', backgroundSize: '180px' }} />
        <p className="mb-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-pink">{bookingPhaseLine(b, now)}</p>
        <h3 className="mb-0 mt-2 font-display text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white">
          {b.guest_name || 'Guest'} <em className="font-serif font-normal italic text-pink">at {fmtTime(b.scheduled_at)}</em>
        </h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>{b.services?.title || 'Booking'}</Chip>
          {mins > 0 && <Chip>{mins} min</Chip>}
          {!isToday && <Chip>{dayShort(b.scheduled_at)}</Chip>}
          {mode && <Chip>{mode === 'online' ? 'Online' : mode === 'offline' || mode === 'in_person' ? 'In person' : mode}</Chip>}
          {/* Payment lives in the header (founder call, 2026-11-25): amount and its state. */}
          <Chip>{payLabel}</Chip>
        </div>
        {payNotes.length > 0 && <p className="mb-0 mt-2 text-[13px] text-white/75">{payNotes.join(' · ')}</p>}
        {(canJoin || wa) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canJoin && (
              <a href={b.meeting_link} target="_blank" rel="noreferrer" className={cn(btn, 'bg-white text-maroon hover:bg-pink-100')}>
                <MeetIcon className="h-4 w-4" /> Join call
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer"
                className={cn(btn, canJoin ? 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60' : 'bg-white text-maroon hover:bg-pink-100')}>
                <WhatsAppIcon className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
        )}
      </section>

      <Card title="When">
        <Row icon={CalendarClock}>
          <span className="block text-[14.5px] font-semibold text-ink">{dayLong(b.scheduled_at)}</span>
          <span className="block text-[13px] text-muted">{fmtTime(b.scheduled_at)} – {fmtTime(end.toISOString())}{mins > 0 ? ` · ${mins} min` : ''}</span>
        </Row>
        <p className="mb-0 mt-2 flex flex-wrap items-center gap-2 text-[13px] text-faint">
          <StatusPill status={lower(b.status)} />
          {b.created_at && <span>Booked {dayShort(b.created_at)}</span>}
          {Number(b.reschedule_count) > 0 && <span>· Rescheduled {Number(b.reschedule_count) === 1 ? 'once' : `${b.reschedule_count} times`}</span>}
        </p>
      </Card>

      <Card title="Guest">
        <p className="mb-1 text-[15px] font-semibold text-ink">{b.guest_name || 'Guest'}</p>
        <p className="mb-2 text-[13px] text-muted">{guestVisit(b, bookings)}</p>
        {phone && <Row icon={Phone} href={`tel:${phone}`}><span className="block truncate text-[14px] text-ink">{phone}</span></Row>}
        {email && <Row icon={Mail} href={`mailto:${email}`}><span className="block truncate text-[14px] text-ink">{email}</span></Row>}
        {!phone && !email && <p className="mb-0 text-[13px] text-muted">No contact details on this booking.</p>}
      </Card>

      {b.notes?.trim() && (
        <Card title="Note from the guest">
          <p className="mb-0 whitespace-pre-line rounded-[16px] bg-cream p-4 text-[14px] leading-relaxed text-ink">{b.notes.trim()}</p>
        </Card>
      )}
    </div>
  );
}
