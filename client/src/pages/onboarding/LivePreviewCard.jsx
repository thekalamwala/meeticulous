import { Video, MapPin, Repeat } from 'lucide-react';

// Live preview of the host's future public page. Deliberately mirrors the real
// HostProfile left card (client/src/pages/HostProfile.jsx): a 3:1 cover, a
// centered 100×100 square photo overlapping it, centered name + accent
// profession + bio, and a "Book Now" CTA. No ratings/stats — the real page
// hides those by design ("collect, don't display"), so the preview stays
// honest for a brand-new host.
//
// `serviceTitle`/`serviceDuration` are optional: the "You're live" step passes
// the first service being typed so it shows up as a service row (standing in
// for the real page's right-hand services column).
const BOOKING = {
  online_only:  { Icon: Video,  label: 'Online' },
  offline_only: { Icon: MapPin, label: 'In person' },
  both:         { Icon: Repeat, label: 'Online & in person' },
};

// Matches the real page's cover: 135° gradient of the theme colour, low→high
// opacity. New hosts use the brand primary until they pick a theme.
const COVER = 'linear-gradient(135deg, rgba(254,81,0,0.22), rgba(254,81,0,0.82))';

const LivePreviewCard = ({
  displayName,
  slug,
  personaLabel,
  personaTag,
  bookingType,
  whatsappNumber, // eslint-disable-line no-unused-vars -- kept for API compat
  tagline,
  photoUrl,
  serviceTitle,
  serviceDuration,
}) => {
  const booking = BOOKING[bookingType] || null;
  const initial = (displayName || 'S').trim().charAt(0).toUpperCase();
  const bio = tagline || personaTag || 'Add a one-line tagline so guests know what you offer.';

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_18px_40px_-24px_rgba(23,32,51,0.35)]">
      {/* Cover — 3:1, like the real page */}
      <div style={{ aspectRatio: '3 / 1', background: COVER }} />

      {/* Profile photo — 100×100 square, centered, overlapping cover */}
      <div className="-mt-10 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[14px] border-[3px] border-white bg-primary-light text-2xl font-bold text-primary-cta">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 text-center">
        {/* Name */}
        <h3 className="text-lg font-bold leading-tight text-gray-900">
          {displayName || 'Your name'}
        </h3>

        {/* Profession — accent, like the real page */}
        {personaLabel && (
          <p className="mt-0.5 text-sm font-medium text-primary">{personaLabel}</p>
        )}

        {/* Meeting mode — subtle, only once chosen (keeps step 3 reactive) */}
        {booking && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <booking.Icon className="h-3 w-3" strokeWidth={2.5} />
            {booking.label}
          </p>
        )}

        {/* Bio / tagline */}
        <p className="mx-auto mt-2.5 line-clamp-3 min-h-[2.5rem] max-w-[36ch] text-sm leading-relaxed text-gray-600">
          {bio}
        </p>

        {/* First service — shown on the "You're live" step as it's typed */}
        {serviceTitle && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
              {serviceTitle}
            </span>
            <span className="ml-2 shrink-0 text-xs font-medium text-gray-500">
              {serviceDuration ? `${serviceDuration} min · ` : ''}Free
            </span>
          </div>
        )}

        {/* CTA — matches the real page wording; visual only in preview */}
        <div className="mt-4 flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-bold text-white">
          Book Now
        </div>

        {/* Public URL caption */}
        <p className="mt-3 truncate font-mono text-[11px] text-gray-400">
          meeticulous.com/<span className="font-semibold text-primary-cta">{slug || 'your-url'}</span>
        </p>
      </div>
    </div>
  );
};

export default LivePreviewCard;
