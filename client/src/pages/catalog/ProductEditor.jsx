// Add / edit a digital product on its own route, like services:
//   /dashboard/product/add-new     /dashboard/product/edit/:id
// Replaces the side-drawer editor on the Products page (and the add-new hook that
// raced itself shut). Same fields, same API calls, same server validation.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getMyProducts, createProduct, updateProduct, deleteProduct, uploadProductFile,
} from '../../services/api';
import ThumbnailCropper from '../../components/common/ThumbnailCropper';
import { FormField, Input, Select, Textarea, ConfirmSheet, cn } from '../../components/dashboard/ui';
import { EditorPage, EditorSection, KeptError, KeptSkeleton } from './KeptKit';
import useProductGate from './useProductGate';

export const PRODUCT_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'template', label: 'Template' },
  { value: 'ebook', label: 'eBook' },
  { value: 'prompt_pack', label: 'Prompt Pack' },
  { value: 'resource', label: 'Resource' },
  { value: 'other', label: 'Other' },
];

const PRODUCT_FILE_EXTS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'epub', 'mp3', 'png', 'jpg'];
const MAX_PRODUCT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

const formatBytes = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Native file input keeps its testid + accept attrs; styled to match the kit.
const fileInputCls =
  'block w-full rounded-[16px] bg-cream text-sm text-ink ' +
  'file:mr-3 file:border-0 file:bg-blush file:px-3 file:py-2.5 file:text-sm file:font-semibold file:text-maroon ' +
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose disabled:opacity-60';

const emptyForm = {
  title: '', description: '', type: 'pdf', price: '', file_url: '', thumbnail_url: '',
  product_url: '', file_name: '', file_size_bytes: null,
};

const fromRow = (p) => ({
  title: p.title, description: p.description || '', type: p.type,
  price: p.price == null ? '' : String(p.price),
  file_url: p.file_url || '', thumbnail_url: p.thumbnail_url || '', product_url: p.product_url || '',
  file_name: p.file_name || '', file_size_bytes: p.file_size_bytes ?? null,
});

export default function ProductEditor() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { state } = useLocation();
  const backTo = state?.from || '/dashboard/products';
  const { canCreate, plansLoaded } = useProductGate();

  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(isEdit ? 'loading' : 'ready'); // loading | ready | missing | error
  const [saving, setSaving] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [thumbMode, setThumbMode] = useState('url'); // url | upload
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = () => {
    setStatus('loading');
    getMyProducts()
      .then(({ data }) => {
        const hit = (data || []).find((p) => String(p.id) === String(id));
        if (hit) { setForm(fromRow(hit)); setStatus('ready'); } else setStatus('missing');
      })
      .catch(() => setStatus('error'));
  };
  useEffect(() => { if (isEdit) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A plan without products sees the upsell on the list, not an empty form.
  if (!isEdit && plansLoaded && !canCreate) return <Navigate to="/dashboard/products" replace />;

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  const handleFilePick = async (file) => {
    if (!file) return;
    setFileError('');
    const ext = file.name.toLowerCase().split('.').pop();
    if (!PRODUCT_FILE_EXTS.includes(ext)) {
      setFileError('File type not supported. Allowed: PDF, DOC(X), PPT(X), XLS(X), ZIP, EPUB, MP3, PNG, JPG.');
      return;
    }
    if (file.size > MAX_PRODUCT_FILE_BYTES) { setFileError('File must be under 2 MB.'); return; }
    setFileUploading(true);
    try {
      const { data } = await uploadProductFile(file);
      setForm((f) => ({ ...f, file_url: data.url, file_name: data.name, file_size_bytes: data.size }));
      toast.success('File uploaded');
    } catch (err) {
      setFileError(err.response?.data?.message || 'Upload failed');
    } finally {
      setFileUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // price is held as a string so the field can go empty; blank means free → 0.
      const payload = { ...form, price: form.price === '' || form.price == null ? 0 : Number(form.price) };
      if (isEdit) { await updateProduct(id, payload); toast.success('Product updated!'); }
      else { await createProduct(payload); toast.success('Product created!'); }
      navigate(backTo);
    } catch (err) {
      const data = err.response?.data;
      // Surface the specific field error(s) from the 422 validator instead of the
      // generic "Validation failed" — e.g. "Invalid product URL" tells the host to
      // add https://, rather than leaving them stuck with no clue which field failed.
      const fieldMsg = Array.isArray(data?.errors) && data.errors.length
        ? data.errors.map((x) => x.message).join(' · ')
        : null;
      toast.error(fieldMsg || data?.message || 'Failed to save', data?.upgrade_required ? { duration: 5000 } : undefined);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try { await deleteProduct(id); toast.success('Product deleted'); navigate('/dashboard/products'); }
    catch { toast.error('Failed to delete'); }
  };

  const page = (body) => (
    <EditorPage back={backTo} backLabel={backTo === '/dashboard/catalog' ? 'Catalog' : 'Products'}
      title={isEdit ? (form.title.trim() || 'Edit product') : 'New product'}
      sub={isEdit ? 'Changes show on your page as soon as you save.' : 'Guests can buy it as soon as you save.'}
      formId="product-form" saving={saving || fileUploading} saveLabel={isEdit ? 'Save changes' : 'Create product'}
      onCancel={() => navigate(backTo)} onDelete={isEdit && status === 'ready' ? () => setConfirmDelete(true) : undefined}>
      {body}
    </EditorPage>
  );

  if (status === 'loading') return page(<KeptSkeleton rows={4} />);
  if (status === 'error') return page(<KeptError what="product" onRetry={load} />);
  if (status === 'missing') return page(<KeptError what="product (it may have been deleted)" onRetry={() => navigate('/dashboard/products')} />);

  return page(<>
    <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
      <EditorSection title="Details">
        <FormField label="Title" htmlFor="prod-title" className="mb-0">
          <Input id="prod-title" type="text" required placeholder="e.g. UI Component Kit" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="prod-desc" className="mb-0">
          <Textarea id="prod-desc" rows={4} placeholder="What's included?" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Type" htmlFor="prod-type" className="mb-0">
            <Select id="prod-type" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Price (₹) — 0 for free" htmlFor="prod-price" className="mb-0">
            <Input id="prod-price" type="number" inputMode="decimal" min={0} placeholder="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </FormField>
        </div>
      </EditorSection>

      <EditorSection title="The file" sub="Upload it here for secure, expiring download links, or paste a link.">
        <FormField
          label={<>Upload file <span className="font-normal text-faint">(PDF, DOC, PPT, XLS, ZIP, EPUB, MP3, PNG, JPG — max 2 MB)</span></>}
          className="mb-0"
        >
          <input type="file" data-testid="product-file-input"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.epub,.mp3,.png,.jpg"
            className={fileInputCls} disabled={fileUploading} onChange={(e) => handleFilePick(e.target.files?.[0])} />
          {fileUploading && <p className="mt-1 animate-pulse text-[13px] text-maroon">Uploading…</p>}
          {fileError && <p className="mt-1 text-[13px] text-rose-700">{fileError}</p>}
          {!fileUploading && form.file_name && (
            <p className="mt-1 text-[13px] text-muted">
              {form.file_name}{form.file_size_bytes ? ` · ${formatBytes(form.file_size_bytes)}` : ''}
            </p>
          )}
        </FormField>
        <FormField
          label={<>File URL <span className="font-normal text-faint">(Google Drive, Notion, Gumroad, Dropbox, etc.)</span></>}
          htmlFor="prod-file-url" hint="Paste any shareable link — or upload a file above." className="mb-0"
        >
          <Input id="prod-file-url" type="url" placeholder="https://drive.google.com/..." value={form.file_url} onChange={(e) => set('file_url', e.target.value)} />
        </FormField>
        <p className="mb-0 rounded-[16px] bg-cream p-3 text-[13px] leading-relaxed text-muted">
          <strong className="text-ink">Heads up:</strong> an external file URL is public — anyone with the link can open it, and it never expires. The secure 24-hour, single-link, max-3-downloads protection only applies to files you upload here. For paid products, prefer uploading.
        </p>
        <FormField
          label={<>Product URL <span className="font-normal text-faint">(optional)</span></>}
          htmlFor="prod-url" hint="A landing page or external store link for this product." className="mb-0"
        >
          <Input id="prod-url" type="url" placeholder="https://your-store.com/product" value={form.product_url} onChange={(e) => set('product_url', e.target.value)} />
        </FormField>
      </EditorSection>

      <EditorSection title="Cover image" sub="16:9. Optional — the card shows the product type without one.">
        <div className="flex gap-2">
          {[['url', 'Paste URL'], ['upload', 'Upload']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setThumbMode(k)} aria-pressed={thumbMode === k}
              className={cn('h-10 rounded-[10px] px-3.5 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
                thumbMode === k ? 'bg-maroon text-white' : 'bg-cream text-muted hover:bg-blush hover:text-maroon')}>
              {l}
            </button>
          ))}
        </div>
        {thumbMode === 'url' ? (
          <>
            <Input type="url" aria-label="Cover image URL" placeholder="Paste an image URL — https://..." value={form.thumbnail_url} onChange={(e) => set('thumbnail_url', e.target.value)} />
            {form.thumbnail_url && (
              <img src={form.thumbnail_url} alt="Cover preview" className="aspect-[16/9] w-full max-w-md rounded-[20px] object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            )}
          </>
        ) : (
          <ThumbnailCropper value={form.thumbnail_url} onChange={(url) => set('thumbnail_url', url)} folder="products" />
        )}
      </EditorSection>
    </form>
    <ConfirmSheet open={confirmDelete} title="Delete product?"
      message={`"${form.title}" will be permanently deleted. This cannot be undone.`}
      confirmLabel="Delete" danger onConfirm={doDelete} onClose={() => setConfirmDelete(false)} />
  </>);
}
