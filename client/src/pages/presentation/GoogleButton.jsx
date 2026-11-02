// Canonical "Continue with Google" button (matches BecomeAHost.jsx signup):
// dark ink bg + real Google glyph + proper padding. The deck's old buttons used
// the global .btn-primary, which has no horizontal padding, so the label clipped
// the edge and read as a plain orange block instead of a Google sign-in button.
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1 11 11 0 002.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export default function GoogleButton({ className = '', label = 'Continue with Google', large = false }) {
  return (
    <a
      href="/become-a-host"
      className={`btn inline-flex items-center justify-center gap-3 rounded-[5px] bg-ink px-6 font-semibold text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] transition-opacity hover:opacity-90 ${large ? 'py-4 text-base' : 'py-3.5 text-sm'} ${className}`}
    >
      <GoogleIcon />
      {label}
    </a>
  );
}
