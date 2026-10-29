// Brand loading spinner — 8 rounded-square "petals" in one colour with stepped
// opacity, rotating as a wheel. Single source of truth for page/section
// loaders across the app (replaces the old circular border-ring spinners).
//
// `color` defaults to the brand orange (DEFAULT_THEME_COLOR); pass a host's
// theme_color to theme it, e.g. on the booking flow.
export default function PetalSpinner({
  size = 48,
  color = '#0079C1',
  className = '',
  label = 'Loading',
}) {
  return (
    // animate-spin === @keyframes spin { to { transform: rotate(360deg) } },
    // same rotation the booking-entry petal uses.
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className={`animate-spin ${className}`.trim()}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          key={i}
          x="37"
          y="9"
          width="26"
          height="26"
          rx="9"
          fill={color}
          opacity={0.12 + i * 0.11}
          transform={`rotate(${i * 45} 50 50)`}
        />
      ))}
    </svg>
  );
}
