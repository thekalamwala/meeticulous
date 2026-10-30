/**
 * ServiceCard.jsx — grid card for a single SERVICE (not a profile).
 *
 * Props:
 *   service — flat card from GET /api/explore .services[]:
 *     { id, slug, title, description, price, currency, coverImage, hostName,
 *       hostUsername, hostAvatar, avgRating, reviewCount, area, meetingMode,
 *       url, badges:{ isNew, availableThisWeek } }
 *   rank    — 1-based position in the current result set (for click analytics).
 *
 * Explore-only. HostProfile has its OWN local ServiceCard (defined inline there),
 * so restyling this one cannot reach it — checked by import, not by name.
 */
import { Link } from 'react-router-dom';
import { Star, BadgeCheck, MapPin, CalendarCheck, Users, Sparkles, ArrowRight } from 'lucide-react';
import { logExploreClick } from '../../services/api';
import { HostAvatar } from '../common/HostAvatar';

const Pill = ({ icon: Icon, tone, children }) => (
  <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium
                    ${tone === 'green'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-black/10 bg-black/[0.02] text-muted'}`}>
    <Icon size={11} className="shrink-0" /> <span className="truncate">{children}</span>
  </span>
);

export default function ServiceCard({ service, rank }) {
  const {
    id, slug, title = '', description = '', price, currency = 'INR', coverImage,
    hostName = 'Host', hostUsername = '#', hostAvatar,
    avgRating, reviewCount = 0, area = '', meetingMode = 'online',
    url, badges = {},
  } = service || {};

  const to        = url || (hostUsername && slug ? `/${hostUsername}/${slug}` : '#');
  const isFree    = !(price > 0);
  const priceText = isFree ? 'Free' : `${currency === 'INR' ? '₹' : '$'}${Number(price).toLocaleString('en-IN')}`;
  const modeLabel = meetingMode === 'offline' ? 'In-person' : 'Online';

  return (
    <Link
      to={to}
      onClick={() => logExploreClick({ serviceId: id, rank })}
      style={{ textDecoration: 'none' }}
      className="page-card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
    >
      {/* Cover 4:3, host chip overlaid on it */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F8FAFC]">
        <img src={coverImage || '/service-og-default.jpg'} alt={title} loading="lazy"
             className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />

        {badges.isNew && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-100
                           px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            <Sparkles size={9} /> New
          </span>
        )}

        {/* Scrim: white chip text is unreadable over a light host photo without it. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pt-8">
          <div className="flex items-center gap-2 p-3">
            <HostAvatar src={hostAvatar} name={hostName} size={32} decorative
                        className="border-2 border-white/80" />
            <div className="min-w-0">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-white">
                <span className="truncate">{hostName}</span>
                {/* Explore only lists is_verified hosts, so this is always true here. */}
                <BadgeCheck size={13} className="shrink-0 text-secondary" />
              </span>
              {reviewCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-white/80">
                  <Star size={10} className="fill-secondary text-secondary" />
                  {avgRating?.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-heading text-lg font-bold leading-snug text-ink line-clamp-2
                       transition-colors duration-150 group-hover:text-primary-cta">
          {title}
        </h3>

        {description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{description}</p>
        )}

        <div className="mb-4 mt-3 flex flex-wrap gap-1.5">
          {area && <Pill icon={MapPin}>{area}</Pill>}
          <Pill icon={Users}>{modeLabel}</Pill>
          {badges.availableThisWeek && (
            <Pill icon={CalendarCheck} tone="green">Available this week</Pill>
          )}
        </div>

        {/* Footer: mt-auto keeps footers aligned across a row when a card has no description. */}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-black/5 pt-3.5">
          <div>
            {!isFree && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Starts at</p>
            )}
            <p className="font-heading text-xl font-bold leading-tight text-ink">{priceText}</p>
            {!isFree && <p className="text-[11px] text-muted">per session</p>}
          </div>
          {/* A <span>, not an <a> — the whole card is already a <Link>; nesting anchors is invalid. */}
          <span className="btn inline-flex shrink-0 items-center gap-1.5 bg-primary px-4 py-2
                           text-[13px] font-semibold text-white transition-colors duration-150
                           group-hover:bg-[#2A1416]">
            Book Now <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
