import { Video, MapPin, Repeat } from 'lucide-react';

// Live preview of the host's future public page. Deliberately mirrors the real
// HostProfile left card (client/src/pages/HostProfile.jsx): a 3:1 cover, a
// centered square photo overlapping it, centered name + accent profession + bio,
// and a "Book Now" CTA. No ratings/stats — the real page hides those by design
// ("collect, don't display"), so the preview stays honest for a brand-new host.
//
// `pulseKey` — bump it whenever the host changes something; the card pulses so
// the change reads as "that just happened to MY page". `compact` renders the
// one-row variant pinned above the form on phones (the full card sits below
// the fold there, so without it mobile hosts never see the preview react).
const BOOKING = {
  online_only:  { Icon: Video,  label: 'Online' },
  offline_only: { Icon: MapPin, label: 'In person' },
  both:         { Icon: Repeat, label: 'Online & in person' },
};

const pulseClass = (k) => (!k ? '' : k % 2 ? 'onb-pulse-a' : 'onb-pulse-b');

// Host the page will actually live on — correct on staging/preview deploys too.
const host = () => (typeof window !== 'undefined' ? window.location.host : 'meeticulous.com');

const Avatar = ({ photoUrl, initial, className }) => (
  <div className={`flex items-center justify-center overflow-hidden bg-primary-light font-heading font-extrabold text-primary ${className}`}>
    {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : initial}
  </div>
);

const LivePreviewCard = ({
  displayName,
  slug,
  personaLabel,
  personaTag,
  bookingType,
  city,
  tagline,
  photoUrl,
  serviceTitle,
  serviceDuration,
  showServiceSlot = false,
  pulseKey = 0,
  compact = false,
}) => {
  const booking = BOOKING[bookingType] || null;
  const initial = (displayName || 'Y').trim().charAt(0).toUpperCase();
  const bio = tagline || personaTag || 'Your one-line intro appears here.';
  const url = `${host()}/${slug || 'your-link'}`;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 rounded-[6px] border border-black/5 bg-white p-2.5 shadow-[0_8px_30px_rgba(26,26,26,0.06)] ${pulseClass(pulseKey)}`}>
        <Avatar photoUrl={photoUrl} initial={initial} className="h-11 w-11 shrink-0 rounded-[6px] text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {displayName || 'Your name'}
            {personaLabel && <span className="font-medium text-primary"> · {personaLabel}</span>}
          </p>
          <p className="truncate text-xs text-muted">
            {serviceTitle ? `${serviceTitle} · ${serviceDuration} min` : url}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-success-fg">
          <span className="h-1.5 w-1.5 rounded-full bg-success-fg" /> Live preview
        </span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.06)] ${pulseClass(pulseKey)}`}>
      {/* Cover — 3:1, like the real page; brand crimson until they pick a theme */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/85" style={{ aspectRatio: '3 / 1' }} />

      <div className="-mt-10 flex justify-center">
        <Avatar photoUrl={photoUrl} initial={initial} className="h-20 w-20 rounded-[10px] border-[3px] border-white text-2xl" />
      </div>

      <div className="px-5 pb-5 pt-3 text-center">
        <h3 className="font-heading text-lg font-bold leading-tight text-ink">{displayName || 'Your name'}</h3>
        <p className="mt-0.5 min-h-[1.25rem] text-sm font-medium text-primary">{personaLabel || 'What you do'}</p>

        {booking && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <booking.Icon className="h-3 w-3" strokeWidth={2.5} />
            {booking.label}{city ? ` · ${city}` : ''}
          </p>
        )}

        <p className="mx-auto mt-2.5 line-clamp-3 min-h-[2.5rem] max-w-[36ch] text-sm leading-relaxed text-muted">{bio}</p>

        {serviceTitle ? (
          <div className="onb-rise mt-4 flex items-center justify-between rounded-[6px] border border-primary/30 bg-canvas px-3 py-2.5 text-left">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{serviceTitle}</span>
            <span className="ml-2 shrink-0 text-xs font-medium text-muted">
              {serviceDuration ? `${serviceDuration} min · ` : ''}Free
            </span>
          </div>
        ) : showServiceSlot ? (
          <div className="mt-4 rounded-[6px] border border-dashed border-black/15 px-3 py-2.5 text-sm text-muted">
            Your first service shows here
          </div>
        ) : null}

        {/* CTA — matches the real page wording; visual only in preview */}
        <div className="mt-4 flex w-full items-center justify-center rounded-[6px] bg-primary py-2.5 text-sm font-bold text-white">
          Book Now
        </div>

        <p className="mt-3 truncate font-mono text-[11px] text-muted">
          {host()}/<span className="font-semibold text-primary">{slug || 'your-link'}</span>
        </p>
      </div>
    </div>
  );
};

export default LivePreviewCard;
