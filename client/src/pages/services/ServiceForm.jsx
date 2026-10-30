/**
 * ServiceForm — shared component for Add and Edit service pages.
 * Handles: basic info, thumbnail crop/zoom, rich text, inclusions/exclusions, FAQ builder, notes.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, MapPin, AlertTriangle } from 'lucide-react';
import { svcCreate, svcUpdate, uploadImage, hostGetCategories, listServiceCategories, hostSuggestServiceCategory, aiGenerateListing, updateProfile, getPriceBenchmark } from '../../services/api';
import toast from 'react-hot-toast';
import { TrendingUp } from 'lucide-react';
import FeatureGate from '../../components/common/FeatureGate';
import ThumbnailCropper from '../../components/common/ThumbnailCropper';
import { PageHeader, Card, Button, Input, Select, Textarea, cn } from '../../components/dashboard/ui';
import { BOLT_ENABLED } from '../../config/aiListing';
import { useAuth } from '../../context/AuthContext';
import { normalizePlan } from '../../utils/themeUtils';

// ₹ floor for paid services on the self-serve plans; Supreme is exempt, ₹0 free is
// always allowed. Mirrors the server's planMiddleware.MIN_SERVICE_PRICE.
const MIN_SERVICE_PRICE = 100;

// Advisory price benchmark chip — "similar hosts charge ₹X–₹Y". On-demand (not on
// mount): the host taps to fetch. Data-grounded, never an LLM guess. Hides itself
// when the platform sample is too thin (server returns median:null). onPick fills
// the price input; nothing auto-applies. See docs/specs/ai-price-suggestion.md.
export const PriceBenchmark = ({ category, onPick }) => {
  const [state, setState] = useState('idle'); // idle | loading | done | empty | error
  const [data, setData]   = useState(null);

  const load = async () => {
    setState('loading');
    try {
      const { data: b } = await getPriceBenchmark(category);
      if (b && b.median != null) { setData(b); setState('done'); }
      else setState('empty');
    } catch {
      setState('error');
    }
  };

  if (state === 'idle' || state === 'loading') {
    return (
      <button type="button" onClick={load} disabled={state === 'loading'}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-cta hover:underline disabled:opacity-50">
        <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        {state === 'loading' ? 'Checking…' : 'See what similar hosts charge'}
      </button>
    );
  }
  if (state === 'empty' || state === 'error') {
    return (
      <p className="mt-2 text-xs text-gray-400">
        {state === 'empty' ? 'Not enough similar listings yet to suggest a price.' : 'Could not load pricing data.'}
      </p>
    );
  }
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-xs text-gray-500">
        Similar hosts charge <span className="font-semibold text-ink">₹{data.low}–₹{data.high}</span>{' '}
        ({data.sample_size} listing{data.sample_size === 1 ? '' : 's'}). Tap to use:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {[['Low', data.low], ['Median', data.median], ['High', data.high]].map(([label, val]) => (
          <button key={label} type="button" onClick={() => onPick(val)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary-cta">
            {label} ₹{val}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DURATIONS = [
  { value: 15,   label: '15 Minutes' },
  { value: 30,   label: '30 Minutes' },
  { value: 45,   label: '45 Minutes' },
  { value: 60,   label: '60 Minutes' },
  { value: 90,   label: '90 Minutes' },
  { value: 120,  label: '120 Minutes' },
  { value: 0,    label: 'Custom' },
];
const GRACE_PERIODS = [
  { value: 0,  label: '0 Minutes' },
  { value: 5,  label: '5 Minutes' },
  { value: 10, label: '10 Minutes' },
  { value: 15, label: '15 Minutes' },
  { value: 30, label: '30 Minutes' },
];

const empty = () => ({
  title: '',
  short_description: '',
  service_type: 'online',
  price: '',
  price_on_request: false,
  duration: 30,
  custom_duration: '',
  grace_period: 0,
  thumbnail_url: '',
  long_description: '',
  included_items: [],
  excluded_items: [],
  faqs: [],
  important_note: '',
  category: '',
});

const fieldLabel = "mb-1 block text-sm font-medium text-gray-700";

// ─── Tiny Rich Text Editor ────────────────────────────────────────────────────

const RichEditor = ({ value, onChange }) => {
  const ref = useRef(null);
  const isComposing = useRef(false);

  // Re-sync on external value changes (e.g. Write-with-Bolt fills long_description
  // async after mount). The innerHTML !== value guard skips during normal typing —
  // onChange already set innerHTML to value, so they're equal and the caret is left
  // alone; it only fires when value is changed from outside the editor.
  useEffect(() => {
    if (isComposing.current) return;
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    ref.current?.focus();
    onChange(ref.current?.innerHTML || '');
  };

  const tools = [
    { icon: '<b>B</b>',  title: 'Bold',          cmd: 'bold' },
    { icon: '<i>I</i>',  title: 'Italic',        cmd: 'italic' },
    { icon: '<u>U</u>',  title: 'Underline',     cmd: 'underline' },
    { icon: 'H2',        title: 'Heading 2',     cmd: 'formatBlock', val: 'h2' },
    { icon: 'H3',        title: 'Heading 3',     cmd: 'formatBlock', val: 'h3' },
    { icon: '¶',         title: 'Paragraph',     cmd: 'formatBlock', val: 'p' },
    { icon: '≡',         title: 'Bullet List',   cmd: 'insertUnorderedList' },
    { icon: '1.',        title: 'Ordered List',  cmd: 'insertOrderedList' },
  ];

  const handleLink = () => {
    const sel = window.getSelection()?.toString();
    if (!sel) { toast('Select some text first'); return; }
    const url = window.prompt('URL:');
    if (url) exec('createLink', url);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-primary/30">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-2">
        {tools.map(t => (
          <button key={t.cmd + (t.val||'')} type="button" title={t.title}
            onMouseDown={e => { e.preventDefault(); exec(t.cmd, t.val || null); }}
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 transition-all hover:bg-white hover:shadow-sm"
            dangerouslySetInnerHTML={{ __html: t.icon }}/>
        ))}
        <button type="button" title="Link" onMouseDown={e => { e.preventDefault(); handleLink(); }}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 transition-all hover:bg-white hover:shadow-sm">
          🔗
        </button>
      </div>
      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; onChange(ref.current?.innerHTML || ''); }}
        onInput={() => { if (!isComposing.current) onChange(ref.current?.innerHTML || ''); }}
        className="prose prose-sm min-h-[200px] max-w-none p-4 text-sm text-gray-700 focus:outline-none"
        style={{ lineHeight: 1.7 }}
        data-placeholder="Write a detailed overview of your service…"
      />
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:#9ca3af;pointer-events:none;}`}</style>
    </div>
  );
};

// ─── Tag Input (inclusions / exclusions) ─────────────────────────────────────

const TagInput = ({ value, onChange, placeholder, color = 'green' }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const colors = {
    green: 'bg-green-50 text-green-800 border-green-200',
    red:   'bg-red-50 text-red-800 border-red-200',
  };

  const add = (raw) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInput('');
  };

  const remove = (tag) => onChange(value.filter(t => t !== tag));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
    if (e.key === 'Backspace' && !input && value.length) remove(value[value.length - 1]);
  };

  return (
    <div className="flex min-h-[48px] cursor-text flex-wrap gap-1.5 rounded-xl border border-gray-200 bg-white p-2 focus-within:ring-2 focus-within:ring-primary/30"
      onClick={() => inputRef.current?.focus()}>
      {value.map(tag => (
        <span key={tag} className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium', colors[color])}>
          {tag}
          <button type="button" onClick={() => remove(tag)} className="hover:opacity-70">×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder-gray-400"
      />
    </div>
  );
};

// ─── FAQ Builder ──────────────────────────────────────────────────────────────

const FAQBuilder = ({ value, onChange }) => {
  const add = () => onChange([...value, { question: '', answer: '' }]);
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const update = (i, key, val) => {
    const next = [...value];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...value];
    [next[i-1], next[i]] = [next[i], next[i-1]];
    onChange(next);
  };
  const moveDown = (i) => {
    if (i === value.length - 1) return;
    const next = [...value];
    [next[i], next[i+1]] = [next[i+1], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.map((faq, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">FAQ {i + 1}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => moveUp(i)} disabled={i === 0}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-700 disabled:opacity-30">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
              </button>
              <button type="button" onClick={() => moveDown(i)} disabled={i === value.length - 1}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-700 disabled:opacity-30">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </button>
              <button type="button" onClick={() => remove(i)}
                className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <Input type="text" value={faq.question} onChange={e => update(i, 'question', e.target.value)} placeholder="Question" className="mb-2 bg-white" />
          <Textarea rows={3} value={faq.answer} onChange={e => update(i, 'answer', e.target.value)} placeholder="Answer" className="bg-white" />
        </div>
      ))}
      <button type="button" onClick={add} className="mt-1 flex items-center gap-2 text-sm font-medium text-primary transition-opacity hover:opacity-80">
        <Plus className="h-4 w-4" /> Add FAQ
      </button>
    </div>
  );
};

const SuggestSubcategoryModal = ({ primary, onClose }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const v = name.trim();
    if (v.length < 2) return toast.error('Enter a subcategory name');
    setSaving(true);
    try {
      await hostSuggestServiceCategory({ primary_category: primary, name: v });
      toast.success('Sent for approval');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not submit');
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-gray-900 mb-1">Suggest a subcategory</h3>
        <p className="text-[12px] text-gray-500 mb-3">An admin will review it before it goes live.</p>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. Wedding Photography"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#960D32] focus:outline-none" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="rounded-lg bg-[#960D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2A1416] disabled:opacity-50">
            {saving ? 'Sending…' : 'Send for approval'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ServiceForm ─────────────────────────────────────────────────────────────

export default function ServiceForm({ initialData, serviceId }) {
  const navigate = useNavigate();
  const isEdit = !!serviceId;
  const { user, updateUser } = useAuth() || {};
  // Offline (in-person) services need a venue. map_link is a profile-level field
  // (shared across all the host's offline services), so it's edited inline here
  // and saved to the profile on submit — not stored on the service row.
  const [mapLink, setMapLink]       = useState(user?.map_link || '');
  const hadMapLink                  = Boolean((user?.map_link || '').trim());
  // Interim fee-only mode: paid listings are disabled (no Razorpay Route yet), so
  // hide the price field and force ₹0. Fail-safe true. Server enforces this too.
  const feeOnly = user?.fee_only_mode ?? true;

  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        title:             initialData.title || '',
        short_description: initialData.short_description || initialData.description || '',
        service_type:      initialData.meeting_mode || initialData.service_type || 'online',
        price:             initialData.price ?? '',
        price_on_request:  initialData.price_on_request === true,
        duration:          DURATIONS.find(d => d.value === initialData.duration) ? initialData.duration : 0,
        custom_duration:   DURATIONS.find(d => d.value === initialData.duration) ? '' : String(initialData.duration || ''),
        grace_period:      initialData.grace_period_minutes ?? initialData.grace_period ?? 0,
        thumbnail_url:     initialData.thumbnail_url || '',
        long_description:  initialData.long_description || '',
        included_items:    Array.isArray(initialData.included_items) ? initialData.included_items : [],
        excluded_items:    Array.isArray(initialData.excluded_items) ? initialData.excluded_items : [],
        faqs:              Array.isArray(initialData.faqs) ? initialData.faqs : [],
        important_note:    initialData.important_note || '',
        category:          initialData.category || '',
      };
    }
    return empty();
  });

  const [saving, setSaving] = useState(false);
  const [svcCats, setSvcCats] = useState([]);   // [{ id, name, slug }] for the host's profession
  const [primaryCat, setPrimaryCat]     = useState(null);
  const [allowSuggest, setAllowSuggest] = useState(false);
  const [suggestOpen, setSuggestOpen]   = useState(false);

  useEffect(() => {
    let alive = true;
    // Service categories are scoped to the host's primary profession. Fetch the
    // host's primary_category, then its active service-category list. Failures
    // resolve to an empty picker (category stays optional) rather than blocking.
    hostGetCategories()
      .then((h) => {
        const primary = h.data?.primary_category || null;
        return Promise.all([
          primary,
          listServiceCategories(primary).catch(() => ({ data: { categories: [] } })),
        ]);
      })
      .then(([primary, sc]) => {
        if (!alive) return;
        const list = sc.data?.categories || [];
        setSvcCats(list);
        setPrimaryCat(primary);
        setAllowSuggest(Boolean(sc.data?.allow_suggestions));
        // Default to the existing value (edit) or the first available category.
        setForm((f) => (f.category ? f : { ...f, category: initialData?.category || list[0]?.slug || '' }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── "Write with Bolt" — AI listing generation (Task 7) ──────────────────
  // Populates fields from a server-side AI draft. Host input stays intact:
  // this only fires on demand and merges into existing form state.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFields, setAiFields]   = useState(() => new Set());
  const [aiSession, setAiSession] = useState(null);
  const [aiError, setAiError]     = useState('');
  const [aiTweak, setAiTweak]     = useState('');

  const runBolt = async (regenerate = false) => {
    if (!BOLT_ENABLED || !form.title.trim() || aiLoading) return;
    setAiLoading(true); setAiError('');
    try {
      const body = { title: form.title, category: form.category || undefined, price: form.price || undefined, duration: form.duration || undefined };
      if (regenerate && aiSession) { body.session_id = aiSession; if (aiTweak.trim()) body.tweak = aiTweak.trim(); }
      const { data } = await aiGenerateListing(body);
      setForm(f => ({ ...f, ...data.fields }));
      setAiFields(new Set(Object.keys(data.fields)));
      setAiSession(data.session_id);
    } catch (e) {
      setAiError(e?.response?.data?.message || 'AI writing failed. You can fill the form manually.');
    } finally { setAiLoading(false); }
  };

  const titleLen = (form.title || '').length;
  const shortLen = (form.short_description || '').length;

  const effectiveDuration = form.duration === 0 ? parseInt(form.custom_duration) || '' : form.duration;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.short_description.trim()) { toast.error('Short description is required'); return; }
    // "Price on request" services quote offline, so the price field is optional
    // and the minimum-price floor doesn't apply (they book as a no-payment enquiry).
    if (!feeOnly && !form.price_on_request && !form.price && form.price !== 0) { toast.error('Price is required'); return; }
    // Minimum paid-service price on non-Supreme plans (₹0 free is fine; Supreme exempt).
    const priceNum = parseFloat(form.price) || 0;
    if (!feeOnly && !form.price_on_request && normalizePlan(user?.plan) !== 'supreme' && priceNum > 0 && priceNum < MIN_SERVICE_PRICE) {
      toast.error(`Paid services must be at least ₹${MIN_SERVICE_PRICE}. Set a higher price, or make it free (₹0).`);
      return;
    }
    // Thumbnail is OPTIONAL — a missing image falls back to the Meeticulous
    // service card (see seo.js / prerenderController + ServiceCard / ServiceDetail).
    // Requiring it here was the main add-service drop-off point.
    if (!effectiveDuration || effectiveDuration < 1) { toast.error('Duration is required'); return; }
    const isOffline = form.service_type === 'offline';
    if (isOffline && !mapLink.trim()) {
      toast.error('Add a venue map link — it’s required for in-person (offline) services.');
      return;
    }

    setSaving(true);
    try {
      // Offline service needs a venue on the profile. Persist the map link first
      // (server also hard-blocks the service write if it's still missing), then
      // keep the auth session in sync so re-opening the form shows it prefilled.
      if (isOffline && mapLink.trim() !== (user?.map_link || '')) {
        await updateProfile({ map_link: mapLink.trim() });
        updateUser?.({ map_link: mapLink.trim() });
      }
      const payload = {
        title:             form.title.trim(),
        short_description: form.short_description.trim(),
        description:       form.short_description.trim(), // legacy compat
        service_type:      form.service_type,
        meeting_mode:      form.service_type,
        price:             feeOnly ? 0 : (parseFloat(form.price) || 0),
        price_on_request:  !!form.price_on_request,
        duration:          effectiveDuration,
        grace_period:      form.grace_period,
        grace_period_minutes: form.grace_period,
        thumbnail_url:     form.thumbnail_url,
        long_description:  form.long_description,
        included_items:    form.included_items,
        excluded_items:    form.excluded_items,
        faqs:              form.faqs,
        important_note:    form.important_note,
        category:          form.category || null,
      };

      if (isEdit) {
        await svcUpdate(serviceId, payload);
        toast.success('Service updated!');
      } else {
        await svcCreate(payload);
        toast.success('Service created!');
      }
      navigate('/dashboard/services');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Page header */}
      <button type="button" onClick={() => navigate('/dashboard/services')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-800">
        <ChevronLeft className="h-4 w-4" /> Back to services
      </button>
      <PageHeader
        title={isEdit ? 'Edit Service' : 'Add New Service'}
        subtitle={isEdit ? 'Update your service details' : 'Create a new service to offer to clients'}
      />

      {/* ── ABOVE THE FOLD: Basic info ── */}
      <Card padded={false} className="mb-6 p-6">
        <h2 className="mb-5 text-base font-bold text-gray-800">Basic Information</h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-5">
            {/* Title */}
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                <label className="block text-sm font-medium text-gray-700">Service Title <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs', titleLen > 55 ? 'text-red-500' : 'text-gray-400')}>{titleLen}/60</span>
                  <button type="button" onClick={() => runBolt(false)}
                    disabled={!BOLT_ENABLED || !form.title.trim() || aiLoading}
                    title={!BOLT_ENABLED ? 'AI writing — available soon' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent)] disabled:opacity-40',
                      !BOLT_ENABLED && 'grayscale opacity-60 cursor-not-allowed',
                    )}>
                    {!BOLT_ENABLED ? '✨ Write with Bolt · soon' : (aiLoading ? 'Bolt is writing…' : '✨ Write with Bolt')}
                  </button>
                </div>
              </div>
              <Input type="text" value={form.title} maxLength={60} required onChange={e => set('title', e.target.value)} placeholder="e.g. SEO Consultancy by Shubham Datarkar" />
              {aiError && <p className="mt-1 text-xs text-red-500">{aiError}</p>}
              {aiFields.size > 0 && !aiError && !aiLoading && (
                <p className="mt-1 text-xs text-green-600">
                  ✨ Bolt filled {aiFields.size} field{aiFields.size === 1 ? '' : 's'} — review and edit before saving.
                </p>
              )}
              {aiSession && !aiLoading && (
                <div className="mt-2 flex items-center gap-2">
                  <input value={aiTweak} onChange={e => setAiTweak(e.target.value)} placeholder="make it more… (optional)"
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs" />
                  <button type="button" onClick={() => runBolt(true)} disabled={aiLoading}
                    className="text-xs font-semibold text-[color:var(--accent)] disabled:opacity-40">
                    Regenerate
                  </button>
                </div>
              )}
            </div>

            {/* Short description */}
            <div>
              <div className="mb-1 flex justify-between">
                <label className="block text-sm font-medium text-gray-700">Short Description <span className="text-red-500">*</span></label>
                <span className={cn('text-xs', shortLen > 150 ? 'text-red-500' : 'text-gray-400')}>{shortLen}/160</span>
              </div>
              <Textarea rows={3} value={form.short_description} maxLength={160} required onChange={e => set('short_description', e.target.value)} placeholder="Used for service cards, search results and meta description" />
            </div>

            {/* Service Type + Category — compact side-by-side dropdowns.
                Service Type: offline option gated; off = online only.
                Category: scoped to the host's primary profession. */}
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
              <FeatureGate flag="service_offline_type">
                <div className="flex-1">
                  <label className={fieldLabel}>Service Type</label>
                  <Select value={form.service_type} onChange={e => set('service_type', e.target.value)}>
                    <option value="online">🌐 Online</option>
                    <option value="offline">📍 Offline</option>
                  </Select>
                  {form.service_type === 'online' && (
                    <p className="mt-1 text-[12px] text-gray-400">Meets over a video/phone link you share.</p>
                  )}
                </div>
              </FeatureGate>

              {svcCats.length > 0 && (
                <div className="flex-1">
                  <label className={fieldLabel}>Category <span className="text-red-500">*</span></label>
                  <Select value={form.category} onChange={e => set('category', e.target.value)}>
                    {svcCats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </Select>
                  {allowSuggest && (
                    <button type="button" onClick={() => setSuggestOpen(true)}
                      className="mt-1.5 text-[12px] font-medium text-[#960D32] hover:underline">
                      + Suggest new subcategory
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Offline venue — map link. Shown only when the service is in-person.
                Required: an offline listing can't be saved without a venue. Saved
                to the host's profile (shared by all their offline services). */}
            {form.service_type === 'offline' && (
              <div className="rounded-xl border-2 border-[#960D32]/20 bg-[#960D32]/[0.04] p-4">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[#960D32]" />
                  <label className="text-sm font-semibold text-gray-800">Venue map link <span className="text-red-500">*</span></label>
                </div>
                <p className="mb-2.5 text-[12px] leading-relaxed text-gray-500">
                  In-person bookings show guests where to go — this link appears in their
                  confirmation email, calendar invite and reminders. Paste a Google Maps
                  link to your venue. Saved to your profile and reused by all your offline services.
                </p>
                <Input
                  type="url"
                  inputMode="url"
                  value={mapLink}
                  onChange={e => setMapLink(e.target.value)}
                  placeholder="https://maps.app.goo.gl/…"
                />
                {!mapLink.trim() && (
                  <div className="mt-2 flex items-start gap-1.5 text-[12px] font-medium text-[#960D32]">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>
                      {hadMapLink
                        ? 'Your profile map link was cleared — add one to keep this service in-person.'
                        : 'You haven’t added a venue map link yet. It’s required to publish an in-person service.'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Price */}
            <div>
              <label className={fieldLabel}>Price</label>
              {feeOnly ? (
                <div className="rounded-xl border-2 border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                  Paid pricing is currently unavailable. Your service is listed as{' '}
                  <span className="font-semibold text-ink">Free</span> — guests pay only Meeticulous&rsquo;s
                  booking fee at checkout.
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-500">₹</span>
                  <Input type="number" min={0} step={1} required={!form.price_on_request} disabled={form.price_on_request} value={form.price} onChange={e => set('price', e.target.value)} placeholder="1999" className="pl-7" />
                </div>
              )}
              {!feeOnly && !form.price_on_request && (
                <PriceBenchmark category={form.category || undefined} onPick={(v) => set('price', String(v))} />
              )}

              {/* Price on request — hide the fee publicly; guests book a no-payment
                  enquiry and the host quotes offline. For professionals who can't
                  advertise fees (e.g. Chartered Accountants under ICAI rules). */}
              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  checked={form.price_on_request}
                  onChange={e => set('price_on_request', e.target.checked)}
                />
                <span className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Price on request</span> — hide the fee on your public
                  page. Guests book without paying and you discuss the price with them directly.
                </span>
              </label>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Duration */}
            <div>
              <label className={fieldLabel}>Duration <span className="text-red-500">*</span></label>
              <Select value={form.duration} onChange={e => set('duration', parseInt(e.target.value))}>
                {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </Select>
              {form.duration === 0 && (
                <Input type="number" min={1} max={480} value={form.custom_duration} onChange={e => set('custom_duration', e.target.value)} placeholder="Enter minutes e.g. 75" className="mt-2" />
              )}
            </div>

            {/* Grace Period */}
            <FeatureGate flag="service_grace_period">
              <div>
                <label className={fieldLabel}>Grace Period (buffer before/after)</label>
                <Select value={form.grace_period} onChange={e => set('grace_period', parseInt(e.target.value))}>
                  {GRACE_PERIODS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </Select>
              </div>
            </FeatureGate>

            {/* Thumbnail */}
            <FeatureGate flag="service_thumbnail">
              <ThumbnailCropper
                value={form.thumbnail_url}
                onChange={url => set('thumbnail_url', url)}
                folder="services"
                label={<label className={fieldLabel}>Thumbnail <span className="text-gray-400 text-xs font-normal">(optional — we'll use a Meeticulous card if you skip)</span></label>}
              />
            </FeatureGate>
          </div>
        </div>
      </Card>

      {/* ── BELOW THE FOLD: balanced two-column layout. Columns stretch to equal
          height; FAQ sits directly below Overview on the left. ── */}
      <div className="mb-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {/* Left: Overview, then FAQ directly below it */}
        <div className="flex flex-col gap-6">
          <FeatureGate flag="service_rich_overview">
            <Card padded={false} className="p-6">
              <h2 className="mb-1 text-base font-bold text-gray-800">Overview</h2>
              <p className="mb-4 text-xs text-gray-400">Shown on the Overview tab of your public service page</p>
              <RichEditor value={form.long_description} onChange={v => set('long_description', v)}/>
            </Card>
          </FeatureGate>

          {/* FAQ — directly below Overview */}
          <FeatureGate flag="service_faqs">
            <Card padded={false} className="p-6">
              <h2 className="mb-1 text-base font-bold text-gray-800">FAQs</h2>
              <p className="mb-4 text-xs text-gray-400">Optional · Add as many as you need</p>
              <FAQBuilder value={form.faqs} onChange={v => set('faqs', v)}/>
            </Card>
          </FeatureGate>
        </div>

        {/* Right: Inclusions, Exclusions, Notes */}
        <div className="flex flex-col gap-6">
          <FeatureGate flag="service_inclusions">
            <Card padded={false} className="p-6">
              <h2 className="mb-1 text-base font-bold text-gray-800">What's Included</h2>
              <p className="mb-3 text-xs text-gray-400">Press Enter or comma after each item</p>
              <TagInput value={form.included_items} onChange={v => set('included_items', v)} placeholder="Type and press Enter…" color="green"/>
            </Card>
          </FeatureGate>

          <FeatureGate flag="service_inclusions">
            <Card padded={false} className="p-6">
              <h2 className="mb-1 text-base font-bold text-gray-800">Not Included</h2>
              <p className="mb-3 text-xs text-gray-400">Press Enter or comma after each item</p>
              <TagInput value={form.excluded_items} onChange={v => set('excluded_items', v)} placeholder="Type and press Enter…" color="red"/>
            </Card>
          </FeatureGate>

          {/* Important Note */}
          <Card padded={false} className="flex-1 p-6">
            <h2 className="mb-1 text-base font-bold text-gray-800">Important Notes</h2>
            <p className="mb-3 text-xs text-gray-400">Optional · Shown to clients before booking</p>
            <Textarea rows={4} value={form.important_note} onChange={e => set('important_note', e.target.value)} placeholder="e.g. Please bring Search Console access. Calls are recorded." />
          </Card>
        </div>
      </div>

      {/* Submit bar */}
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-4 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="button" variant="secondary" onClick={() => navigate('/dashboard/services')}>Cancel</Button>
        <Button type="submit" disabled={saving} className="min-w-[140px]">
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Service'}
        </Button>
      </div>

      {suggestOpen && <SuggestSubcategoryModal primary={primaryCat} onClose={() => setSuggestOpen(false)} />}
    </form>
  );
}
