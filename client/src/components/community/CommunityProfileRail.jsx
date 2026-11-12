import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Calendar, Clock, Compass, Link2, Users, Wallet } from 'lucide-react';
import { getMyCard } from '../../services/communityApi';

const AV_BG = 'radial-gradient(120% 120% at 30% 20%,#FFD7E0,#FF9FB0 60%,#E0506F)';

function Seal({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Verified" className="shrink-0">
      <path fill="#960D32" d="M21 12c0 1.27-.63 2.39-1.59 3.07a3.75 3.75 0 0 1-1.04 3.3 3.75 3.75 0 0 1-3.3 1.04A3.75 3.75 0 0 1 12 21c-1.27 0-2.39-.63-3.07-1.59a3.75 3.75 0 0 1-3.3-1.04 3.75 3.75 0 0 1-1.04-3.3A3.75 3.75 0 0 1 3 12c0-1.27.63-2.39 1.59-3.07a3.75 3.75 0 0 1 1.04-3.3 3.75 3.75 0 0 1 3.3-1.04A3.75 3.75 0 0 1 12 3c1.27 0 2.39.63 3.07 1.59a3.75 3.75 0 0 1 3.3 1.04 3.75 3.75 0 0 1 1.04 3.3A3.75 3.75 0 0 1 21 12z" />
      <path d="M8.5 12.5l2.25 2.25L15.5 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({ v, l }) {
  return (
    <div className="min-w-0 flex-1">
      <dd className="font-display text-base font-extrabold leading-none text-ink tabular-nums">{v}</dd>
      <dt className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{l}</dt>
    </div>
  );
}

function RailLink({ to, icon: Icon, children }) {
  return (
    <Link to={to} className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink no-underline transition-colors hover:bg-pink-100 hover:text-maroon">
      <Icon size={18} className="text-muted" aria-hidden="true" />{children}
    </Link>
  );
}

// Left rail for the community home (v2, desktop): the signed-in host's card
// (bookings · rating · services) + their real workspace shortcuts, or a lighter
// guest variant. Stats come from GET /community/me/card; the card renders before
// they arrive and fills in (— until then), never blocking.
export default function CommunityProfileRail({ user }) {
  const [card, setCard] = useState(null);
  useEffect(() => {
    let live = true;
    getMyCard().then((d) => { if (live) setCard(d); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const name = user?.name || user?.first_name || 'You';
  const initial = name.charAt(0).toUpperCase();
  const isHost = card ? card.is_host : !!user?.is_host;
  const profileHref = card?.username ? `/${card.username}` : '/dashboard/profile';

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="h-16 bg-gradient-to-br from-blush via-cream to-[#FFF3E3]" />
        <div className="flex flex-col items-center px-4 pb-4 text-center">
          <div className="-mt-8 grid h-16 w-16 place-items-center rounded-[20px] border-4 border-white font-display text-2xl font-extrabold text-[#5c0620]" style={{ background: AV_BG }}>
            {user?.profile_image
              ? <img src={user.profile_image} alt="" className="h-full w-full rounded-[16px] object-cover" />
              : initial}
          </div>
          <div className="mt-2 flex items-center gap-1.5 font-display text-base font-extrabold leading-tight text-ink">
            {name}{card?.verified && <Seal />}
          </div>
          <div className="text-xs text-muted">{isHost ? 'Host' : 'Member'}{card?.member_since ? ` · since ${card.member_since}` : ''}</div>

          {isHost ? (
            <dl className="mt-3 flex w-full border-t border-line pt-3 text-center">
              <Stat v={card ? card.bookings : '—'} l="Bookings" />
              <Stat v={card?.rating != null ? `${card.rating}★` : 'New'} l="Rating" />
              <Stat v={card ? card.services : '—'} l="Services" />
            </dl>
          ) : (
            <p className="mt-3 w-full border-t border-line pt-3 text-xs text-muted">Welcome to the Circle — introduce yourself and find your people.</p>
          )}
        </div>
      </div>

      <nav aria-label={isHost ? 'Your workspace' : 'Explore'} className="rounded-2xl border border-line bg-white p-1.5 shadow-sm">
        <span className="mt-card__kicker block px-3 pb-1 pt-2">{isHost ? 'Your workspace' : 'Explore'}</span>
        {isHost ? (
          <>
            <RailLink to="/dashboard/bookings" icon={Calendar}>Bookings</RailLink>
            <RailLink to="/dashboard/services" icon={Briefcase}>Services</RailLink>
            <RailLink to="/dashboard/availability" icon={Clock}>Availability</RailLink>
            <RailLink to="/dashboard/earnings" icon={Wallet}>Earnings</RailLink>
            <RailLink to="/dashboard/clients" icon={Users}>Clients</RailLink>
          </>
        ) : (
          <>
            <RailLink to="/community" icon={Compass}>Explore spaces</RailLink>
            <RailLink to="/become-a-host" icon={Briefcase}>Become a host</RailLink>
          </>
        )}
      </nav>

      {isHost ? (
        <Link to={profileHref} className="flex items-center justify-center gap-2 rounded-2xl bg-maroon px-4 py-3 text-sm font-semibold text-cream no-underline transition-colors hover:bg-maroon-dark">
          <Link2 size={16} aria-hidden="true" />Share your booking link
        </Link>
      ) : (
        <Link to="/become-a-host" className="flex items-center justify-center rounded-2xl bg-maroon px-4 py-3 text-sm font-semibold text-cream no-underline transition-colors hover:bg-maroon-dark">
          Set up your booking page
        </Link>
      )}
    </div>
  );
}
