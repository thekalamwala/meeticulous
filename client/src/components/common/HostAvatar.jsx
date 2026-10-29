/**
 * HostAvatar / HostCover — one shared way to render a host's profile photo and
 * cover banner, with a single consistent fallback.
 *
 * Before this, every surface (explore cards, navbar, dashboard, service pages,
 * product page, admin) hand-rolled its own <img> + fallback. Fallbacks drifted:
 * explore used a REMOTE DiceBear SVG (an extra network dependency + a privacy
 * leak — it sends the host's name to a third party), everywhere else used local
 * initials, and shapes were inconsistent. These two components centralise that.
 *
 * Fallback = local initials on a tint of the host's theme colour. No network,
 * no third party.
 */
import { useState } from 'react';
import { DEFAULT_THEME_COLOR, isValidHex } from '../../utils/themeUtils';

const SHAPE_RADIUS = {
  circle: '9999px',
  rounded: '12px', // rounded-xl — the profile-card default
  soft: '16px',    // rounded-2xl
  square: '0px',
};

const initialOf = (name) => {
  const s = String(name || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
};

const safeTheme = (c) => (isValidHex(c) ? c : DEFAULT_THEME_COLOR);

/**
 * @param {string}  src        profile image URL (may be empty)
 * @param {string}  name       host name — drives the initials fallback + a11y
 * @param {string}  themeColor host theme colour for the fallback tint
 * @param {number}  size       px (width = height). Default 40.
 * @param {'circle'|'rounded'|'soft'|'square'} shape  default 'circle'
 * @param {boolean} eager      load immediately (above-the-fold). Default false → lazy.
 * @param {string}  className  extra classes (e.g. border colour/width)
 * @param {boolean} decorative true when a nearby label already names the host →
 *                             render empty alt so screen readers don't double-read
 */
export function HostAvatar({
  src, name, themeColor, size = 40, shape = 'circle',
  eager = false, className = '', decorative = false, style = {},
}) {
  // A stored URL can 404 (deleted object, stale reference in another tab). Fall
  // back to initials instead of a broken-image icon. Report edge case: "image
  // fails to load".
  const [broken, setBroken] = useState(false);
  const radius = SHAPE_RADIUS[shape] ?? SHAPE_RADIUS.circle;
  const dim = { width: size, height: size, borderRadius: radius };
  const alt = decorative ? '' : (name ? `${name}'s profile photo` : 'Host profile photo');

  if (!src || broken) {
    const tc = safeTheme(themeColor);
    return (
      <div
        className={`flex flex-shrink-0 items-center justify-center overflow-hidden font-semibold ${className}`}
        style={{ ...dim, background: `${tc}18`, color: tc, fontSize: Math.round(size * 0.42), ...style }}
        role="img"
        aria-label={decorative ? undefined : alt}
        aria-hidden={decorative || undefined}
      >
        {initialOf(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setBroken(true)}
      className={`flex-shrink-0 object-cover ${className}`}
      style={{ ...dim, ...style }}
    />
  );
}

/**
 * Cover banner. 3:1 by default (the canonical crop). Falls back to a subtle
 * theme-colour gradient — matches HostProfile / ServiceBooking / ProfileSetup.
 *
 * @param {boolean} eager set true only for the LCP cover on the public profile.
 */
export function HostCover({
  src, themeColor, aspect = '3 / 1', eager = false, className = '', style = {}, alt = '',
}) {
  const tc = safeTheme(themeColor);
  if (!src) {
    return (
      <div
        className={className}
        style={{ aspectRatio: aspect, background: `linear-gradient(135deg, ${tc}33, ${tc}88)`, ...style }}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchpriority={eager ? 'high' : undefined}
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
      style={{ aspectRatio: aspect, ...style }}
    />
  );
}

export default HostAvatar;
