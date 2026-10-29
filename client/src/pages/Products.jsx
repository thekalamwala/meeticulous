import { useState, useEffect } from "react";
import {
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductFile,
  uploadImage,
  getPublicPlans,
} from "../services/api";
import { planLabel, normalizePlan } from "../utils/themeUtils";
import { useAuth } from "../context/AuthContext";
import { useFeature } from "../context/FeatureContext";
import BackButton from "../components/common/BackButton";
import ThumbnailCropper from "../components/common/ThumbnailCropper";
import { Link } from "react-router-dom";
import { Plus, Package } from "lucide-react";
import toast from "react-hot-toast";
import {
  PageHeader, Card, Button, buttonClasses, FormField, Input, Select, Textarea,
  Badge, StatusBadge, EmptyState, ErrorState, ConfirmSheet, Fab, cn,
} from "../components/dashboard/ui";

const PRODUCT_TYPES = [
  { value: "pdf", label: "PDF" },
  { value: "template", label: "Template" },
  { value: "ebook", label: "eBook" },
  { value: "prompt_pack", label: "Prompt Pack" },
  { value: "resource", label: "Resource" },
  { value: "other", label: "Other" },
];

const PRODUCT_FILE_EXTS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
  "zip", "epub", "mp3", "png", "jpg",
];
const MAX_PRODUCT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

const formatBytes = (n) => {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Native file inputs keep their testids + accept attrs; styled to match the kit.
const fileInputCls =
  "block w-full rounded border border-gray-300 bg-white text-sm text-gray-700 shadow-sm " +
  "file:mr-3 file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-600 " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60";

const emptyForm = {
  title: "",
  description: "",
  type: "pdf",
  price: "",
  file_url: "",
  thumbnail_url: "",
  product_url: "",
  file_name: "",
  file_size_bytes: null,
};

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState(false); // first-load fetch failure
  const [plans, setPlans] = useState(null); // DB subscription_plans; null = loading
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [thumbMode, setThumbMode] = useState("url"); // "url" | "upload"
  const [confirmDelete, setConfirmDelete] = useState(null); // product pending delete
  const [confirmDiscard, setConfirmDiscard] = useState(false); // unsaved-changes guard

  // Admin kill-switch gate (fail-open: on unless an admin disabled it).
  const digitalProductsOn = useFeature("digital_products");

  // Database-driven plan gate. A plan can sell digital products when its DB
  // `digital_products` allowance is non-zero (-1 = unlimited). We gate on the
  // real allowance, never on the slug — a higher tier must never be prompted to
  // "upgrade" to a lower one. Alias resolution comes from themeUtils rather than
  // a local map — the canonical free slug has already changed once
  // (starter → free) and a private copy silently stopped matching any plan row,
  // which made the gate fall through to "can create".
  const planSlug = normalizePlan(user?.plan);

  const sortedPlans = [...(plans || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
  );
  const myPlan = sortedPlans.find((p) => p.slug === planSlug);
  const myProductLimit = Number(myPlan?.limits?.digital_products ?? 0);
  // Fail open while plans load (null) or when the plan is unrecognised — mirrors
  // FeatureContext, so we never wrongly block someone we can't classify.
  const planIncludesProducts =
    plans === null || !myPlan ? true : myProductLimit !== 0;
  const canCreate = planIncludesProducts && digitalProductsOn;

  // Cheapest strictly-higher tier that actually includes products — names the
  // upgrade CTA. No hardcoded plan name or price (both drift over time).
  const upgradePlan = sortedPlans.find(
    (p) =>
      Number(p.limits?.digital_products ?? 0) !== 0 &&
      (p.sort_order || 0) > (myPlan?.sort_order || 0),
  );

  const fetchProducts = async () => {
    setLoadError(false);
    try {
      const { data } = await getMyProducts();
      setProducts(data || []);
    } catch {
      setLoadError(true);
      toast.error("Failed to load products");
    }
  };

  useEffect(() => {
    fetchProducts();
    getPublicPlans()
      .then(({ data }) => setPlans(data || []))
      .catch(() => setPlans([]));
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setDirty(false);
  };
  const openEdit = (p) => {
    setForm({
      title: p.title,
      description: p.description || "",
      type: p.type,
      price: p.price == null ? "" : String(p.price),
      file_url: p.file_url || "",
      thumbnail_url: p.thumbnail_url || "",
      product_url: p.product_url || "",
      file_name: p.file_name || "",
      file_size_bytes: p.file_size_bytes ?? null,
    });
    setEditingId(p.id);
    setShowForm(true);
    setDirty(false);
    setFileError("");
    setThumbMode("url");
  };
  const doDiscard = () => {
    setShowForm(false);
    setEditingId(null);
    setDirty(false);
    setConfirmDiscard(false);
  };
  const handleCancel = () => {
    if (dirty) { setConfirmDiscard(true); return; }
    doDiscard();
  };
  const handleChange = (f, v) => {
    setForm({ ...form, [f]: v });
    setDirty(true);
  };

  const handleFilePick = async (file) => {
    if (!file) return;
    setFileError("");
    const ext = file.name.toLowerCase().split(".").pop();
    if (!PRODUCT_FILE_EXTS.includes(ext)) {
      setFileError(
        "File type not supported. Allowed: PDF, DOC(X), PPT(X), XLS(X), ZIP, EPUB, MP3, PNG, JPG.",
      );
      return;
    }
    if (file.size > MAX_PRODUCT_FILE_BYTES) {
      setFileError("File must be under 2 MB.");
      return;
    }
    setFileUploading(true);
    try {
      const { data } = await uploadProductFile(file);
      setForm((f) => ({
        ...f,
        file_url: data.url,
        file_name: data.name,
        file_size_bytes: data.size,
      }));
      setDirty(true);
      toast.success("File uploaded");
    } catch (err) {
      setFileError(err.response?.data?.message || "Upload failed");
    } finally {
      setFileUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // price is held as a string so the field can go empty (no fixed leading 0);
      // blank means free → 0.
      const payload = { ...form, price: form.price === "" || form.price == null ? 0 : Number(form.price) };
      if (editingId) {
        await updateProduct(editingId, payload);
        toast.success("Product updated!");
      } else {
        await createProduct(payload);
        toast.success("Product created!");
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      setDirty(false);
      fetchProducts();
    } catch (err) {
      const data = err.response?.data;
      // Surface the specific field error(s) from the 422 validator instead of the
      // generic "Validation failed" — e.g. "Invalid product URL" tells the host to
      // add https://, rather than leaving them stuck with no clue which field failed.
      const fieldMsg = Array.isArray(data?.errors) && data.errors.length
        ? data.errors.map((e) => e.message).join(" · ")
        : null;
      const msg = fieldMsg || data?.message || "Failed to save";
      toast.error(msg, data?.upgrade_required ? { duration: 5000 } : undefined);
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteProduct(confirmDelete.id);
      toast.success("Product deleted");
      setConfirmDelete(null);
      fetchProducts();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleToggle = async (p) => {
    try {
      await updateProduct(p.id, { is_active: !p.is_active });
      fetchProducts();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton hasUnsavedChanges={dirty} />

      <PageHeader
        title="Digital Products"
        subtitle="Sell PDFs, templates, ebooks, and more."
        actions={
          !showForm && canCreate ? (
            <Button className="hidden sm:inline-flex" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          ) : null
        }
      />

      {/* Gate — two distinct reasons, two distinct messages:
          • kill switch OFF → products are globally unavailable; an upgrade can't
            unlock them, so show a neutral notice with NO upgrade CTA.
          • plan has no product allowance → show the upgrade CTA, naming the
            cheapest higher tier (price lives on the Upgrade page, never here). */}
      {!canCreate && (
        <Card className="mb-6 border-2 border-dashed border-primary/30 text-center">
          <div className="mb-3 text-3xl">📦</div>
          {!digitalProductsOn ? (
            <>
              <h3 className="mb-1 font-semibold text-gray-900">Digital Products are temporarily unavailable</h3>
              <p className="text-sm text-gray-500">
                This feature is switched off right now. It’ll be back soon — no plan change needed.
              </p>
            </>
          ) : (
            <>
              <h3 className="mb-1 font-semibold text-gray-900">Unlock Digital Products</h3>
              <p className="mb-4 text-sm text-gray-500">
                Sell PDFs, templates, ebooks, and resources directly from your profile.
              </p>
              <Link to="/dashboard/upgrade" className={buttonClasses({ variant: "primary" })}>
                {upgradePlan ? `Upgrade to ${planLabel(upgradePlan.slug, upgradePlan.name)}` : "Upgrade your plan"}
              </Link>
            </>
          )}
        </Card>
      )}

      {showForm && (
        <Card as="form" onSubmit={handleSubmit} className="mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">{editingId ? "Edit Product" : "New Product"}</h2>

          <FormField label="Title" htmlFor="prod-title" className="mb-0">
            <Input id="prod-title" type="text" required placeholder="e.g. UI Component Kit" value={form.title} onChange={(e) => handleChange("title", e.target.value)} />
          </FormField>

          <FormField label="Description" htmlFor="prod-desc" className="mb-0">
            <Textarea id="prod-desc" rows={3} placeholder="What's included?" value={form.description} onChange={(e) => handleChange("description", e.target.value)} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Type" htmlFor="prod-type" className="mb-0">
              <Select id="prod-type" value={form.type} onChange={(e) => handleChange("type", e.target.value)}>
                {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Price (₹) — 0 for free" htmlFor="prod-price" className="mb-0">
              <Input id="prod-price" type="number" min={0} placeholder="0" value={form.price} onChange={(e) => handleChange("price", e.target.value)} />
            </FormField>
          </div>

          <FormField
            label={<>Product URL <span className="font-normal text-gray-400">(optional)</span></>}
            htmlFor="prod-url"
            hint="A landing page or external store link for this product."
            className="mb-0"
          >
            <Input id="prod-url" type="url" placeholder="https://your-store.com/product" value={form.product_url} onChange={(e) => handleChange("product_url", e.target.value)} />
          </FormField>

          <FormField
            label={<>File URL <span className="font-normal text-gray-400">(Google Drive, Notion, Gumroad, Dropbox, etc.)</span></>}
            htmlFor="prod-file-url"
            hint="Paste any shareable link — or upload a file below."
            className="mb-0"
          >
            <Input id="prod-file-url" type="url" placeholder="https://drive.google.com/..." value={form.file_url} onChange={(e) => handleChange("file_url", e.target.value)} />
          </FormField>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            <strong>Heads up:</strong> an external <em>File URL</em> is public — anyone with the link can open it, and it never expires. The secure 24-hour, single-link, max-3-downloads protection only applies to files you <strong>upload below</strong> (max 2&nbsp;MB). For paid products, prefer uploading the file here.
          </div>

          <FormField
            label={<>Upload File <span className="font-normal text-gray-400">(PDF, DOC, PPT, XLS, ZIP, EPUB, MP3, PNG, JPG — max 2 MB)</span></>}
            className="mb-0"
          >
            <input
              type="file"
              data-testid="product-file-input"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.epub,.mp3,.png,.jpg"
              className={fileInputCls}
              disabled={fileUploading}
              onChange={(e) => handleFilePick(e.target.files?.[0])}
            />
            {fileUploading && <p className="mt-1 animate-pulse text-xs text-primary">Uploading…</p>}
            {fileError && <p className="mt-1 text-xs text-red-500">{fileError}</p>}
            {!fileUploading && form.file_name && (
              <p className="mt-1 text-xs text-gray-500">
                {form.file_name}{form.file_size_bytes ? ` · ${formatBytes(form.file_size_bytes)}` : ""}
              </p>
            )}
          </FormField>

          <FormField label={<>Cover image — 16:9 <span className="font-normal text-gray-400">(optional)</span></>} className="mb-0">
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => setThumbMode("url")} className={cn("rounded px-3 py-1 text-xs", thumbMode === "url" ? "bg-primary text-white" : "bg-gray-100 text-gray-500")}>Paste URL</button>
              <button type="button" onClick={() => setThumbMode("upload")} className={cn("rounded px-3 py-1 text-xs", thumbMode === "upload" ? "bg-primary text-white" : "bg-gray-100 text-gray-500")}>Upload</button>
            </div>
            {thumbMode === "url" ? (
              <>
                <Input type="url" placeholder="Paste an image URL — https://..." value={form.thumbnail_url} onChange={(e) => handleChange("thumbnail_url", e.target.value)} />
                {form.thumbnail_url && (
                  <img src={form.thumbnail_url} alt="Thumbnail preview" className="mt-2 aspect-[16/9] w-full rounded-lg object-cover" onError={(e) => (e.target.style.display = "none")} />
                )}
              </>
            ) : (
              <ThumbnailCropper
                value={form.thumbnail_url}
                onChange={(url) => { handleChange("thumbnail_url", url); }}
                folder="products"
              />
            )}
          </FormField>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingId ? "Save Changes" : "Create Product"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
          </div>
        </Card>
      )}

      {loadError && products.length === 0 && !showForm ? (
        <ErrorState message="Couldn’t load your products." onRetry={fetchProducts} />
      ) : products.length === 0 && !showForm ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description={canCreate ? 'Click "Add Product" to list your first digital product.' : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <Card as="li" key={p.id} padded={false} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:gap-4">
                {p.thumbnail_url && (
                  <img src={p.thumbnail_url} alt={p.title} className="h-40 w-full object-cover sm:h-auto sm:w-28 sm:flex-shrink-0 sm:self-stretch" />
                )}
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-medium text-gray-900">{p.title}</h3>
                        <Badge tone="neutral">{p.type.replace("_", " ")}</Badge>
                        <StatusBadge status={p.is_active ? "active" : "inactive"} label={p.is_active ? "Active" : "Inactive"} />
                      </div>
                      {p.description && <p className="mt-0.5 line-clamp-1 text-sm text-gray-400">{p.description}</p>}
                      <p className="mt-1 text-xs text-gray-400">{p.purchase_count} purchase{p.purchase_count !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="flex-shrink-0 font-semibold text-primary">{p.price === 0 ? "Free" : `₹${p.price}`}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 sm:flex sm:justify-start">
                    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => openEdit(p)}>Edit</Button>
                    <Button size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => handleToggle(p)}>{p.is_active ? "Deactivate" : "Activate"}</Button>
                    <Button size="sm" variant="danger-outline" className="min-h-11 sm:min-h-0" onClick={() => setConfirmDelete(p)}>Delete</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {/* Native confirmations (replace window.confirm) */}
      <ConfirmSheet
        open={!!confirmDelete}
        title="Delete product?"
        message={confirmDelete ? `"${confirmDelete.title}" will be permanently deleted. This cannot be undone.` : ""}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
      <ConfirmSheet
        open={confirmDiscard}
        title="Discard changes?"
        message="Your unsaved changes will be lost."
        confirmLabel="Discard"
        danger
        onConfirm={doDiscard}
        onClose={() => setConfirmDiscard(false)}
      />

      {/* Mobile: floating create button. Label kept distinct from the header
          "Add Product" button so there's a single unambiguous named control. */}
      {canCreate && !showForm && <Fab onClick={openCreate} icon={Plus} label="New product" iconOnly className="sm:hidden" />}
    </div>
  );
};

export default Products;
