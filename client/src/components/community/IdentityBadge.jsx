import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from './AuthorChip';

// Role-coloured identity seal next to the author name. Colour encodes role:
//   guest grey · host rose · host+guest maroon · staff maroon + org mark.
// Staff accounts (Tithi, Shubham for now) also show the tiny Meeticulous mark,
// Twitter-affiliation style. Click opens a simple mini profile card (to grow later).
const ROLE_COLOR = {
  guest: '#8C716D',      // grey
  host: '#E0506F',       // rose
  host_guest: '#960D32', // maroon
  staff: '#960D32',      // maroon
};
const ROLE_LABEL = { guest: 'Guest', host: 'Host', host_guest: 'Host & guest', staff: 'Staff' };

// Filled scalloped check (same mark used on the host profile), tinted per role.
function Seal({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fill={color} d="M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      <path d="M8.5 12.5l2.25 2.25L15.5 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function IdentityBadge({ author }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!author || author.role === 'deleted') return null;
  const isStaff = author.badge === 'official' || author.badge === 'staff';
  const roleKey = isStaff ? 'staff' : (author.role || 'guest');
  const color = ROLE_COLOR[roleKey] || ROLE_COLOR.guest;

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${ROLE_LABEL[roleKey]} — view profile`}
        aria-expanded={open}
        className="inline-flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-maroon/40"
      >
        <Seal color={color} />
        {isStaff && <img src="/brand/ee-rounded-primary.svg" alt="" width="14" height="14" className="h-[14px] w-[14px] rounded-[3px]" loading="lazy" onError={(e) => e.currentTarget.remove()} />}
      </button>

      {open && (
        <span role="dialog" aria-label={`${author.display_name} profile`}
          className="absolute left-auto right-0 top-full z-50 mt-2 w-[min(15rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-[0_12px_32px_rgba(43,10,20,0.14)] sm:left-0 sm:right-auto">
          <span className="flex items-center gap-3">
            <Avatar author={author} size="m" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                {author.display_name}<Seal color={color} size={14} />
              </span>
              <span className="block text-xs text-muted">{ROLE_LABEL[roleKey]}{isStaff ? ' · Meeticulous' : ''}</span>
            </span>
          </span>
          {author.profile_url && (
            <Link to={author.profile_url} onClick={() => setOpen(false)}
              className="mt-3 block rounded-full bg-maroon/10 py-2 text-center text-sm font-semibold text-maroon no-underline hover:bg-maroon/15">
              View profile
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
