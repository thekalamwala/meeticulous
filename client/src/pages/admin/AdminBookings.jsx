import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminGetBookings, adminUpdateBooking, adminDeleteBooking, adminExecuteRefund } from '../../services/api';
import toast from 'react-hot-toast';
import { PageHeader, Skeleton } from '../../components/admin/ui';

// ───────────────────────────────────────────────────────────────
// Admin Bookings — support/operations console
//
// SCOPE NOTE (UI/UX restructure only):
//   The list endpoint (GET /admin/bookings) currently supports only
//   { status, page, limit }. There is NO server-side search or
//   time-aware state filter. Per the redesign brief we do NOT add
//   backend features here, so search + operational-state filtering
//   are done CLIENT-SIDE over a generously-limited fetch. A real
//   backend search/state endpoint is future work (see TODO below).
//
//   Likewise: Disputes (no `dispute` column), Payouts (P2 not built),
//   Session start/end timestamps, meeting provider/id, vendor phone,
//   and several actions are PLACEHOLDERS. They are intentionally left
//   visible + active-styled and wired to notImplemented() so the final
//   workflow is locked in before the backend lands.
// ───────────────────────────────────────────────────────────────

// TODO(backend): add GET /admin/bookings search params (q matches
// booking id / guest_phone / guest_email) + server-side operational
// state filter so we can drop the high-limit client-side fetch below.
const FETCH_LIMIT = 200;

// Abuse signal: bookings with this many or more guest-initiated reschedules
// get an amber warning badge in the list row and mobile card.
const RESCHEDULE_ALERT_THRESHOLD = 3;

// ── Inline SVG icons (no emoji — consistent 1.75 stroke) ──────────
const Ic = ({ d, size = 16, className = '', strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    className={`flex-shrink-0 ${className}`}>
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);

const IC = {
  search:  'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  eye:     ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 100 6 3 3 0 000-6z'],
  pencil:  ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z'],
  x:       ['M18 6L6 18', 'M6 6l12 12'],
  clock:   ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M12 7v5l3 2'],
  calendar:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  user:    ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2', 'M12 7a4 4 0 100 8 4 4 0 000-8z'],
  building:['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  mail:    ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  phone:   ['M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z'],
  copy:    ['M9 9h10a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V11a2 2 0 012-2z', 'M5 15H4a2 2 0 01-2-2V3a2 2 0 012-2h10a2 2 0 012 2v1'],
  external:['M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6', 'M15 3h6v6', 'M10 14L21 3'],
  link:    ['M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
  video:   ['M23 7l-7 5 7 5V7z', 'M14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z'],
  card:    ['M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z', 'M1 10h22'],
  wallet:  ['M21 12V7H5a2 2 0 010-4h14v4', 'M3 5v14a2 2 0 002 2h16v-5', 'M18 12a2 2 0 000 4h4v-4z'],
  refresh: ['M1 4v6h6', 'M23 20v-6h-6', 'M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15'],
  alert:   ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  check:   'M20 6L9 17l-5-5',
  checkCircle: ['M22 11.08V12a10 10 0 11-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  xCircle: ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M15 9l-6 6', 'M9 9l6 6'],
  ban:     ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M4.93 4.93l14.14 14.14'],
  trash:   ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2'],
  chevD:   'M6 9l6 6 6-6',
  chevR:   'M9 18l6-6-6-6',
  msg:     'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z',
  shield:  ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  swap:    ['M16 3h5v5', 'M4 20L21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
  note:    ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
  zap:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  dot:     'M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0',
  inbox:   ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z'],
  arrowL:  ['M19 12H5', 'M12 19l-7-7 7-7'],
  globe:   ['M12 2a10 10 0 100 20 10 10 0 000-20z', 'M2 12h20', 'M12 2c2.5 2.7 4 6.3 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.3-4-10s1.5-7.3 4-10z'],
  receipt: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1z', 'M8 7h8', 'M8 11h8', 'M8 15h5'],
  list:    ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  mapPin:  ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z', 'M12 7a3 3 0 100 6 3 3 0 000-6z'],
  dots:    'M12 5.01V5m0 7.01V12m0 7.01V19',
  plus:    ['M12 5v14', 'M5 12h14'],
};

// ── Status model ──────────────────────────────────────────────────
// Keyed by the DB `booking.status` field (NOT time-derived). Colours:
// Confirmed green · Completed blue · Cancelled red · Disputed orange ·
// Pending gray. `disputed` has no backend source yet (no dispute column)
// so the Disputed tab stays empty — the icon/colour are designed for when
// it lands. Mapping is shared by the list (icon-only) and the modal
// (full pill) so status reads identically across every booking view.
const STATUS = {
  pending:   { label: 'Pending',   icon: IC.clock,       text: 'text-gray-400',    badge: 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/15',        dot: 'bg-gray-400',    chip: 'bg-gray-100' },
  confirmed: { label: 'Confirmed', icon: IC.check,       text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15', dot: 'bg-emerald-500', chip: 'bg-emerald-50' },
  completed: { label: 'Completed', icon: IC.checkCircle, text: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/15',          dot: 'bg-blue-500',    chip: 'bg-blue-50' },
  cancelled: { label: 'Cancelled', icon: IC.xCircle,     text: 'text-rose-600',    badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/15',          dot: 'bg-rose-500',    chip: 'bg-rose-50' },
  disputed:  { label: 'Disputed',  icon: IC.alert,       text: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/15',       dot: 'bg-amber-500',   chip: 'bg-amber-50' },
};
const statusKey = (b) => (b && STATUS[b.status]) ? b.status : 'pending';

// Customer→platform payment (NOT vendor payout). Labels say money direction
// ("Received") so "Unpaid" can't be misread as "vendor not paid out".
const PAYMENT = {
  paid:     { label: 'Received', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15' },
  unpaid:   { label: 'Pending',  badge: 'bg-gray-100 text-gray-500 ring-1 ring-gray-400/20' },
  refunded: { label: 'Refunded', badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/15' },
};

// Tabs map 1:1 to the /admin/bookings/:filter routes (sidebar). Filtering
// is by booking.status. Pending bookings surface only under "All".
const TABS = [
  { key: 'all',       label: 'All',       to: '/admin/bookings' },
  { key: 'confirmed', label: 'Confirmed', to: '/admin/bookings/confirmed' },
  { key: 'completed', label: 'Completed', to: '/admin/bookings/completed' },
  { key: 'cancelled', label: 'Cancelled', to: '/admin/bookings/cancelled' },
  { key: 'disputed',  label: 'Disputed',  to: '/admin/bookings/disputed' },
  // Abandoned is NOT a booking.status — it's a derived state (see isAbandoned).
  // Guest started a booking, never paid, and left it stale. The ops dashboard
  // "Abandoned bookings" card links here.
  { key: 'abandoned', label: 'Abandoned', to: '/admin/bookings/abandoned' },
];

// Abandoned = pending + unpaid + older than the 1h grace window. Mirrors the
// ops-summary count (opsAdminController: status=pending, payment_status=unpaid,
// created_at < 1h ago) so the dashboard card and this tab agree.
const ABANDON_GRACE_MS = 60 * 60 * 1000;
const isAbandoned = (b) => b
  && b.status === 'pending'
  && b.payment_status === 'unpaid'
  && b.created_at != null
  && (Date.now() - new Date(b.created_at).getTime()) >= ABANDON_GRACE_MS;

// ── Formatting helpers ────────────────────────────────────────────
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
// Platform's take on a booking = commission + platform fee. null when the
// booking carries neither field (so the cell shows "—", not a fake ₹0).
const platformRevenue = (b) => (b.commission_applied == null && b.platform_fee_amount == null)
  ? null : (Number(b.commission_applied) || 0) + (Number(b.platform_fee_amount) || 0);
const shortId = (id) => (id ? `#${String(id).slice(0, 8).toUpperCase()}` : '#—');
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const endTime = (b) => {
  const durMin = b.services?.duration || 30;
  return new Date(new Date(b.scheduled_at).getTime() + durMin * 60000);
};
const meetingProvider = (link) => {
  if (!link) return '—';
  if (/meet\.google/.test(link)) return 'Google Meet';
  if (/zoom\./.test(link)) return 'Zoom';
  return 'Online';
};
const meetingId = (link) => {
  if (!link) return '—';
  try { return new URL(link).pathname.split('/').filter(Boolean).pop() || '—'; }
  catch { return '—'; }
};
const copy = (val, label) => {
  if (!val) return toast.error(`No ${label} to copy`);
  navigator.clipboard?.writeText(val).then(() => toast.success(`${label} copied`)).catch(() => toast.error('Copy failed'));
};
// Single sink for every not-yet-built action so the workflow stays visible.
const notImplemented = (name) => toast(`${name} — coming soon`, { icon: '🛠️' });

// ── Small presentational atoms ────────────────────────────────────
// Full pill (dot + label) — used inside the modal where space allows.
const StatusBadge = ({ status, size = 'sm' }) => {
  const s = STATUS[status] || STATUS.pending;
  const pad = size === 'lg' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

// Icon-only status (list Status column). Coloured icon in a tinted chip;
// native tooltip shows the full status name. Same colour scheme as the pill.
const StatusIcon = ({ status }) => {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span title={s.label} aria-label={s.label}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${s.chip}`}>
      <Ic d={s.icon} size={15} className={s.text} />
    </span>
  );
};

const PaymentPill = ({ status, bookingStatus }) => {
  // A cancelled + unpaid booking will never be paid, so a "Pending" pill there
  // reads as "awaiting payment" for a dead row. Show a neutral dash instead.
  // (cancelled + paid/refunded still show Received/Refunded — money did move.)
  if (bookingStatus === 'cancelled' && status === 'unpaid')
    return <span className="text-gray-300 text-[11px]" title="No payment — booking cancelled">—</span>;
  const p = PAYMENT[status] || PAYMENT.unpaid;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.badge}`}>{p.label}</span>;
};

const IconBtn = ({ icon, label, onClick, href, tone = 'gray' }) => {
  const tones = {
    gray:    'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
    primary: 'text-[#0079C1] hover:bg-[#0079C1]/10',
    danger:  'text-rose-500 hover:text-rose-700 hover:bg-rose-50',
  };
  const cls = `inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${tones[tone]}`;
  if (href) return <a href={href} target="_blank" rel="noreferrer" title={label} aria-label={label} className={cls}><Ic d={icon} size={16} /></a>;
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={cls}><Ic d={icon} size={16} /></button>;
};

// Action button used inside the detail modal's Actions sections.
const ActionBtn = ({ icon, label, onClick, href, variant = 'default' }) => {
  const variants = {
    default: 'btn--outline text-gray-700 bg-white hover:bg-gray-50',
    primary: 'bg-[#0079C1] text-white hover:bg-[#e54900] shadow-sm',
    danger:  'btn--outline text-rose-600 bg-white hover:bg-rose-50',
  };
  const cls = `btn inline-flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium transition-colors ${variants[variant]}`;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}><Ic d={icon} size={15} />{label}</a>;
  return <button type="button" onClick={onClick} className={cls}><Ic d={icon} size={15} />{label}</button>;
};

// ── Booking card (mobile fast-scan) ───────────────────────────────
const BookingCard = ({ b, status, onView, onEdit, onDelete }) => {
  const amount = Number(b.customer_total ?? b.services?.price ?? 0);
  const rev = platformRevenue(b);
  return (
    <div className="adm-card rounded-xl p-4 hover:shadow-sm transition-all"
      onClick={() => onView(b)}>
      <div className="flex items-center gap-2 mb-2">
        <StatusIcon status={status} />
        <code className="text-[12px] font-bold adm-t1 font-mono">{shortId(b.id)}</code>
        <PaymentPill status={b.payment_status} bookingStatus={b.status} />
        {Number(b.reschedule_count) >= RESCHEDULE_ALERT_THRESHOLD && (
          <span title={`${b.reschedule_count} reschedules`}
            className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            ⚠ {b.reschedule_count}× resched
          </span>
        )}
        <span className="ml-auto font-bold text-sm adm-t1 tabular-nums">{inr(amount)}</span>
      </div>
      <p className="text-[13px] font-semibold adm-t1 truncate">{b.services?.title || 'Service'}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1 text-[12px]">
        <p className="truncate"><span className="adm-t3">Customer </span><span className="font-medium adm-t2">{b.guest_name || '—'}</span></p>
        <p className="truncate"><span className="adm-t3">Host </span><span className="font-medium adm-t2">{b.profiles?.name || '—'}</span></p>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t adm-border">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] adm-t3 tabular-nums">
          <Ic d={IC.calendar} size={13} className="adm-t3" />{fmtDate(b.scheduled_at)} · {fmtTime(b.scheduled_at)}
        </span>
        <span className="text-[11.5px] adm-t3">Rev <span className="font-semibold text-emerald-600 tabular-nums">{rev == null ? '—' : inr(rev)}</span></span>
      </div>
      <div className="flex items-center gap-0.5 justify-end mt-1" onClick={(e) => e.stopPropagation()}>
        <IconBtn icon={IC.eye}    label="View details" tone="primary" onClick={() => onView(b)} />
        <IconBtn icon={IC.pencil} label="Edit booking"  tone="gray"    onClick={() => onEdit(b)} />
        <IconBtn icon={IC.trash}  label="Delete booking" tone="danger"  onClick={() => onDelete(b)} />
      </div>
    </div>
  );
};

// ── Booking table (desktop dense rows) ────────────────────────────
const TH = ({ children, right }) => (
  <th className={`px-4 py-2.5 font-semibold whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);

const BookingRow = ({ b, status, onView, onEdit, onDelete }) => {
  const amount = Number(b.customer_total ?? b.services?.price ?? 0);
  const dur = b.services?.duration || 30;
  const rev = platformRevenue(b);
  return (
    <tr onClick={() => onView(b)}
      className="group border-t adm-border adm-hoverable cursor-pointer transition-colors">
      {/* 1 Booking ID */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-1.5 flex-wrap">
          <code className="text-[12.5px] font-bold font-mono adm-t1">{shortId(b.id)}</code>
          {Number(b.reschedule_count) >= RESCHEDULE_ALERT_THRESHOLD && (
            <span title={`${b.reschedule_count} reschedules`}
              className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              ⚠ {b.reschedule_count}× resched
            </span>
          )}
        </div>
      </td>
      {/* 2 Status (icon only + tooltip) */}
      <td className="px-3 py-3 align-middle"><StatusIcon status={status} /></td>
      {/* 3 Service */}
      <td className="px-4 py-3 align-middle">
        <p className="text-[12.5px] font-medium adm-t2 truncate max-w-[160px]">{b.services?.title || 'Service'}</p>
        <p className="text-[11.5px] adm-t3 tabular-nums">{dur} min</p>
      </td>
      {/* 4 Vendor */}
      <td className="px-4 py-3 align-middle">
        <p className="text-[12.5px] font-medium adm-t2 truncate max-w-[150px]">{b.profiles?.name || '—'}</p>
        {b.profiles?.username && <p className="text-[11.5px] adm-t3 truncate max-w-[150px]">@{b.profiles.username}</p>}
      </td>
      {/* 5 Customer */}
      <td className="px-4 py-3 align-middle">
        <p className="text-[12.5px] font-medium adm-t2 truncate max-w-[170px]">{b.guest_name || '—'}</p>
        <p className="text-[11.5px] adm-t3 truncate max-w-[170px]">{b.guest_email || '—'}</p>
      </td>
      {/* 6 Date & Time */}
      <td className="px-4 py-3 align-middle whitespace-nowrap">
        <p className="text-[12.5px] adm-t2">{fmtDate(b.scheduled_at)}</p>
        <p className="text-[11.5px] adm-t3 tabular-nums">{fmtTime(b.scheduled_at)}</p>
      </td>
      {/* 7 Amount */}
      <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
        <span className="text-[13px] font-bold adm-t1 tabular-nums">{inr(amount)}</span>
      </td>
      {/* 8 Payment */}
      <td className="px-4 py-3 align-middle"><PaymentPill status={b.payment_status} bookingStatus={b.status} /></td>
      {/* 9 Revenue (platform take) */}
      <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
        <span className="text-[12.5px] font-semibold text-emerald-600 tabular-nums">{rev == null ? '—' : inr(rev)}</span>
      </td>
      {/* 10 Actions (reveal on row hover/focus) */}
      <td className="px-3 py-3 align-middle">
        <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}>
          <IconBtn icon={IC.eye} label="View details" tone="primary" onClick={() => onView(b)} />
          <IconBtn icon={IC.pencil} label="Edit booking" tone="gray" onClick={() => onEdit(b)} />
          <IconBtn icon={IC.trash} label="Delete booking" tone="danger" onClick={() => onDelete(b)} />
        </div>
      </td>
    </tr>
  );
};

const BookingTable = ({ items, onView, onEdit, onDelete }) => (
  <div className="hidden md:block adm-card rounded-xl overflow-x-auto">
    <table className="adm-table w-full border-collapse">
      <thead>
        <tr className="bg-gray-50/60 text-[11px] uppercase tracking-wide adm-t3">
          <TH>Booking ID</TH>
          <TH>Status</TH>
          <TH>Service</TH>
          <TH>Host</TH>
          <TH>Customer</TH>
          <TH>Date &amp; Time</TH>
          <TH right>Amount</TH>
          <TH>Payment</TH>
          <TH right>Revenue</TH>
          <th className="px-3" aria-hidden="true" />
        </tr>
      </thead>
      <tbody>
        {items.map(({ b, status }) => (
          <BookingRow key={b.id} b={b} status={status} onView={onView} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </tbody>
    </table>
  </div>
);

// ── Detail modal: world-class 3-column ops console ────────────────
//
// Layout: sticky header · left snapshot (20%) · tabbed center (55%) ·
//   sticky action panel (25%). Collapses to a single vertical scroll
//   below lg. Many actions/fields depend on backend that isn't built
//   yet (payout P2, session start/end ts, vendor phone, disputes,
//   audit log, refund/note/dispute) — those stay visible + wired to
//   notImplemented() so the workflow is locked in before the API lands.

// Payout / settlement status (P2 not built — derived from snapshots).
const PAYOUT = {
  settled:                 { label: 'Settled',     badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15' },
  eligible_for_settlement: { label: 'Eligible',    badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/15' },
  pending_completion:      { label: 'Pending',     badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/15' },
  not_eligible:            { label: 'Not eligible', badge: 'bg-gray-100 text-gray-500 ring-1 ring-gray-400/20' },
};
const payoutKey = (b) => b.settled_at ? 'settled'
  : (b.settlement_status || (b.payment_status === 'paid' ? 'pending_completion' : 'not_eligible'));
const PayoutPill = ({ b }) => {
  const p = PAYOUT[payoutKey(b)] || PAYOUT.not_eligible;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.badge}`}>{p.label}</span>;
};

// mailto with URL-encoded subject referencing the booking id.
const mailto = (email, b) => email
  ? `mailto:${email}?subject=${encodeURIComponent(`About your booking ID ${shortId(b.id)}`)}`
  : undefined;

// Never show the full meeting URL by default — reveal on hover.
const shortUrl = (link) => {
  if (!link) return '—';
  try {
    const u = new URL(link);
    const seg = u.pathname.replace(/^\/+/, '');
    return `${u.host}/${seg.slice(0, 3)}${seg.length > 3 ? '…' : ''}`;
  } catch { return link.length > 24 ? `${link.slice(0, 24)}…` : link; }
};

// ── Detail-modal presentational atoms ─────────────────────────────
const Card = ({ title, icon, action, children, className = '' }) => (
  <div className={`bg-white border border-gray-200/80 rounded-xl ${className}`}>
    {title && (
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          {icon && <Ic d={icon} size={13} className="text-gray-400" />}{title}
        </h4>
        {action}
      </div>
    )}
    <div className="px-4 pb-3">{children}</div>
  </div>
);

const Field = ({ label, value, mono, children }) => (
  <div className="flex items-center justify-between gap-4 py-[5px] border-b border-gray-50 last:border-0">
    <span className="text-[12px] text-gray-400 flex-shrink-0">{label}</span>
    {children || (
      <span className={`text-[12.5px] text-gray-800 text-right truncate tabular-nums ${mono ? 'font-mono' : 'font-medium'}`}>{value ?? '—'}</span>
    )}
  </div>
);

const CopyField = ({ label, value, mono = true }) => (
  <div className="flex items-center justify-between gap-2 py-[5px] border-b border-gray-50 last:border-0">
    <span className="text-[12px] text-gray-400 flex-shrink-0">{label}</span>
    <span className="flex items-center gap-1 min-w-0">
      <span className={`text-[12.5px] text-gray-800 truncate ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</span>
      {value && <IconBtn icon={IC.copy} label={`Copy ${label}`} onClick={() => copy(value, label)} />}
    </span>
  </div>
);

// Contact card: clickable envelope sits BEFORE the email; the email text
// itself is plain (not a link), per the brief. `accent` tints the header
// icon + adds a colored top rule/ring (blue = customer, crimson = vendor).
const CONTACT_ACCENTS = {
  blue:    { ring: 'ring-blue-500/15',  rule: 'border-t-blue-400',  tint: 'text-blue-500',  chip: 'bg-blue-50' },
  crimson: { ring: 'ring-rose-500/15',  rule: 'border-t-rose-400',  tint: 'text-rose-500',  chip: 'bg-rose-50' },
  gray:    { ring: 'ring-gray-900/5',   rule: 'border-t-gray-200',  tint: 'text-gray-400',  chip: 'bg-gray-100' },
};
const ContactCard = ({ title, icon, name, email, phone, b, mailLabel, extra, accent = 'gray' }) => {
  const a = CONTACT_ACCENTS[accent] || CONTACT_ACCENTS.gray;
  return (
    <div className={`bg-white border border-gray-200/80 border-t-2 ${a.rule} rounded-xl ring-1 ${a.ring}`}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          <span className={`w-5 h-5 rounded-md flex items-center justify-center ${a.chip}`}><Ic d={icon} size={12} className={a.tint} /></span>
          {title}
        </h4>
        <div className="flex items-center gap-0.5">
          <IconBtn icon={IC.phone} label={`Call ${title.split(' ')[0]}`} href={phone ? `tel:${phone}` : undefined} onClick={phone ? undefined : () => toast.error('No phone on file')} />
          {extra}
        </div>
      </div>
      <div className="px-4 pb-3">
        <Field label="Name" value={name} />
        <div className="flex items-center justify-between gap-2 py-[5px] border-b border-gray-50">
          <span className="text-[12px] text-gray-400">Email</span>
          <span className="flex items-center gap-1 min-w-0">
            <IconBtn icon={IC.mail} label={mailLabel} href={mailto(email, b)} onClick={email ? undefined : () => toast.error('No email on file')} />
            <span className="text-[12.5px] font-medium text-gray-800 truncate">{email || '—'}</span>
            {email && <IconBtn icon={IC.copy} label="Copy email" onClick={() => copy(email, 'Email')} />}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 py-[5px]">
          <span className="text-[12px] text-gray-400">Phone</span>
          <span className="flex items-center gap-1 min-w-0">
            <span className="text-[12.5px] font-medium text-gray-800 truncate">{phone || '—'}</span>
            {phone && <IconBtn icon={IC.copy} label="Copy phone" onClick={() => copy(phone, 'Phone')} />}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Net-earnings card (left-column anchor) ────────────────────────
// Itemized breakdown straight from existing booking fields. Renders
// `—` for any null field; never NaN/₹0 from missing data.
const EarningsLine = ({ label, value, sign }) => (
  <div className="flex items-center justify-between gap-3 py-[5px] text-[12.5px]">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-800 tabular-nums">
      {value == null ? '—' : `${sign === '−' ? '−' : ''}${inr(value)}`}
    </span>
  </div>
);
const EarningsCard = ({ b }) => {
  const bookingAmount = b.customer_total ?? b.services?.price ?? null;
  const net = b.vendor_amount;
  const lines = [
    { label: 'Booking Amount',     value: bookingAmount,         sign: '+' },
    { label: 'Razorpay Fees',      value: b.razorpay_fee_actual, sign: '−' },
    { label: 'Platform Commission',value: b.commission_applied,  sign: '−' },
    { label: 'GST on Commission',  value: b.commission_gst,      sign: '−' },
    { label: 'Platform Fee',       value: b.platform_fee_amount, sign: '−' },
  ];
  return (
    <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white p-4">
      <h4 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
        <Ic d={IC.wallet} size={13} />Net Earnings From This Booking
      </h4>
      <div className="divide-y divide-emerald-100/70">
        {lines.map((l, i) => <EarningsLine key={i} {...l} />)}
      </div>
      <div className="flex items-center justify-between gap-3 pt-2.5 mt-1 border-t-2 border-emerald-200/80">
        <span className="text-[12px] font-semibold text-gray-700">Final Net Earnings</span>
        <span className="text-[20px] font-bold text-emerald-700 tabular-nums leading-none">{net == null ? '—' : inr(net)}</span>
      </div>
    </div>
  );
};

// ── Dependency-free SVG donut + legend ────────────────────────────
const PieChart = ({ segments }) => {
  const data = segments.filter(s => Number(s.value) > 0);
  const sum = data.reduce((s, x) => s + Number(x.value), 0);
  if (!sum) return <p className="text-[12px] text-gray-400 py-2">Breakdown unavailable for this booking.</p>;
  const r = 54, c = 70, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          <circle cx={c} cy={c} r={r} fill="none" stroke="#f3f4f6" strokeWidth="28" />
          {data.map((s, i) => {
            const len = (Number(s.value) / sum) * C;
            const el = (
              <circle key={i} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth="28"
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} strokeLinecap="butt" />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] uppercase tracking-wide text-gray-400">Total</span>
          <span className="text-[13px] font-bold text-gray-900 tabular-nums">{inr(sum)}</span>
        </div>
      </div>
      <ul className="flex-1 w-full space-y-1.5">
        {data.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 flex-1 truncate">{s.label}</span>
            <span className="font-semibold text-gray-900 tabular-nums">{inr(s.value)}</span>
            <span className="text-gray-400 tabular-nums w-9 text-right">{Math.round((Number(s.value) / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ── Static, always-inactive Google Maps placeholder ───────────────
const MapsPlaceholder = () => (
  <Card title="Host Location" icon={IC.mapPin}>
    <div className="py-6 flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center mb-3"><Ic d={IC.mapPin} size={20} className="text-gray-400" /></div>
      <p className="text-[12px] text-gray-400 max-w-[230px] mb-3 leading-relaxed">
        Host location — coming soon. Once hosts add a business address to their profile, an Open in Google Maps button appears here.
      </p>
      <button type="button" disabled aria-disabled="true"
        className="btn btn--outline inline-flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium text-gray-300 cursor-not-allowed">
        <Ic d={IC.external} size={14} />Open in Google Maps
      </button>
    </div>
  </Card>
);

// ── Compact "More" dropdown for secondary actions ─────────────────
const MoreMenu = ({ items }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={() => setTimeout(() => setOpen(false), 120)}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="btn btn--outline inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
        <Ic d={IC.dots} size={15} />More
      </button>
      {open && (
        <div className="absolute right-0 bottom-11 z-20 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          {items.map((it, i) => (
            <MenuItem key={i} icon={it.icon} label={it.label} onClick={() => { setOpen(false); it.onClick?.(); }} />
          ))}
        </div>
      )}
    </div>
  );
};

// Lifecycle events — REAL timestamps only. No fake "pending session" rows
// (they read as broken). Terminal node is Cancelled or Completed.
const lifecycle = (b) => {
  const events = [
    { label: 'Booking Created',  at: b.created_at, done: !!b.created_at },
    { label: 'Payment Received', at: b.paid_at,    done: b.payment_status === 'paid' || !!b.paid_at },
    { label: 'Host Confirmed', at: null,         done: ['confirmed', 'completed'].includes(b.status) },
  ];
  if (b.status === 'cancelled') {
    events.push({ label: 'Cancelled', at: b.updated_at, done: true, cancelled: true });
  } else {
    events.push({ label: 'Completed', at: b.completed_at, done: b.status === 'completed' || !!b.completed_at });
  }
  return events;
};

// Node fill per event: cancelled = rose, done = emerald, else hollow.
const nodeFill = (e) => e.cancelled ? 'bg-rose-500 text-white'
  : e.done ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-gray-300';
const connFill = (e) => e.cancelled ? 'bg-rose-300' : e.done ? 'bg-emerald-400' : 'bg-gray-200';

// Horizontal on desktop (spec), vertical on mobile.
const LifecycleTimeline = ({ b }) => {
  const events = lifecycle(b);
  const n = events.length;
  return (
    <>
      {/* Horizontal (md+) */}
      <div className="hidden md:flex items-start pt-1">
        {events.map((e, i) => (
          <div key={i} className="flex-1 flex flex-col items-center text-center relative px-1">
            {i < n - 1 && <span className={`absolute top-[9px] left-1/2 w-full h-[2px] ${connFill(events[i + 1])}`} />}
            <span className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${nodeFill(e)}`}>
              {e.done && <Ic d={e.cancelled ? IC.x : IC.check} size={11} strokeWidth={3} />}
            </span>
            <span className={`mt-2 text-[11px] leading-tight ${e.cancelled ? 'font-semibold text-rose-600' : e.done ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>{e.label}</span>
            {e.at && <span className="mt-0.5 text-[10px] text-gray-400 tabular-nums">{fmtDate(e.at)}<br />{fmtTime(e.at)}</span>}
          </div>
        ))}
      </div>
      {/* Vertical (mobile) */}
      <ol className="md:hidden relative ml-1">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3 pb-3 last:pb-0 relative">
            {i < n - 1 && <span className={`absolute left-[8px] top-5 bottom-0 w-[2px] ${connFill(events[i + 1])}`} />}
            <span className={`relative z-10 mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 ${nodeFill(e)}`}>
              {e.done && <Ic d={e.cancelled ? IC.x : IC.check} size={10} strokeWidth={3} />}
            </span>
            <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
              <span className={`text-[12.5px] ${e.cancelled ? 'font-medium text-rose-600' : e.done ? 'font-medium text-gray-800' : 'text-gray-400'}`}>{e.label}</span>
              {e.at && <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{fmtDate(e.at)} · {fmtTime(e.at)}</span>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
};

// Tab in the center column.
const TabBtn = ({ active, label, onClick }) => (
  <button type="button" onClick={onClick}
    className={`relative px-3 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap
      ${active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
    {label}
    {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#0079C1]" />}
  </button>
);

// Action-panel button (full width, icon-left).
const PanelBtn = ({ icon, label, onClick, href, tone = 'default' }) => {
  const tones = {
    default: 'bg-white text-gray-700 hover:bg-gray-50 btn--outline',
    primary: 'bg-[#0079C1] text-white hover:bg-[#e54900] shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    danger:  'bg-white text-rose-600 hover:bg-rose-50 btn--outline',
  };
  const cls = `btn w-full inline-flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium transition-colors ${tones[tone]}`;
  const inner = <><Ic d={icon} size={15} className="flex-shrink-0" /><span className="truncate">{label}</span></>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
};

const PanelGroup = ({ title, children }) => (
  <div>
    <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 px-0.5">{title}</h5>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const MenuItem = ({ icon, label, onClick, href }) => {
  const cls = 'w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 transition-colors';
  const inner = <><Ic d={icon} size={14} className="text-gray-400" />{label}</>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls} onClick={onClick}>{inner}</a>;
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
};

const DETAIL_TABS = ['Overview', 'Timeline', 'Meeting', 'Financials', 'Logs'];

const BookingDetailModal = ({ b, status, onClose, onEdit, onCancel, onDelete, onMarkComplete, onRefund }) => {
  const [tab, setTab] = useState('Overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'cancel' | 'delete' | 'refund' | 'force-refund' | null
  const [delText, setDelText] = useState('');
  const panelRef = useRef(null);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard: ESC closes (menu → confirm → modal). Cmd/Ctrl+C copies the
  // booking id when nothing is selected. Tab is trapped within the panel.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (menuOpen) { setMenuOpen(false); return; }
        if (confirm) { setConfirm(null); return; }
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (!window.getSelection?.().toString()) { copy(b.id, 'Booking ID'); }
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll('a[href],button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [b.id, onClose, menuOpen, confirm]);

  useEffect(() => { setDelText(''); }, [confirm]);

  // Confirmation-dialog copy per action. Refund modes map to the execute endpoint:
  // 'refund' → tiered policy amount; 'force-refund' → full customer_total.
  const payoutSettled = b.transfer_status === 'processed';
  const CONFIRM_META = {
    delete:         { icon: IC.trash,   title: 'Delete booking permanently?', body: 'This removes the booking and cannot be undone.', btn: 'Delete Forever' },
    cancel:         { icon: IC.ban,     title: 'Cancel this booking?',        body: 'The booking will be marked cancelled. The customer and host are not auto-notified.', btn: 'Cancel Booking' },
    refund:         { icon: IC.refresh, title: 'Issue a policy refund?',      body: 'Refunds the guest the eligible amount for the cancellation window (≥24h: full service price · 6–24h: 50% · under 6h: nothing). Platform fee & GST are non-refundable. The exact amount is computed on confirm.', btn: 'Issue Refund' },
    'force-refund': { icon: IC.wallet,  title: 'Force a full refund?',        body: `Refunds the entire amount the guest paid${b.customer_total ? ` (₹${b.customer_total})` : ''}. Use only when we or the host are at fault.`, btn: 'Force Refund' },
  };
  const cm = confirm ? CONFIRM_META[confirm] : null;
  const isRefund = confirm === 'refund' || confirm === 'force-refund';

  if (!b) return null;

  const host = b.profiles || {};
  const dur = b.services?.duration || 30;
  const servicePrice = Number(b.services?.price || 0);
  const total = Number(b.customer_total ?? b.services?.price ?? 0);
  const platformFee = b.platform_fee_amount;
  const vendorEarnings = b.vendor_amount;
  const taxes = (Number(b.platform_fee_gst) || 0) + (Number(b.commission_gst) || 0) + (Number(b.razorpay_tax_actual) || 0);
  const requiredId = String(b.id).slice(0, 8).toUpperCase();
  const timeRange = `${fmtTime(b.scheduled_at)} – ${fmtTime(endTime(b))}`;

  // Action visibility (spec 4.2): Mark Completed for any active booking;
  // Cancel hidden once terminal.
  const showMarkComplete = !['completed', 'cancelled'].includes(b.status);
  const showCancel = !['cancelled', 'completed'].includes(b.status);

  // Revenue split — 4 buckets that decompose the full customer payment, so
  // they always sum to 100% of `total`. "Us" is the residual (platform net
  // income after vendor payout, Razorpay's cut, and all GSTs to govt).
  // Razorpay charges a ~2% PG fee + 18% GST on that fee, and keeps both
  // (it remits its own GST). So razorpay_tax_actual belongs in Razorpay's
  // bucket, NOT Govt. Govt = only the GSTs WE remit (commission + platform fee).
  const vendorShare   = Number(b.vendor_amount) || 0;
  const razorpayShare = (Number(b.razorpay_fee_actual) || 0) + (Number(b.razorpay_tax_actual) || 0);
  const govtShare     = (Number(b.commission_gst) || 0) + (Number(b.platform_fee_gst) || 0);
  const usShare       = Math.max(0, total - vendorShare - razorpayShare - govtShare);
  const pieSegments = [
    { label: 'Host',          value: vendorShare,   color: '#16a34a' }, // green
    { label: 'Razorpay',        value: razorpayShare, color: '#f97316' }, // orange
    { label: 'Govt (All GSTs)', value: govtShare,     color: '#ef4444' }, // red
    { label: 'Us (Net Income)', value: usShare,       color: '#0079C1' }, // blue
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Booking details">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} onMouseDown={() => menuOpen && setMenuOpen(false)}
        className="relative bg-white w-full sm:max-w-[1480px] h-[94vh] sm:h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none animate-[slideUp_.18s_ease-out]">

        {/* ── Sticky header ── */}
        <header className="flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
          {/* Left: back + id copy */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <IconBtn icon={IC.arrowL} label="Back" onClick={onClose} />
            <IconBtn icon={IC.copy} label="Copy booking ID" onClick={() => copy(b.id, 'Booking ID')} />
          </div>
          {/* Center: slim identity — service · date · time · duration */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-bold text-gray-900 truncate">{b.services?.title || 'Service'}</h3>
            <p className="text-[11.5px] text-gray-400 truncate tabular-nums">
              {fmtDate(b.scheduled_at)} · {timeRange} · {dur} min
            </p>
          </div>
          {/* Right: more + close */}
          <div className="flex items-center gap-0.5 flex-shrink-0 relative">
            <button type="button" title="More actions" aria-label="More actions"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24"><g fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></g></svg>
            </button>
            <IconBtn icon={IC.x} label="Close" onClick={onClose} />
            {menuOpen && (
              <div className="absolute right-0 top-9 z-[56] w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1" onMouseDown={(e) => e.stopPropagation()}>
                <MenuItem icon={IC.copy} label="Copy Booking ID" onClick={() => { copy(b.id, 'Booking ID'); setMenuOpen(false); }} />
                <MenuItem icon={IC.link} label="Copy Meeting Link" onClick={() => { copy(b.meeting_link, 'Link'); setMenuOpen(false); }} />
                {host.username && <MenuItem icon={IC.external} label="View Host Profile" href={`/${host.username}`} onClick={() => setMenuOpen(false)} />}
                <MenuItem icon={IC.pencil} label="Edit Booking" onClick={() => { onEdit(b); setMenuOpen(false); }} />
              </div>
            )}
          </div>
        </header>

        {/* ── Body: 3 columns on lg, single scroll below ── */}
        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:flex">

          {/* Left: earnings anchor + primary actions + condensed snapshot */}
          <aside className="lg:w-[272px] lg:flex-shrink-0 lg:overflow-y-auto bg-gray-50/50 border-b lg:border-b-0 lg:border-r border-gray-100 p-4 space-y-4">
            <EarningsCard b={b} />

            {/* Action buttons */}
            <div className="space-y-1.5">
              <PanelBtn icon={IC.pencil} label="Edit Booking" tone="primary" onClick={() => onEdit(b)} />
              {showMarkComplete && <PanelBtn icon={IC.checkCircle} label="Mark Completed" tone="success" onClick={() => onMarkComplete?.()} />}
              {showCancel && <PanelBtn icon={IC.ban} label="Cancel Booking" tone="danger" onClick={() => setConfirm('cancel')} />}
              <PanelBtn icon={IC.alert} label="Open Dispute" onClick={() => notImplemented('Open Dispute')} />
            </div>
          </aside>

          {/* Center: tabs + content */}
          <main className="lg:flex-1 lg:min-w-0 lg:overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-3 sm:px-4 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {DETAIL_TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
            </div>

            <div className="p-4 space-y-3">
              {tab === 'Overview' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ContactCard title="Customer" icon={IC.user} b={b} accent="blue"
                      name={b.guest_name} email={b.guest_email} phone={b.guest_phone} mailLabel="Email Customer" />
                    <ContactCard title="Host" icon={IC.building} b={b} accent="crimson"
                      name={host.name} email={host.email}
                      /* TODO(backend): host phone not selected by list endpoint */
                      phone={null} mailLabel="Email Host"
                      extra={<IconBtn icon={IC.external} label="View host profile" href={host.username ? `/${host.username}` : undefined} onClick={host.username ? undefined : () => toast.error('No profile')} />} />
                  </div>
                  <Card title="Booking Information" icon={IC.calendar}>
                    <div className="grid grid-cols-2 gap-x-6">
                      <CopyField label="Booking ID" value={shortId(b.id)} />
                      <Field label="Duration" value={`${dur} min`} />
                      <Field label="Date" value={fmtDate(b.scheduled_at)} />
                      <Field label="Timezone" value="Asia/Kolkata" />
                      <Field label="Start Time" value={fmtTime(b.scheduled_at)} />
                      <Field label="End Time" value={fmtTime(endTime(b))} />
                      <div className="flex items-center justify-between gap-4 py-[5px] col-span-2 border-t border-gray-50 mt-0.5 pt-2">
                        <span className="text-[12px] text-gray-400">Current State</span>
                        <StatusBadge status={status} />
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {tab === 'Timeline' && (
                <Card title="Booking Lifecycle" icon={IC.clock} action={
                  <span className="flex items-center gap-1.5 text-[11px] text-gray-400">Current state <StatusBadge status={statusKey(b)} /></span>
                }>
                  <LifecycleTimeline b={b} />
                </Card>
              )}

              {tab === 'Meeting' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <Card title="Meeting Information" icon={IC.video}>
                    {b.meeting_link ? (
                      <>
                        <Field label="Provider" value={meetingProvider(b.meeting_link)} />
                        <CopyField label="Meeting ID" value={meetingId(b.meeting_link)} />
                        <div className="flex items-center justify-between gap-2 py-[5px] border-b border-gray-50">
                          <span className="text-[12px] text-gray-400">Meeting URL</span>
                          <span className="group flex items-center gap-1 min-w-0" title={b.meeting_link}>
                            <span className="font-mono text-[12.5px] text-gray-700 truncate group-hover:hidden">{shortUrl(b.meeting_link)}</span>
                            <span className="font-mono text-[12.5px] text-gray-700 truncate hidden group-hover:inline">{b.meeting_link}</span>
                            <IconBtn icon={IC.copy} label="Copy link" onClick={() => copy(b.meeting_link, 'Link')} />
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-3">
                          <ActionBtn icon={IC.video} label="Join Meeting" href={b.meeting_link} variant="primary" />
                          <MoreMenu items={[
                            { icon: IC.copy, label: 'Copy Link', onClick: () => copy(b.meeting_link, 'Link') },
                            { icon: IC.link, label: 'Regenerate Meeting Link', onClick: () => notImplemented('Regenerate Meeting Link') },
                          ]} />
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center">
                        <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Ic d={IC.video} size={20} className="text-gray-400" /></div>
                        <p className="text-[12.5px] text-gray-400">No meeting link on this booking.</p>
                      </div>
                    )}
                  </Card>
                  <MapsPlaceholder />
                </div>
              )}

              {tab === 'Financials' && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Card title="Payment Summary" icon={IC.receipt}>
                      <Field label="Service Price" value={inr(servicePrice)} />
                      <Field label="Platform Fee" value={platformFee != null ? inr(platformFee) : '—'} />
                      <Field label="Taxes" value={taxes ? inr(taxes) : '—'} />
                      <div className="flex items-center justify-between gap-4 py-2 border-t border-gray-100 mt-1">
                        <span className="text-[12.5px] font-semibold text-gray-700">Total Amount</span>
                        <span className="text-[14px] font-bold text-gray-900 tabular-nums">{inr(total)}</span>
                      </div>
                      <Field label="Host Earnings" value={vendorEarnings != null ? inr(vendorEarnings) : '—'} />
                      <Field label="Payment Method" value={b.payment_id ? 'Razorpay' : '—'} />
                      <div className="flex items-center justify-between gap-4 py-[5px]">
                        <span className="text-[12px] text-gray-400">Customer Payment</span>
                        <PaymentPill status={b.payment_status} bookingStatus={b.status} />
                      </div>
                    </Card>
                    <Card title="Revenue Split" icon={IC.zap}>
                      <div className="pt-1"><PieChart segments={pieSegments} /></div>
                    </Card>
                  </div>
                  <Card title="Payout Information" icon={IC.wallet}>
                    {/* TODO(backend): settlement/payout (P2) not implemented */}
                    <div className="flex items-center justify-between gap-4 py-[5px] border-b border-gray-50">
                      <span className="text-[12px] text-gray-400">Payout Status</span>
                      <PayoutPill b={b} />
                    </div>
                    <Field label="Payout Date" value={b.settled_at ? fmtDate(b.settled_at) : '—'} />
                    <CopyField label="Transaction ID" value={b.payment_id} />
                  </Card>
                </>
              )}

              {tab === 'Logs' && (
                <Card title="Activity" icon={IC.list}>
                  {(() => {
                    const logs = [
                      { label: 'Booking created', at: b.created_at, icon: IC.calendar },
                      b.paid_at && { label: 'Payment received', at: b.paid_at, icon: IC.card },
                      b.completed_at && { label: 'Booking completed', at: b.completed_at, icon: IC.checkCircle },
                      b.status === 'cancelled' && { label: 'Booking cancelled', at: b.updated_at, icon: IC.xCircle },
                      b.updated_at && b.updated_at !== b.created_at && { label: 'Last updated', at: b.updated_at, icon: IC.pencil },
                    ].filter(Boolean);
                    return (
                      <>
                        <ul className="space-y-2.5">
                          {logs.map((l, i) => (
                            <li key={i} className="flex items-center gap-3">
                              <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><Ic d={l.icon} size={13} className="text-gray-500" /></span>
                              <span className="text-[12.5px] text-gray-700 flex-1">{l.label}</span>
                              <span className="text-[11px] text-gray-400 tabular-nums">{fmtDate(l.at)} · {fmtTime(l.at)}</span>
                            </li>
                          ))}
                        </ul>
                        {/* TODO(backend): admin_audit_logs not yet joined to bookings */}
                        <p className="mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400">Derived from booking timestamps. Full audit trail coming soon.</p>
                      </>
                    );
                  })()}
                </Card>
              )}
            </div>
          </main>

          {/* Right action panel */}
          <aside className="lg:w-[284px] lg:flex-shrink-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-gray-100 p-4 space-y-5">
            <PanelGroup title="Financial">
              <PanelBtn icon={IC.refresh} label="Issue Refund" onClick={() => setConfirm('refund')} />
              <PanelBtn icon={IC.wallet} label="Force Refund" onClick={() => setConfirm('force-refund')} />
            </PanelGroup>
            <PanelGroup title="Meeting">
              <PanelBtn icon={IC.link} label="Regenerate Meeting Link" onClick={() => notImplemented('Regenerate Meeting Link')} />
              {b.meeting_link && <PanelBtn icon={IC.video} label="Open Meeting" href={b.meeting_link} />}
            </PanelGroup>
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
              <h5 className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-rose-500 mb-2">
                <Ic d={IC.alert} size={12} />Danger Zone
              </h5>
              <div className="space-y-1.5">
                <PanelBtn icon={IC.trash} label="Delete Permanently" tone="danger" onClick={() => setConfirm('delete')} />
              </div>
            </div>
          </aside>
        </div>

        {/* ── Confirmation overlays ── */}
        {confirm && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirm(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 animate-[slideUp_.16s_ease-out]">
              <div className="flex items-start gap-3 mb-3">
                <span className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0"><Ic d={cm?.icon} size={17} className="text-rose-600" /></span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">{cm?.title}</h3>
                  <p className="text-[12.5px] text-gray-500 mt-0.5">{cm?.body}</p>
                  {isRefund && payoutSettled && (
                    <p className="mt-2 text-[12px] font-medium text-amber-600">⚠ Host already paid out — this refund will be blocked; recover from the host first.</p>
                  )}
                </div>
              </div>
              {confirm === 'delete' && (
                <label className="block mb-3">
                  <span className="text-[12px] text-gray-500">Type <code className="font-mono font-semibold text-gray-700">{requiredId}</code> to confirm</span>
                  <input autoFocus value={delText} onChange={e => setDelText(e.target.value)}
                    className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 outline-none"
                    placeholder={requiredId} />
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button
                  disabled={confirm === 'delete' && delText.trim().toUpperCase() !== requiredId}
                  onClick={() => {
                    const c = confirm; setConfirm(null);
                    if (c === 'delete') onDelete();
                    else if (c === 'cancel') onCancel();
                    else if (c === 'refund') onRefund?.('tiered');
                    else if (c === 'force-refund') onRefund?.('full');
                  }}
                  className="btn px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {cm?.btn}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Edit modal (preserves existing capability: status + payment) ──
// Backend updateBooking only accepts { status, payment_status }.
const EditModal = ({ b, onClose, onSave }) => {
  const [status, setStatus] = useState(b.status);
  const [payment, setPayment] = useState(b.payment_status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(b.id, { status, payment_status: payment }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-sm text-gray-900">Edit Booking <span className="font-mono text-gray-400">{shortId(b.id)}</span></h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><Ic d={IC.x} size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-[12px] font-medium text-gray-500 mb-1.5 block">Booking Status</span>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0079C1]/30 focus:border-[#0079C1] outline-none">
              {['pending', 'confirmed', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-gray-500 mb-1.5 block">Customer Payment</span>
            <select value={payment} onChange={e => setPayment(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0079C1]/30 focus:border-[#0079C1] outline-none">
              {[['unpaid', 'Pending'], ['paid', 'Received'], ['refunded', 'Refunded']].map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="btn px-4 py-2 text-sm font-semibold bg-[#0079C1] text-white hover:bg-[#e54900] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Delete confirm (type-to-confirm) — used by the list row/card ──
const DeleteDialog = ({ b, onClose, onConfirm }) => {
  const [txt, setTxt] = useState('');
  const reqId = String(b.id).slice(0, 8).toUpperCase();
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 animate-[slideUp_.16s_ease-out]">
        <div className="flex items-start gap-3 mb-3">
          <span className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0"><Ic d={IC.trash} size={17} className="text-rose-600" /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">Delete booking permanently?</h3>
            <p className="text-[12.5px] text-gray-500 mt-0.5">This removes the booking and cannot be undone.</p>
          </div>
        </div>
        <label className="block mb-3">
          <span className="text-[12px] text-gray-500">Type <code className="font-mono font-semibold text-gray-700">{reqId}</code> to confirm</span>
          <input autoFocus value={txt} onChange={e => setTxt(e.target.value)}
            className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 outline-none"
            placeholder={reqId} />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
          <button disabled={txt.trim().toUpperCase() !== reqId} onClick={onConfirm}
            className="btn px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Delete Forever
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────
const PER_PAGE = 12;

const AdminBookings = () => {
  const { filter = 'all' } = useParams();
  const tab = TABS.find(t => t.key === filter) ? filter : 'all';

  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Client-side fetch (see scope note). Pulls a generous page so search
  // + state filters work across the whole recent set without a new API.
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminGetBookings({ status: 'all', page: 1, limit: FETCH_LIMIT });
      setRaw(data.bookings || []);
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => { setPage(1); }, [tab, query]);

  // Annotate each booking with its status key once.
  const withStatus = useMemo(() => raw.map(b => ({ b, status: statusKey(b) })), [raw]);

  // Search: Booking ID / phone / email ONLY (per brief — nothing else).
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return withStatus;
    const digits = q.replace(/\D/g, '');
    return withStatus.filter(({ b }) => {
      const idMatch = String(b.id).toLowerCase().includes(q);
      const emailMatch = (b.guest_email || '').toLowerCase().includes(q);
      const phoneMatch = digits.length >= 3 && (b.guest_phone || '').replace(/\D/g, '').includes(digits);
      return idMatch || emailMatch || phoneMatch;
    });
  }, [withStatus, query]);

  // Tab filter by booking.status (Disputed has no backend source → empty).
  // Abandoned is derived (pending + unpaid + stale), not a status key.
  const filtered = useMemo(() => {
    if (tab === 'all') return searched;
    if (tab === 'abandoned') return searched.filter(({ b }) => isAbandoned(b));
    return searched.filter(({ status }) => status === tab);
  }, [searched, tab]);

  // Tab counts (over the searched set so counts respect active search).
  const counts = useMemo(() => {
    const c = { all: searched.length, confirmed: 0, completed: 0, cancelled: 0, disputed: 0, abandoned: 0 };
    searched.forEach(({ b, status }) => {
      if (c[status] != null) c[status] += 1;
      if (isAbandoned(b)) c.abandoned += 1;
    });
    return c;
  }, [searched]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Real mutations (preserved) ──────────────────────────────────
  const handleSave = async (id, updates) => {
    try {
      await adminUpdateBooking(id, updates);
      toast.success('Booking updated');
      setRaw(rs => rs.map(r => (r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r)));
      setDetail(d => (d && d.id === id ? { ...d, ...updates } : d));
    } catch { toast.error('Update failed'); }
  };

  // Confirmation is owned by the detail modal (Danger Zone dialogs).
  const handleCancel = async (id) => {
    await handleSave(id, { status: 'cancelled' });
  };

  const handleDelete = async (id) => {
    try {
      await adminDeleteBooking(id);
      toast.success('Booking deleted');
      setRaw(rs => rs.filter(r => r.id !== id));
      setDetail(null);
    } catch { toast.error('Delete failed'); }
  };

  // Execute a real Razorpay refund. mode 'tiered' = cancellation-window policy;
  // 'full' = entire customer_total (our/host fault). Server computes the amount.
  const handleRefund = async (id, mode) => {
    try {
      const { data } = await adminExecuteRefund({ booking_id: id, mode });
      toast.success(`Refunded ₹${data.amount}${data.transfer_reversed ? ' · payout reversed' : ''}`);
      if (data.payment_status) {
        setRaw(rs => rs.map(r => (r.id === id ? { ...r, payment_status: data.payment_status } : r)));
        setDetail(d => (d && d.id === id ? { ...d, payment_status: data.payment_status } : d));
      }
    } catch (e) { toast.error(e?.response?.data?.message || 'Refund failed'); }
  };

  return (
    <div className="max-w-[1240px]">
      <style>{`@keyframes slideUp{from{transform:translateY(12px);opacity:.6}to{transform:translateY(0);opacity:1}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* Header */}
      <PageHeader title="Bookings" subtitle="Search, triage, and manage every booking on the platform." />

      {/* Toolbar — search (40%) + state filters (10% each), one row on md+.
          Search bar and the 6 filter pills sit side-by-side; on mobile the
          search takes a full row and the pills wrap beneath it. */}
      <div className="flex flex-wrap md:flex-nowrap items-stretch gap-2 mb-5">
        {/* Search — Booking ID / Phone / Email only */}
        <div className="relative basis-full md:flex-[4] md:min-w-0">
          <Ic d={IC.search} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by Booking ID, phone, or email…"
            className="w-full pl-10 pr-9 py-2.5 adm-card border rounded-xl text-sm adm-t1 placeholder:text-[color:var(--adm-text-3)] focus:ring-2 focus:ring-[#0079C1]/25 focus:border-[#0079C1] outline-none transition"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <Ic d={IC.x} size={15} />
            </button>
          )}
        </div>

        {/* State filters — each 10% of the row */}
        {TABS.map(t => {
          const active = t.key === tab;
          const count = counts[t.key];
          return (
            <Link key={t.key} to={t.to} title={t.label}
              className={`flex-[1] min-w-0 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-[12.5px] font-medium whitespace-nowrap overflow-hidden transition-colors
                ${active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}>
              <span className="truncate">{t.label}</span>
              {count > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{count}</span>}
            </Link>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <>
          <div className="hidden md:block adm-card rounded-xl overflow-hidden divide-y adm-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
          <div className="md:hidden space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}
          </div>
        </>
      ) : pageItems.length === 0 ? (
        <div className="adm-card rounded-2xl py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--adm-hover)] flex items-center justify-center mx-auto mb-4">
            <Ic d={tab === 'disputed' ? IC.alert : IC.inbox} size={24} className="adm-t3" />
          </div>
          <h3 className="text-sm font-bold adm-t2 mb-1">
            {query ? 'No matches' : tab === 'disputed' ? 'No disputes' : `No ${tab === 'all' ? '' : tab + ' '}bookings`}
          </h3>
          <p className="text-[12.5px] adm-t3 max-w-sm mx-auto">
            {query ? 'No booking matches that ID, phone, or email.'
              : tab === 'disputed' ? 'Disputed bookings will appear here once a customer or host raises a dispute.'
              : 'Nothing to show in this view yet.'}
          </p>
        </div>
      ) : (
        <>
          <BookingTable items={pageItems} onView={setDetail} onEdit={setEditing} onDelete={setDeleting} />
          <div className="md:hidden space-y-3">
            {pageItems.map(({ b, status }) => (
              <BookingCard key={b.id} b={b} status={status} onView={setDetail} onEdit={setEditing} onDelete={setDeleting} />
            ))}
          </div>
        </>
      )}

      {/* Pagination (client-side) */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="btn btn--outline px-2.5 h-8 text-[12px] font-medium bg-white text-gray-500 disabled:opacity-40 transition">Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .map((n, idx, arr) => (
              <span key={n} className="flex items-center">
                {idx > 0 && n - arr[idx - 1] > 1 && <span className="px-1 text-gray-300">…</span>}
                <button onClick={() => setPage(n)}
                  className={`btn w-8 h-8 text-[12px] font-medium transition ${page === n ? 'bg-gray-900 text-white' : 'btn--outline bg-white text-gray-500'}`}>{n}</button>
              </span>
            ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="btn btn--outline px-2.5 h-8 text-[12px] font-medium bg-white text-gray-500 disabled:opacity-40 transition">Next</button>
        </div>
      )}

      {/* Modals */}
      {detail && (
        <BookingDetailModal
          b={detail}
          status={statusKey(detail)}
          onClose={() => setDetail(null)}
          onEdit={(b) => { setEditing(b); }}
          onCancel={() => handleCancel(detail.id)}
          onDelete={() => handleDelete(detail.id)}
          onRefund={(mode) => handleRefund(detail.id, mode)}
          onMarkComplete={() => handleSave(detail.id, { status: 'completed' })}
        />
      )}
      {editing && (
        <EditModal b={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
      {deleting && (
        <DeleteDialog b={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => { handleDelete(deleting.id); setDeleting(null); }} />
      )}
    </div>
  );
};

export default AdminBookings;
