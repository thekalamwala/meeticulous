// Grow → Your page — the booking-page editor (Kept; borrows Linktree Appearance and
// Topmate Profile). Guest-facing fields only (founder split, 2026-11-26): photo,
// cover, name, title, location, bio, link, categories, social links, colours.
// Private and rule fields (date of birth, search keywords, maps link, reschedule
// fee, visibility, integrations) stay in Settings → Account.
//
// Desktop: the form on the left, a live phone preview + share kit on the right.
// Phone: the form, with Preview and Share in the thumb zone; both open sheets.
// Saves through the same updateProfile call Account uses, sending only the fields
// this page edits (the server ignores keys it is not sent).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Camera, Check, ChevronRight, Copy, Download, ExternalLink, Eye, Lock, MapPin, QrCode, Share2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getAvailability, getMyKyc, getMyServices, updateProfile } from '../../services/api';
import ImageCropper from '../../components/common/ImageCropper';
import FeatureGate from '../../components/common/FeatureGate';
import UsernameField from '../../components/dashboard/UsernameField';
import CategoriesSection from '../../components/dashboard/CategoriesSection';
import SetupGuide, { buildSetupSteps } from '../../components/dashboard/SetupGuide';
import { Skeleton } from '../../components/dashboard/ui';
import { WhatsAppIcon, cn, inr } from '../../components/dashboard/ui/v2';
import { fieldError } from '../../utils/apiError';
import {
  CREATOR_COLORS, DEFAULT_COVER_IMAGE, DEFAULT_THEME_COLOR, canUseCustomHex, getColorsForPlan,
  getContrastColor, isFreePlan, isValidHex,
} from '../../utils/themeUtils';
import {
  COVER_ASPECT, SOCIAL_PLATFORMS, handleFromUrl, sanitizeSocialLinks, urlFromHandle,
} from '../ProfileSetup';
import GrowShell, {
  CardHead, Field, PinnedBar, Sheet, btnPrimary, btnSoft, card, input, press, readShared, ring, rowBase, tappable,
  useCopyPageLink, useIsDesktop,
} from './GrowShell';
import { pageFields, pagePayload, pageUrl, waShare } from './growModel';

/* ── Live preview — a phone-sized copy of the public page, from the form. ─ */
export const PagePreview = ({ form, services, username, className = '' }) => {
  const tc = isValidHex(form.theme_color) ? form.theme_color : DEFAULT_THEME_COLOR;
  const onTc = getContrastColor(tc);
  const socials = SOCIAL_PLATFORMS.filter((p) => String(form.social_links?.[p.key] || '').trim());
  const list = (services || []).filter((s) => s.is_active !== false).slice(0, 4);
  return (
    <div className={cn('mx-auto w-full max-w-[320px] select-none rounded-[44px] bg-ink p-2.5', className)} aria-label="Preview of your booking page">
      <div className="relative h-[600px] overflow-hidden rounded-[36px] bg-cream">
        <div className="h-full overflow-y-auto dash-noscrollbar">
          <div className="aspect-[3/1] w-full overflow-hidden bg-blush">
            <img src={form.cover_image || DEFAULT_COVER_IMAGE} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="px-4 pb-6">
            <div className="-mt-8 h-16 w-16 overflow-hidden rounded-[18px] border-[3px] border-white bg-white">
              {form.profile_image
                ? <img src={form.profile_image} alt="" className="h-full w-full object-cover" />
                : <span className="grid h-full w-full place-items-center bg-blush font-display text-[22px] font-extrabold text-maroon">{(form.name || '?').charAt(0).toUpperCase()}</span>}
            </div>
            <p className="mb-0 mt-2 line-clamp-2 break-words font-display text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{form.name || 'Your name'}</p>
            {form.profession && <p className="mb-0 mt-0.5 truncate text-[12.5px] font-semibold" style={{ color: tc }}>{form.profession}</p>}
            {form.location && (
              <p className="mb-0 mt-1 flex items-center gap-1 truncate text-[12px] text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />{form.location}</p>
            )}
            {form.bio
              ? <p className="mb-0 mt-2.5 line-clamp-4 whitespace-pre-line break-words text-[12.5px] leading-relaxed text-ink/75">{form.bio}</p>
              : <p className="mb-0 mt-2.5 text-[12.5px] italic text-faint">Your bio shows here.</p>}
            {socials.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {socials.slice(0, 6).map((p) => (
                  <span key={p.key} className="rounded-[8px] bg-white px-2 py-1 text-[12px] font-medium text-ink/70">{p.label.replace(/ \(.*\)$/, '')}</span>
                ))}
                {socials.length > 6 && <span className="rounded-[8px] bg-white px-2 py-1 text-[12px] font-medium text-muted">+{socials.length - 6}</span>}
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {list.length === 0 && <p className="mb-0 rounded-[16px] bg-white p-3 text-[12px] text-muted">What you sell shows here once you add it.</p>}
              {list.map((s) => (
                <div key={s.id} className="rounded-[16px] bg-white p-3">
                  <p className="mb-0 truncate text-[13px] font-semibold text-ink">{s.title}</p>
                  <p className="mb-0 mt-0.5 truncate text-[12px] text-muted">
                    {s.duration ? `${s.duration} min · ` : ''}{Number(s.price) > 0 ? inr(s.price) : 'Free'}
                  </p>
                  <span className="mt-2 block rounded-[10px] py-1.5 text-center text-[12px] font-semibold" style={{ background: tc, color: onTc }}>Book</span>
                </div>
              ))}
            </div>
            <p className="mb-0 mt-5 text-center text-[12px] text-faint">{username ? `meeticulous.com/${username}` : 'Set your link below'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Share kit — copy, WhatsApp, QR, open. ───────────────────────────────── */
const QrBlock = ({ url, username }) => {
  const wrap = useRef(null);
  const download = () => {
    const canvas = wrap.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${username || 'booking-page'}-qr.png`;
    a.click();
  };
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div ref={wrap} className="rounded-[20px] bg-white p-4 ring-1 ring-neutral-200">
        <QRCodeCanvas value={url} size={200} marginSize={0} fgColor="#2B0A14" />
      </div>
      <p className="mb-0 max-w-[30ch] text-center text-[13px] text-muted">Print it on a flyer or your counter. Scanning opens your booking page.</p>
      <button type="button" onClick={download} className={btnSoft}><Download className="h-4 w-4" strokeWidth={2.2} /> Download PNG</button>
    </div>
  );
};

const ShareRows = ({ url, onCopy, onQr }) => {
  const nativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const rows = [
    { key: 'copy', icon: Copy, label: 'Copy link', sub: 'Paste it in your bio or a message', onClick: onCopy },
    { key: 'wa', icon: WhatsAppIcon, label: 'Share on WhatsApp', sub: 'Pick a chat or your status', href: waShare(url) },
    { key: 'qr', icon: QrCode, label: 'QR code', sub: 'For print and in-person', onClick: onQr },
    { key: 'open', icon: ExternalLink, label: 'Open your page', sub: 'See it as a guest does', href: url },
    nativeShare && { key: 'more', icon: Share2, label: 'More options', sub: 'Any app on this phone', onClick: () => navigator.share({ url }).catch(() => {}) },
  ].filter(Boolean);
  return (
    <ul className="-mx-4 divide-y divide-neutral-200">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-pink-100 text-maroon"><r.icon className="h-5 w-5" strokeWidth={2} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">{r.label}</span>
              <span className="block truncate text-[12.5px] text-muted">{r.sub}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} />
          </>
        );
        return (
          <li key={r.key}>
            {r.href
              ? <a href={r.href} target="_blank" rel="noreferrer" className={cn(rowBase, 'px-4 sm:px-4')}>{inner}</a>
              : <button type="button" onClick={r.onClick} className={cn(rowBase, 'px-4 sm:px-4')}>{inner}</button>}
          </li>
        );
      })}
    </ul>
  );
};

const ShareKitCard = ({ url, username, onCopy, onQr }) => (
  <section aria-labelledby="share-kit" className={cn(card, 'p-5')}>
    <h2 id="share-kit" className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">Share your page</h2>
    {url ? (
      <>
        <p className="mb-0 mt-1 truncate text-[14px] font-medium text-maroon" title={url}>{url.replace(/^https?:\/\//, '')}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCopy} className={btnPrimary}><Copy className="h-4 w-4" strokeWidth={2.2} /> Copy link</button>
          <a href={waShare(url)} target="_blank" rel="noreferrer" className={cn(btnSoft, tappable)}><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
          <button type="button" onClick={onQr} className={btnSoft}><QrCode className="h-4 w-4" strokeWidth={2.2} /> QR code</button>
          <a href={url} target="_blank" rel="noreferrer" className={cn(btnSoft, tappable)}><ExternalLink className="h-4 w-4" strokeWidth={2.2} /> Open page</a>
        </div>
      </>
    ) : (
      <p className="mb-0 mt-1 text-[14px] text-muted">Pick your link in <span className="font-semibold text-ink">Link and category</span> to get a page you can share.</p>
    )}
  </section>
);

/* ── Social links — a row per platform; tap to edit in a sheet. ─────────── */
const SocialCard = ({ form, setSocial, isPro }) => {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const p = SOCIAL_PLATFORMS.find((x) => x.key === editing);
  const open = (pl) => { setEditing(pl.key); setDraft(handleFromUrl(pl, form.social_links?.[pl.key])); };
  const done = () => { if (p) setSocial(p, draft); setEditing(null); };
  const filled = SOCIAL_PLATFORMS.filter((x) => String(form.social_links?.[x.key] || '').trim()).length;
  return (
    <section aria-labelledby="yp-social" className={cn(card, 'overflow-hidden')}>
      <CardHead title={<span id="yp-social">Social links</span>} sub={filled ? `${filled} on your page. Empty ones stay hidden.` : 'Only links you fill in show on your page.'} />
      <FeatureGate flag="social_links" fallback={<p className="mb-0 px-5 pb-5 pt-3 text-[14px] text-muted sm:px-6">Social links are switched off right now.</p>}>
        <ul className="mt-3 divide-y divide-neutral-200 border-t border-neutral-200">
          {SOCIAL_PLATFORMS.filter((pl) => !(pl.pro && !isPro)).map((pl) => {
            const val = String(form.social_links?.[pl.key] || '').trim();
            return (
              <li key={pl.key}>
                <button type="button" onClick={() => open(pl)} className={rowBase}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{pl.label}</span>
                    <span className={cn('block truncate text-[12.5px]', val ? 'text-muted' : 'text-faint')}>{val ? val.replace(/^https?:\/\/(www\.)?/, '') : 'Not added'}</span>
                  </span>
                  <span className="shrink-0 text-[13.5px] font-semibold text-maroon">{val ? 'Edit' : 'Add'}</span>
                </button>
              </li>
            );
          })}
          {/* Pro platforms on a free plan: one row that names them, not eleven locked rows. */}
          {!isPro && (
            <li>
              <Link to="/dashboard/upgrade?src=social" className={rowBase}>
                <Lock className="h-4 w-4 shrink-0 text-maroon" strokeWidth={2.2} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{SOCIAL_PLATFORMS.filter((x) => x.pro).length} more on Pro</span>
                  <span className="block truncate text-[12.5px] text-muted">{SOCIAL_PLATFORMS.filter((x) => x.pro).map((x) => x.label.replace(/ \(.*\)$/, '')).join(', ')}</span>
                </span>
                <span className="shrink-0 rounded-[8px] bg-pink-100 px-2 py-0.5 text-[12px] font-semibold text-maroon">Pro</span>
              </Link>
            </li>
          )}
        </ul>
      </FeatureGate>
      <Sheet open={!!p} onClose={() => setEditing(null)} title={p?.label || ''} width="sm:w-[420px]"
        footer={(
          <div className="flex gap-2">
            {String(form.social_links?.[p?.key] || '').trim() && (
              <button type="button" onClick={() => { setSocial(p, ''); setEditing(null); }} className={cn(btnSoft, 'flex-1')}>Remove</button>
            )}
            <button type="button" onClick={done} className={cn(btnPrimary, 'flex-1')}>Done</button>
          </div>
        )}>
        {p && (
          <form onSubmit={(e) => { e.preventDefault(); done(); }} className="pt-1">
            <Field label={p.plain ? (p.type === 'email' ? 'Email address' : 'Web address') : 'Your handle'} htmlFor="yp-social-input"
              hint={p.key === 'whatsapp' ? 'A public "message me" link. Your booking-alert number stays private.' : 'Guests tap it from your page.'}>
              {p.plain ? (
                <input id="yp-social-input" type={p.type} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={p.ph}
                  autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus className={cn(input, 'h-12')} />
              ) : (
                <div className="flex h-12 items-center overflow-hidden rounded-[16px] border border-neutral-200 bg-white transition focus-within:border-maroon focus-within:ring-[3px] focus-within:ring-rose/40">
                  <span className="shrink-0 pl-3.5 text-[15px] text-faint">{p.prefix}</span>
                  <input id="yp-social-input" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={p.ph}
                    autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-1 pr-3.5 text-[16px] text-ink outline-none placeholder:text-faint lg:text-[15px]" />
                </div>
              )}
            </Field>
          </form>
        )}
      </Sheet>
    </section>
  );
};

/* ── Colours — the brand swatches the plan allows; more on Pro. ─────────── */
const Swatch = ({ hex, name, on, onPick, disabled }) => (
  <button type="button" onClick={() => onPick?.(hex)} disabled={disabled} aria-pressed={on} aria-label={name}
    className={cn('relative grid h-11 w-11 place-items-center rounded-full transition', ring, press, on && 'ring-[3px] ring-ink ring-offset-2', disabled && 'cursor-not-allowed')}
    style={{ background: hex }}>
    {on && <Check className="h-4 w-4" style={{ color: getContrastColor(hex) }} strokeWidth={3} />}
  </button>
);

const ColourCard = ({ form, setColour, plan }) => {
  const available = getColorsForPlan(plan);
  const custom = canUseCustomHex(plan);
  const locked = CREATOR_COLORS.filter((c) => !available.some((a) => a.hex === c.hex)).slice(0, 6);
  const [hex, setHex] = useState(form.theme_color || '');
  useEffect(() => { setHex(form.theme_color || ''); }, [form.theme_color]);
  return (
    <FeatureGate flag="theme_colors">
      <section aria-labelledby="yp-colour" className={cn(card, 'pb-5 sm:pb-6')}>
        <CardHead title={<span id="yp-colour">Colour</span>} sub="Your buttons and accents on your page." />
        <div className="flex flex-wrap gap-3 px-5 pt-4 sm:px-6">
          {available.map((c) => <Swatch key={c.hex} hex={c.hex} name={c.name} on={form.theme_color === c.hex} onPick={setColour} />)}
        </div>
        {!custom && locked.length > 0 && (
          // Pro-locked: ghost swatches, never fake choices you can tap.
          <Link to="/dashboard/upgrade?src=theme" className={cn('mx-5 mt-4 flex items-center gap-3 rounded-[16px] bg-cream p-3 transition-colors hover:bg-pink-50 sm:mx-6', tappable, ring)}>
            <span aria-hidden="true" className="flex -space-x-2">
              {locked.map((c) => <span key={c.hex} className="h-7 w-7 rounded-full ring-2 ring-cream" style={{ background: c.hex, opacity: 0.45 }} />)}
            </span>
            <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">More colours and your own on Pro</span>
            <Lock className="h-4 w-4 shrink-0 text-maroon" strokeWidth={2.2} />
          </Link>
        )}
        {custom && (
          <FeatureGate flag="custom_hex_color">
            <div className="mx-5 mt-5 border-t border-neutral-200 pt-4 sm:mx-6">
              <Field label="Your own colour" htmlFor="yp-hex" hint="A hex code, like #960D32.">
                <div className="flex items-center gap-2">
                  <label className="relative h-12 w-12 shrink-0 cursor-pointer rounded-[16px] ring-1 ring-neutral-200" style={{ background: isValidHex(hex) ? hex : '#EBDCD9' }}>
                    <input type="color" value={isValidHex(hex) ? hex : '#960D32'} onChange={(e) => { setHex(e.target.value); setColour(e.target.value); }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Pick a colour" />
                  </label>
                  <input id="yp-hex" value={hex} maxLength={7} placeholder="#960D32" autoCapitalize="off" spellCheck={false}
                    onChange={(e) => { setHex(e.target.value); if (isValidHex(e.target.value)) setColour(e.target.value); }}
                    className={cn(input, 'h-12 flex-1 font-mono')} />
                </div>
              </Field>
            </div>
          </FeatureGate>
        )}
      </section>
    </FeatureGate>
  );
};

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function YourPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const plan = user?.plan || 'starter';
  const isPro = !isFreePlan(plan);
  const [form, setForm] = useState(() => pageFields(user));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropper, setCropper] = useState(null);
  const [setup, setSetup] = useState(null); // null = loading
  const [services, setServices] = useState([]);
  const [sheet, setSheet] = useState(null); // 'preview' | 'share' | 'qr'
  const [linkShared, setLinkShared] = useState(readShared);
  const editorRef = useRef(null);

  // Re-seed from the account when it changes underneath us, unless mid-edit.
  useEffect(() => { if (!dirty) setForm(pageFields(user)); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([
      getMyServices().then((r) => (Array.isArray(r?.data) ? r.data : null)).catch(() => null),
      getAvailability().then((r) => !!r?.data).catch(() => true),
      getMyKyc().then((r) => r?.data ?? null).catch(() => null),
    ]).then(([svcs, availabilitySet, kyc]) => {
      setServices(svcs || []);
      setSetup({ hasService: svcs ? svcs.length > 0 : true, availabilitySet, kyc });
    });
  }, []);

  // Unsaved edits: warn on refresh / tab close (same guard Account has).
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (key, v) => { setForm((f) => ({ ...f, [key]: v })); setDirty(true); };
  const setSocial = (p, raw) => { setForm((f) => ({ ...f, social_links: { ...f.social_links, [p.key]: urlFromHandle(p, raw) } })); setDirty(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Add your name first.'); return; }
    setSaving(true);
    try {
      const { data } = await updateProfile(pagePayload({ ...form, social_links: sanitizeSocialLinks(form.social_links) }));
      updateUser({ ...user, ...data, token: user.token, refresh_token: user.refresh_token });
      setDirty(false);
      toast.success('Your page is saved');
    } catch (err) {
      toast.error(fieldError(err, 'Could not save your page'));
    } finally {
      setSaving(false);
    }
  };
  const discard = () => { setForm(pageFields(user)); setDirty(false); };

  const url = pageUrl(user?.username);
  const copy = useCopyPageLink(user?.username, useCallback(() => setLinkShared(true), []));
  // The share kit sits on this screen, so the checklist drops its own "share" step:
  // one ask, one place.
  const steps = useMemo(() => (setup ? buildSetupSteps({ ...setup, user, linkShared }).filter((s) => s.key !== 'share') : []),
    [setup, user, linkShared]);
  const go = (to) => {
    if (to === '/dashboard/profile') { editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    navigate(to);
  };
  const tc = isValidHex(form.theme_color) ? form.theme_color : DEFAULT_THEME_COLOR;
  const bioLeft = 500 - (form.bio?.length || 0);

  const saveBar = (
    <div className="flex items-center gap-2">
      <p className="mb-0 hidden min-w-0 flex-1 truncate text-[14px] font-medium text-ink lg:block">You have unsaved changes</p>
      <button type="button" onClick={discard} disabled={saving} className={cn(btnSoft, 'flex-1 lg:flex-none')}>Discard</button>
      <button type="button" onClick={save} disabled={saving} className={cn(btnPrimary, 'flex-[2] lg:flex-none')}>{saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  );

  return (
    <GrowShell sub="What guests see when they open your link.">
      {cropper === 'profile' && (
        <ImageCropper aspect={1} folder="profiles" currentUrl={form.profile_image} name={form.name} themeColor={tc}
          onUploaded={(u) => { set('profile_image', u); setCropper(null); }} onClose={() => setCropper(null)} label="Profile photo" />
      )}
      {cropper === 'cover' && (
        <ImageCropper aspect={COVER_ASPECT} folder="covers" currentUrl={form.cover_image} name={form.name} themeColor={tc} avatarUrl={form.profile_image}
          onUploaded={(u) => { set('cover_image', u); setCropper(null); }} onClose={() => setCropper(null)} label="Cover photo" />
      )}

      {setup === null
        ? <Skeleton className="h-[120px] rounded-[24px]" />
        : <SetupGuide steps={steps} onGo={go} onCopy={copy} />}

      <div ref={editorRef} className="grid scroll-mt-20 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          {/* Profile — photo, cover and the words guests read first. */}
          <section aria-labelledby="yp-profile" className={cn(card, 'overflow-hidden')}>
            <FeatureGate flag="cover_photo" fallback={<div className="aspect-[3/1] bg-blush" />}>
              <button type="button" onClick={() => setCropper('cover')} className={cn('group relative block aspect-[3/1] w-full overflow-hidden bg-blush', ring)}
                aria-label={form.cover_image ? 'Change cover photo' : 'Add a cover photo'}>
                <img src={form.cover_image || DEFAULT_COVER_IMAGE} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-[10px] bg-ink/65 px-3 py-1.5 text-[12.5px] font-semibold text-white">
                  <Camera className="h-4 w-4" strokeWidth={2.2} /> {form.cover_image ? 'Change cover' : 'Add cover'}
                </span>
              </button>
            </FeatureGate>
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="flex items-end gap-3">
                <button type="button" onClick={() => setCropper('profile')} aria-label="Change profile photo"
                  className={cn('group relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-[22px] border-4 border-white bg-blush', ring)}>
                  {form.profile_image
                    ? <img src={form.profile_image} alt="" className="h-full w-full object-cover" />
                    : <span className="grid h-full w-full place-items-center font-display text-[28px] font-extrabold text-maroon">{(form.name || '?').charAt(0).toUpperCase()}</span>}
                  <span className="absolute inset-x-0 bottom-0 grid h-7 place-items-center bg-ink/55 text-white"><Camera className="h-4 w-4" strokeWidth={2.2} /></span>
                </button>
                <p className="mb-1 min-w-0 text-[12.5px] text-muted">{form.profile_image ? 'Tap your photo to change it.' : 'Add a photo so guests know who they are booking.'}</p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="yp-name">
                  <input id="yp-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder="Your name" autoComplete="name" className={cn(input, 'h-12')} />
                </Field>
                <Field label="Title" htmlFor="yp-title">
                  <input id="yp-title" value={form.profession} onChange={(e) => set('profession', e.target.value)} maxLength={80} placeholder="Growth coach" className={cn(input, 'h-12')} />
                </Field>
                <Field label="City" htmlFor="yp-city">
                  <input id="yp-city" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={80} placeholder="Pune" autoComplete="address-level2" className={cn(input, 'h-12')} />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Bio" htmlFor="yp-bio" count={<span className={cn('text-[12px] tabular-nums', bioLeft < 40 ? 'text-warning-fg' : 'text-faint')}>{bioLeft} left</span>}
                  hint="Who you help and how. Two or three short sentences read best.">
                  <textarea id="yp-bio" value={form.bio} onChange={(e) => set('bio', e.target.value)} maxLength={500} rows={4}
                    placeholder="I help small teams find the one fix that matters." className={cn(input, 'resize-y py-3 leading-relaxed')} />
                </Field>
              </div>
            </div>
          </section>

          {/* Link and category — each saves on its own, as it always has. */}
          <section aria-labelledby="yp-link" className={cn(card, 'pb-5 sm:pb-6')}>
            <CardHead title={<span id="yp-link">Link and category</span>} sub="Your link and categories save on their own." />
            <div className="mt-4 flex flex-col gap-5 px-5 sm:px-6">
              <UsernameField user={user} onChanged={(u) => updateUser({ ...user, username: u })} />
              <div className="flex flex-col gap-1.5">
                <p className="mb-0 text-[13px] font-semibold text-ink lg:text-[14px]">Category</p>
                <CategoriesSection plan={plan}
                  onSaved={(data) => updateUser({ ...user, primary_category: data.primary_category, categories: data.categories })} />
              </div>
            </div>
          </section>

          <SocialCard form={form} setSocial={setSocial} isPro={isPro} />
          <ColourCard form={form} setColour={(v) => set('theme_color', v)} plan={plan} />

          {/* Desktop save bar: sticks to the bottom of the window while there are edits. */}
          {dirty && (
            <div className={cn(card, 'sticky bottom-4 z-20 hidden p-3 pl-5 shadow-[var(--shadow-md)] lg:block')}>{saveBar}</div>
          )}

          <Link to="/dashboard/profile" className={cn(card, rowBase, 'rounded-[24px]')}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold text-ink">Account details</span>
              <span className="block truncate text-[12.5px] text-muted">Birthday, search keywords, booking rules, integrations</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} />
          </Link>
        </div>

        {/* Desktop: live preview + share kit, kept in view while you edit. */}
        <aside className="hidden flex-col gap-5 lg:sticky lg:top-20 lg:flex">
          <div className="flex items-center justify-between">
            <p className="mb-0 flex items-center gap-1.5 text-[13px] font-semibold text-muted"><Eye className="h-4 w-4" strokeWidth={2.2} /> Live preview</p>
            {dirty && <span className="rounded-[8px] bg-warning-bg px-2 py-0.5 text-[12px] font-semibold text-warning-fg">Not saved yet</span>}
          </div>
          <PagePreview form={form} services={services} username={user?.username} />
          <ShareKitCard url={url} username={user?.username} onCopy={copy} onQr={() => setSheet('qr')} />
        </aside>
      </div>

      {/* Phone: the screen's main actions in the thumb zone, outside PullToRefresh. */}
      {!isDesktop && (
        <PinnedBar>
          {dirty ? saveBar : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setSheet('preview')} className={cn(btnSoft, 'flex-1')}><Eye className="h-4 w-4" strokeWidth={2.2} /> Preview</button>
              <button type="button" onClick={() => (url ? setSheet('share') : toast.error('Pick your link first.'))} className={cn(btnPrimary, 'flex-1')}><Share2 className="h-4 w-4" strokeWidth={2.2} /> Share page</button>
            </div>
          )}
        </PinnedBar>
      )}

      {/* Room for the pinned bar above the tab bar, so the last card can scroll clear. */}
      <div aria-hidden="true" className="h-14 lg:hidden" />

      <Sheet open={sheet === 'preview'} onClose={() => setSheet(null)} title="Preview" bodyClassName="bg-cream pt-2">
        <PagePreview form={form} services={services} username={user?.username} />
        {dirty && <p className="mb-0 mt-3 text-center text-[12.5px] text-muted">Showing your unsaved changes.</p>}
      </Sheet>
      <Sheet open={sheet === 'share'} onClose={() => setSheet(null)} title="Share your page">
        {url && <ShareRows url={url} onCopy={() => { copy(); setSheet(null); }} onQr={() => setSheet('qr')} />}
      </Sheet>
      <Sheet open={sheet === 'qr'} onClose={() => setSheet(null)} title="QR code" width="sm:w-[420px]">
        {url && <QrBlock url={url} username={user?.username} />}
      </Sheet>
    </GrowShell>
  );
}
