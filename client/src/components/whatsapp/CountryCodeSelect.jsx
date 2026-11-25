import MeetDropdown from '../ui/MeetDropdown';

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

// Dedupe by code for the dropdown value (US/Canada both +1): the trigger shows
// the flag + code, the panel adds the country name as a sublabel.
const OPTIONS = COUNTRIES.filter((c, i) => COUNTRIES.findIndex((x) => x.code === c.code) === i)
  .map((c) => ({ value: c.code, label: c.code, sublabel: c.name, icon: c.flag }));

const CountryCodeSelect = ({ value, onChange, disabled }) => (
  <MeetDropdown
    ariaLabel="Country code"
    className="mt-dd--inline"
    size="sm"
    value={value}
    onChange={onChange}
    options={OPTIONS}
    disabled={disabled}
  />
);

export default CountryCodeSelect;
