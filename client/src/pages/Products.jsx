import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getMyProducts, updateProduct, deleteProduct } from "../services/api";
import { planLabel } from "../utils/themeUtils";
import BackButton from "../components/common/BackButton";
import ProTeaser from "../components/dashboard/ProTeaser";
import { Plus, Package } from "lucide-react";
import useFeatureFlags from "../hooks/useFeatureFlags";
import useProductGate from "./catalog/useProductGate";
import { PRODUCT_TYPES } from "./catalog/ProductEditor";
import {
  KeptPage, KeptHeader, KeptList, KeptRow, RowThumb, RowSwitch, KeptEmpty,
  KeptError, KeptSkeleton, PinnedAction, pinnedBtn, primaryBtn,
} from "./catalog/KeptKit";
import toast from "react-hot-toast";
import {
  PageHeader, Card, Button, Badge, StatusBadge, EmptyState, ErrorState, ConfirmSheet, Fab,
} from "../components/dashboard/ui";

// Create and edit live on their own routes (catalog/ProductEditor):
//   /dashboard/product/add-new   /dashboard/product/edit/:id
const ADD = "/dashboard/product/add-new";
const editOf = (p) => `/dashboard/product/edit/${p.id}`;

// Blurred teaser shown behind the upgrade overlay for plans without products.
const SAMPLE_PRODUCTS = [
  { title: "Brand Guidelines Kit", type: "PDF · 24 pages", price: "₹499" },
  { title: "Notion Template Pack", type: "Template", price: "₹299" },
  { title: "Lightroom Presets", type: "Preset Pack", price: "₹799" },
  { title: "Resume Starter", type: "PDF", price: "₹199" },
];

const Products = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState(false); // first-load fetch failure
  const [confirmDelete, setConfirmDelete] = useState(null); // product pending delete
  const [fetched, setFetched] = useState(false); // first load finished (Kept skeleton)
  // Kept look (dashboard_v2). Same data and handlers; only the shell differs.
  const { flags } = useFeatureFlags();
  const kept = !!flags?.dashboard_v2;
  const { canCreate, digitalProductsOn, upgradePlan } = useProductGate();

  const fetchProducts = async () => {
    setLoadError(false);
    try {
      const { data } = await getMyProducts();
      setProducts(data || []);
    } catch {
      setLoadError(true);
      toast.error("Failed to load products");
    } finally {
      setFetched(true);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const openCreate = () => navigate(ADD);
  const openEdit = (p) => navigate(editOf(p));

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

  // Plan-gated: free/limited plans see the page blurred behind an upgrade card.
  // (Kill-switch OFF is a separate, neutral message — an upgrade can't unlock it.)
  // Plan-gated body, shared by both looks.
  const lockedBody = (
      <>
        {!digitalProductsOn ? (
          <Card className="border-2 border-dashed border-primary/30 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blush text-maroon">
              <Package className="h-6 w-6" strokeWidth={2} />
            </div>
            <h3 className="mb-1 font-semibold text-ink">Digital Products are temporarily unavailable</h3>
            <p className="text-sm text-muted">This feature is switched off right now. It’ll be back soon — no plan change needed.</p>
          </Card>
        ) : (
          // Shared ProTeaser: blurred sample grid + attributed upgrade CTA.
          <ProTeaser
            title="Unlock Digital Products"
            sub="Sell PDFs, templates, ebooks and resources right from your profile — unlock it to list and sell your first product."
            ctaLabel={upgradePlan ? `Upgrade to ${planLabel(upgradePlan.slug, upgradePlan.name)}` : "Upgrade to unlock"}
            src="products"
          >
            <ul className="grid gap-4 p-4 sm:grid-cols-2">
              {SAMPLE_PRODUCTS.map((s) => (
                <li key={s.title} className="overflow-hidden rounded-xl border border-black/10 bg-white">
                  <div className="aspect-[16/9] bg-blush" />
                  <div className="p-4">
                    <h3 className="font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted">{s.type}</p>
                    <p className="mt-2 font-bold text-maroon">{s.price}</p>
                  </div>
                </li>
              ))}
            </ul>
          </ProTeaser>
        )}
      </>
  );
  if (!canCreate) {
    if (kept) {
      return (
        <KeptPage pinned={false}>
          <KeptHeader title="Products" sub="Files guests download: PDFs, templates, ebooks." />
          {lockedBody}
        </KeptPage>
      );
    }
    return (
      <div className="mx-auto max-w-4xl">
        <BackButton hasUnsavedChanges={false} />
        <PageHeader title="Digital Products" subtitle="Sell PDFs, templates, ebooks, and more." />
        {lockedBody}
      </div>
    );
  }

  if (kept) {
    const priceOf = (p) => (Number(p.price) ? `₹${Number(p.price).toLocaleString("en-IN")}` : "Free");
    // Guest total comes from the server (guest_total, pricingEngine). Never computed here.
    const guestOf = (p) => (Number(p.guest_total) > Number(p.price) ? `Guests pay ₹${Number(p.guest_total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : null);
    const typeLabel = (t) => PRODUCT_TYPES.find((x) => x.value === t)?.label || "Download";
    const live = products.filter((p) => p.is_active).length;
    return (
      <KeptPage>
        <KeptHeader title="Products"
          sub={!fetched ? "Loading your products…" : products.length ? `${products.length} ${products.length === 1 ? "product" : "products"} · ${live} on your page` : "Files guests download: PDFs, templates, ebooks."}
          action={<button type="button" onClick={openCreate} className={primaryBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add product</button>} />

        {!fetched ? <KeptSkeleton /> : loadError && products.length === 0 ? (
          <KeptError what="products" onRetry={fetchProducts} />
        ) : products.length === 0 ? (
          <KeptEmpty icon={Package} title="No products yet"
            sub="A product is a file a guest buys and downloads. It sells while you sleep and takes no slot on your calendar."
            action={<button type="button" onClick={openCreate} className={primaryBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a product</button>} />
        ) : (
          <KeptList label="Your products">
            {products.map((p) => (
              <KeptRow key={p.id} onOpen={() => openEdit(p)}
                thumb={<RowThumb image={p.thumbnail_url} icon={Package} />}
                title={p.title}
                detail={[typeLabel(p.type), p.purchase_count ? `${Number(p.purchase_count).toLocaleString("en-IN")} sold` : null].filter(Boolean).join(" · ")}
                price={priceOf(p)} note={guestOf(p)}
                trailing={<RowSwitch checked={!!p.is_active} onChange={() => handleToggle(p)} word={p.is_active ? "On your page" : "Hidden"}
                  label={`${p.is_active ? "Hide" : "Show"} ${p.title} on your page`} />} />
            ))}
          </KeptList>
        )}

        <PinnedAction show={fetched && !(loadError && products.length === 0)}>
          <button type="button" onClick={openCreate} className={pinnedBtn}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a product</button>
        </PinnedAction>
      </KeptPage>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <BackButton hasUnsavedChanges={false} />

      <PageHeader
        title="Digital Products"
        subtitle="Sell PDFs, templates, ebooks, and more."
        actions={
          <Button className="hidden sm:inline-flex" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />

      {loadError && products.length === 0 ? (
        <ErrorState message="Couldn’t load your products." onRetry={fetchProducts} />
      ) : products.length === 0 ? (
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
                        <h3 className="truncate font-medium text-ink">{p.title}</h3>
                        <Badge tone="neutral">{p.type.replace("_", " ")}</Badge>
                        <StatusBadge status={p.is_active ? "active" : "inactive"} label={p.is_active ? "Active" : "Inactive"} />
                      </div>
                      {p.description && <p className="mt-0.5 line-clamp-1 text-sm text-ink/40">{p.description}</p>}
                      <p className="mt-1 text-xs text-ink/40">{p.purchase_count} purchase{p.purchase_count !== 1 ? "s" : ""}</p>
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
      {/* Mobile: floating create button. Label kept distinct from the header
          "Add Product" button so there's a single unambiguous named control. */}
      {canCreate && <Fab onClick={openCreate} icon={Plus} label="New product" iconOnly className="sm:hidden" />}
    </div>
  );
};

export default Products;
