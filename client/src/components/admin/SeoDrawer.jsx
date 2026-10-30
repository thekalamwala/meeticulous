import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { adminUpdateServiceSeo, adminUpdateProviderSeo, adminUploadImage } from '../../services/api';
import { SITE_URL } from '../../utils/seo';

/**
 * SeoDrawer — admin-only SEO + index control for a service or host profile.
 *
 * Vendors never see this. Title + URL slug stay vendor-controlled; everything
 * here is admin-managed. Canonical is shown read-only (derived from the live
 * URL — never edited). Index status uses a single action button, not a toggle.
 *
 * Props:
 *   kind:    'service' | 'provider'
 *   entity:  the row (service incl. profiles{username}, or host profile)
 *   onClose: () => void
 *   onSaved: (updatedRow) => void
 */
const SITE = import.meta.env?.VITE_PUBLIC_SITE_URL || SITE_URL;

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[12px] font-semibold text-gray-700">{label}</span>
    {hint && <span className="block text-[11px] text-gray-400 mb-1">{hint}</span>}
    {children}
  </label>
);

const SeoDrawer = ({ kind, entity, onClose, onSaved }) => {
  const isService = kind === 'service';
  const [form, setForm] = useState({
    seo_title: entity.seo_title || '',
    seo_description: entity.seo_description || '',
    og_title: entity.og_title || '',
    og_description: entity.og_description || '',
    seo_image: entity.seo_image || '',
  });
  const [indexable, setIndexable] = useState(entity.is_indexable !== false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyIndex, setBusyIndex] = useState(false);

  // Lock the page scroll while the drawer is mounted so only the panel scrolls.
  // Without this the body and the panel both show a scrollbar (double bars).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const username = isService ? entity.profiles?.username : entity.username;
  const canonical = isService
    ? `${SITE}/${username || '…'}/${entity.slug}`
    : `${SITE}/${username || '…'}`;
  const heading = isService ? entity.title : entity.name;

  const save = (patch) =>
    (isService ? adminUpdateServiceSeo(entity.id, patch) : adminUpdateProviderSeo(entity.id, patch));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await adminUploadImage(file, 'seo');
      setForm((f) => ({ ...f, seo_image: data.url }));
      toast.success('Image uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await save({ ...form });
      toast.success('SEO saved');
      onSaved?.(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Single action button — flips is_indexable and persists immediately.
  const toggleIndex = async () => {
    setBusyIndex(true);
    const next = !indexable;
    try {
      const { data } = await save({ is_indexable: next });
      setIndexable(next);
      toast.success(next ? 'Now indexable by Google' : 'Removed from Google');
      onSaved?.(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setBusyIndex(false);
    }
  };

  const input =
    'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#960D32] focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-gray-900">SEO · {heading}</h2>
            <p className="text-[11px] text-gray-400">Admin-managed. Hosts can't see these.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Index status */}
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Index Status</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${indexable ? 'bg-green-500' : 'bg-red-500'}`} />
                {indexable ? '🟢 Indexed' : '🔴 No Index'}
              </span>
              <button
                onClick={toggleIndex}
                disabled={busyIndex}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50 ${indexable ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {busyIndex ? 'Saving…' : indexable ? 'Remove From Google' : 'Allow Google Indexing'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-400">
              Controls the page <code>robots</code> tag and whether this URL appears in the sitemap.
            </p>
          </div>

          {/* Canonical (read-only, derived) */}
          <Field label="Canonical URL" hint="Auto-generated from the live URL — not editable.">
            <input readOnly value={canonical} className={`${input} bg-gray-50 text-gray-500`} />
          </Field>

          <Field label="Meta Title" hint="Falls back to the title if blank.">
            <input value={form.seo_title} onChange={set('seo_title')} className={input} placeholder={heading} />
          </Field>
          <Field label="Meta Description" hint="~160 characters. Falls back to the short description.">
            <textarea value={form.seo_description} onChange={set('seo_description')} rows={3} className={input} />
          </Field>
          <Field label="OG Title" hint="Social share title. Falls back to Meta Title.">
            <input value={form.og_title} onChange={set('og_title')} className={input} />
          </Field>
          <Field label="OG Description" hint="Social share description.">
            <textarea value={form.og_description} onChange={set('og_description')} rows={2} className={input} />
          </Field>

          {/* SEO image — uploads via /api/upload/image to Supabase Storage */}
          <Field label="SEO Image" hint="1200×630 recommended. Falls back to the thumbnail/photo.">
            <div className="mt-1 flex items-center gap-3">
              <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {form.seo_image
                  ? <img src={form.seo_image} alt="" className="h-full w-full object-cover" />
                  : <span className="text-[10px] text-gray-300">No image</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50">
                  {uploading ? 'Uploading…' : 'Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
                {form.seo_image && (
                  <button onClick={() => setForm((f) => ({ ...f, seo_image: '' }))} className="text-left text-[11px] text-red-500 hover:underline">Remove</button>
                )}
              </div>
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[#960D32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2A1416] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save SEO'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeoDrawer;
