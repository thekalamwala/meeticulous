import { useState, useEffect, useCallback } from "react";
import { Ticket, Plus } from "lucide-react";
import toast from "react-hot-toast";
import {
  getHostCoupons, createHostCoupon, updateHostCoupon, deleteHostCoupon,
} from "../services/api";
import {
  PageHeader, Card, Button, FormField, Input, Select,
  Badge, EmptyState, ErrorState, ConfirmSheet, cn,
} from "../components/dashboard/ui";
import ComingSoonTeaser from "../components/dashboard/ComingSoonTeaser";

const emptyForm = {
  code: "", discount_type: "percent", discount_value: "",
  min_amount: "", max_redemptions: "", expires_at: "",
};

// A coupon's live state at a glance — matches couponService.validate's checks.
const couponState = (c) => {
  if (!c.active) return { label: "Inactive", tone: "neutral" };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { label: "Expired", tone: "danger" };
  if (c.max_redemptions != null && c.times_redeemed >= c.max_redemptions) return { label: "Used up", tone: "danger" };
  return { label: "Active", tone: "success" };
};

const describe = (c) =>
  c.discount_type === "percent" ? `${c.discount_value}% off` : `₹${c.discount_value} off`;

export default function HostCoupons() {
  const [coupons, setCoupons] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null); // 'disabled' | 'error'
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null); // coupon row
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await getHostCoupons();
      setCoupons(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch (err) {
      // 404 from the host CRUD = the `coupons` flag is off for this platform.
      setLoadError(err.response?.status === 404 ? "disabled" : "error");
      setCoupons([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      code: form.code.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      ...(form.min_amount !== "" ? { min_amount: Number(form.min_amount) } : {}),
      ...(form.max_redemptions !== "" ? { max_redemptions: Number(form.max_redemptions) } : {}),
      ...(form.expires_at ? { expires_at: new Date(form.expires_at).toISOString() } : {}),
    };
    setSaving(true);
    try {
      await createHostCoupon(payload);
      toast.success("Coupon created");
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not create the coupon");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    try {
      await updateHostCoupon(c.id, { active: !c.active });
      setCoupons((list) => list.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update the coupon");
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await deleteHostCoupon(confirmDel.id);
      setCoupons((list) => list.filter((x) => x.id !== confirmDel.id));
      setConfirmDel(null);
    } catch (err) {
      // A used coupon is FK-referenced by bookings → 409; tell the host to deactivate.
      toast.error(err.response?.data?.message || "Could not delete the coupon");
    } finally {
      setDeleting(false);
    }
  };

  if (loadError === "disabled") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <PageHeader title="Coupons" subtitle="Discount codes for your services." />
        <ComingSoonTeaser
          feature="coupons"
          title="Discount codes"
          blurb="Create coupon codes guests apply at checkout — run launches, win-backs and seasonal offers. Coming to Pro."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Coupons"
        subtitle="Create discount codes guests can apply at checkout. You absorb the discount — commission and taxes recompute on the lower price."
        actions={
          !showForm && coupons?.length > 0 ? (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> New coupon
            </Button>
          ) : null
        }
      />

      {loadError === "error" && (
        <ErrorState message="Couldn't load your coupons." onRetry={load} />
      )}

      {showForm && (
        <Card padded={false} className="mb-5 p-4">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Code" htmlFor="c-code" required hint="3–24 letters, numbers, - or _">
                <Input id="c-code" value={form.code} onChange={set("code")} placeholder="WELCOME10"
                  className="uppercase" maxLength={24} required />
              </FormField>
              <FormField label="Discount type" htmlFor="c-type" required>
                <Select id="c-type" value={form.discount_type} onChange={set("discount_type")}>
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat (₹)</option>
                </Select>
              </FormField>
              <FormField label={form.discount_type === "percent" ? "Percent off" : "Amount off (₹)"} htmlFor="c-val" required>
                <Input id="c-val" type="number" min="1" max={form.discount_type === "percent" ? "100" : undefined}
                  value={form.discount_value} onChange={set("discount_value")} required />
              </FormField>
              <FormField label="Minimum booking (₹)" htmlFor="c-min" hint="Optional">
                <Input id="c-min" type="number" min="0" value={form.min_amount} onChange={set("min_amount")} placeholder="0" />
              </FormField>
              <FormField label="Max redemptions" htmlFor="c-max" hint="Optional — blank = unlimited">
                <Input id="c-max" type="number" min="1" value={form.max_redemptions} onChange={set("max_redemptions")} placeholder="∞" />
              </FormField>
              <FormField label="Expires on" htmlFor="c-exp" hint="Optional">
                <Input id="c-exp" type="date" value={form.expires_at} onChange={set("expires_at")} />
              </FormField>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Creating…" : "Create coupon"}
              </Button>
              <Button type="button" variant="ghost" disabled={saving}
                onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {coupons === null ? (
        <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
      ) : coupons.length === 0 && !showForm && loadError !== "error" ? (
        <EmptyState
          icon={Ticket}
          title="No coupons yet"
          description="Create a discount code to run a promotion for your services."
          action={<Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New coupon</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {coupons.map((c) => {
            const st = couponState(c);
            return (
              <Card key={c.id} padded={false} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tracking-wide text-ink truncate">{c.code}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {describe(c)}
                    {c.min_amount > 0 && ` · min ₹${Math.round(c.min_amount)}`}
                    {c.max_redemptions != null && ` · ${c.times_redeemed || 0}/${c.max_redemptions} used`}
                    {c.max_redemptions == null && (c.times_redeemed > 0) && ` · ${c.times_redeemed} used`}
                    {c.expires_at && ` · expires ${new Date(c.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    c.active ? "bg-ink/5 text-ink/60 hover:bg-ink/10" : "bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                >
                  {c.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDel(c)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose/10 transition-colors"
                >
                  Delete
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmSheet
        open={!!confirmDel}
        title="Delete coupon?"
        message={confirmDel ? `“${confirmDel.code}” will be removed. A coupon already used on a booking can't be deleted — deactivate it instead.` : ""}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}
