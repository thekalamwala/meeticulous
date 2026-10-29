const COUNTRIES = [
  { iso: 'IN', code: '+91',  flag: '🇮🇳', name: 'India' },
  { iso: 'US', code: '+1',   flag: '🇺🇸', name: 'United States' },
  { iso: 'GB', code: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { iso: 'AE', code: '+971', flag: '🇦🇪', name: 'UAE' },
  { iso: 'AU', code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { iso: 'CA', code: '+1',   flag: '🇨🇦', name: 'Canada' },
  { iso: 'SG', code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { iso: 'DE', code: '+49',  flag: '🇩🇪', name: 'Germany' },
];

// Best-effort default dial code from the browser locale region; falls back to +91.
export const defaultDialCode = () => {
  try {
    const region = (navigator.language || '').split('-')[1]?.toUpperCase();
    return COUNTRIES.find((c) => c.iso === region)?.code || '+91';
  } catch {
    return '+91';
  }
};

const CountryCodeSelect = ({ value, onChange, disabled }) => (
  <select
    aria-label="Country code"
    className="fb-input fb-input--sm w-auto"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
  >
    {COUNTRIES.map((c) => (
      <option key={c.iso} value={c.code}>{c.flag} {c.code}</option>
    ))}
  </select>
);

export default CountryCodeSelect;
