import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getPublicPlans, createSubscription, syncSubscription, cancelSubscription } from "../services/api";
import toast from "react-hot-toast";
import BackButton from "../components/common/BackButton";
import { PageHeader, Card, Button, cn, Modal, Sheet, ConfirmSheet, Input, Select, FormField } from "../components/dashboard/ui";
import { planLabel, normalizePlan } from "../utils/themeUtils";
import loadRazorpay from "../utils/loadRazorpay";
import { INDIAN_STATES } from "../lib/indianStates";

const GST_RATE = 0.18; // display only — server is authoritative
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;



// Build a concise, accurate feature list straight from the DB plan record.
const featureLines = (plan) => {
  const L = plan.limits || {};
  const lim = (v, label) => (v === -1 ? `Unlimited ${label}` : `${v ?? 0} ${label}`);
  const lines = [
    lim(L.services, "services"),
    L.bookings_per_year === -1 ? "Unlimited bookings" : `${(L.bookings_per_year ?? 0).toLocaleString("en-IN")} bookings / year`,
    lim(L.digital_products, "digital products"),
    Number(plan.commission_percentage) > 0 ? `${Number(plan.commission_percentage)}% commission` : "0% commission",
  ];
  const cals = plan.integrations?.calendar_apps || [];
  if (cals.length) lines.push(`Calendars: ${cals.map((c) => c.replace(/_/g, " ")).join(", ")}`);
  if (plan.features?.advanced_reports) lines.push("Advanced analytics");
  if (plan.support_type) lines.push(`${plan.support_type.replace(/_/g, " ")} support`);
  return lines;
};

const Check = () => (
  <svg className="h-4 w-4 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const UpgradePlan = () => {
  const { user, updateUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cadence, setCadence] = useState("annual"); // 'monthly' | 'annual'
  const [paying, setPaying] = useState(null);        // plan slug
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showDetails, setShowDetails] = useState(false); // subscription details drawer
  const [pendingPlan, setPendingPlan] = useState(null); // plan awaiting billing details
  const [billing, setBilling] = useState({
    name: user?.billing_details?.name || user?.name || "",
    address: user?.billing_details?.address || "",
    state: user?.billing_details?.state || "",
    state_code: user?.billing_details?.state_code || "",
    gstin: user?.billing_details?.gstin || "",
    pan: user?.billing_details?.pan || "",
  });

  // Alias resolution lives in themeUtils — see the note in Products.jsx.
  const currentPlan = normalizePlan(user?.plan);
  // Current tier rank, used to tell upgrades from downgrades. Falls back to 0
  // when the current plan isn't in the public list (e.g. an archived/admin tier)
  // — every paid plan then reads as a higher tier, never a bogus "downgrade".
  const myOrder = plans.find((p) => p.slug === currentPlan)?.sort_order ?? 0;

  useEffect(() => {
    getPublicPlans()
      .then((r) => setPlans(r.data || []))
      .catch(() => toast.error("Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  const priceFor = (plan, c) => (c === "monthly" ? Number(plan.monthly_price) || 0 : Number(plan.annual_price) || 0);
  const isPaid = (plan) => priceFor(plan, "monthly") > 0 || priceFor(plan, "annual") > 0;

  const handleUpgrade = useCallback(async (plan) => {
    const price = priceFor(plan, cadence);
    if (!(price > 0)) {
      toast.error(`No ${cadence} price for this plan.`);
      return;
    }
    const loaded = await loadRazorpay();
    if (!loaded) return toast.error("Payment gateway failed to load");

    setPaying(plan.slug);
    try {
      const { data: sub } = await createSubscription({ plan: plan.slug, cadence, billing });
      if (sub.free_days > 0) {
        toast.success(`${sub.free_days} free day${sub.free_days === 1 ? "" : "s"} credited from your current plan${sub.forfeited > 0 ? ` (${inr(sub.forfeited)} excess forfeited)` : ""}.`, { duration: 6000 });
      }
      const options = {
        key: sub.key,
        subscription_id: sub.subscription_id,
        name: "Meeticulous",
        description: `${planLabel(plan.slug, plan.name)} — ${cadence} (auto-renews)`,
        handler: async () => {
          try {
            const { data } = await syncSubscription();
            if (data?.profile) {
              updateUser({
                plan: data.profile.plan,
                plan_expires_at: data.profile.plan_expires_at,
                billing_cadence: data.profile.billing_cadence,
                subscription_status: data.profile.subscription_status,
              });
            }
            toast.success(`🎉 ${planLabel(plan.slug, plan.name)} active — renews ${cadence}.`);
          } catch {
            toast.success("Mandate set up. Activation may take a moment — refresh shortly.");
          }
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#4f46e5" },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start subscription");
    } finally {
      setPaying(null);
    }
  }, [cadence, user, updateUser, billing]);

  const doCancel = async () => {
    setConfirmCancel(false);
    setCancelling(true);
    try {
      const { data } = await cancelSubscription();
      updateUser({ subscription_status: "cancelled" });
      toast.success(data.message || "Subscription cancelled");
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  const expiry = user?.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;
  const status = user?.subscription_status;
  // Only show the manage panel for a REAL auto-renew mandate. Legacy one-time
  // annual vendors are 'active' but have no mandate — they re-subscribe via the
  // plan cards below (which migrates them onto auto-renew rails).
  const hasActiveSub = user?.has_payment_mandate && (status === "active" || status === "cancelled") && currentPlan !== "starter";

  return (
    <div className="mx-auto max-w-5xl">
      <BackButton />
      <PageHeader
        title="Upgrade Your Plan"
        subtitle={
          <>
            You're on the <span className="font-semibold text-gray-700">{planLabel(currentPlan, currentPlan)}</span> plan
            {expiry && daysLeft > 0 && ` · renews in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
            {expiry && daysLeft <= 0 && <span className="text-red-500"> · expired</span>}
            {user?.billing_cadence && ` · ${user.billing_cadence}`}
          </>
        }
      />

      {/* Manage current subscription */}
      {hasActiveSub && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {status === "cancelled" ? (
              <>Auto-renew is <strong className="text-amber-600">off</strong>. Access ends {expiry ? expiry.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "at period end"}.</>
            ) : (
              <>Auto-renew is <strong className="text-emerald-600">on</strong> ({user?.billing_cadence}). Next charge {expiry ? expiry.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}.</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDetails(true)}>View details</Button>
            {status === "active" && (
              <Button variant="danger-outline" size="sm" onClick={() => setConfirmCancel(true)} disabled={cancelling}>
                {cancelling ? "Cancelling…" : "Cancel auto-renew"}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Cadence toggle */}
      <div className="mb-7 flex items-center justify-center gap-2">
        <div className="inline-flex rounded-full bg-gray-100 p-1">
          {["monthly", "annual"].map((c) => (
            <button key={c} onClick={() => setCadence(c)}
              className={cn("rounded-full px-5 py-1.5 text-sm font-semibold transition-colors", cadence === c ? "bg-white text-gray-900 shadow" : "text-gray-500")}>
              {c === "monthly" ? "Monthly" : "Annual"}
              {c === "annual" && <span className="ml-1.5 text-[10px] font-bold text-emerald-600">save more</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading plans…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentTier = currentPlan === plan.slug;
            // "Current Plan" only when tier AND cadence match — otherwise the
            // vendor can switch cadence on their current tier.
            const isCurrentExact = isCurrentTier && (!user?.billing_cadence || user.billing_cadence === cadence);
            const paid = isPaid(plan);
            const price = priceFor(plan, cadence);
            const cadenceAvailable = price > 0;
            const annualEquivOfMonthly = (Number(plan.monthly_price) || 0) * 12;
            const savings = annualEquivOfMonthly > 0 && Number(plan.annual_price) > 0
              ? annualEquivOfMonthly - Number(plan.annual_price) : 0;

            return (
              <div key={plan.slug} className={cn("relative flex flex-col rounded-2xl border-2 bg-white p-6 dash-elev-1", isCurrentTier ? "border-primary ring-2 ring-primary/20" : "border-gray-200")}>
                <div className="mb-4">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{planLabel(plan.slug, plan.name)}</span>
                  <div className="mt-3">
                    {!paid ? (
                      <p className="text-3xl font-bold">Free</p>
                    ) : cadenceAvailable ? (
                      <>
                        {/* Lead with the GST-INCLUSIVE amount, matching /pricing.
                            subscription_plans stores the ex-GST base, so showing
                            that as the headline made the dashboard quote a
                            different number than the marketing page. */}
                        <p className="text-3xl font-bold">
                          {inr(Math.round(price * (1 + GST_RATE)))}
                          <span className="ml-1 text-sm font-normal text-gray-400">/ {cadence === "monthly" ? "month" : "year"}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500">incl. GST · {inr(price)} + 18% GST</p>
                        {cadence === "annual" && savings > 0 && (
                          <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">Save {inr(Math.round(savings * (1 + GST_RATE)))}/yr vs monthly</p>
                        )}
                      </>
                    ) : (
                      <p className="py-2 text-sm font-semibold text-gray-400">Annual billing only</p>
                    )}
                  </div>
                </div>

                <ul className="mb-6 flex-1 space-y-2">
                  {featureLines(plan).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600"><Check /> {f}</li>
                  ))}
                </ul>

                {isCurrentExact ? (
                  <div className="rounded-xl bg-gray-100 py-2.5 text-center text-sm font-medium text-gray-500">Current Plan</div>
                ) : !paid ? (
                  <div className="rounded-xl border border-gray-200 py-2.5 text-center text-sm text-gray-400">Default plan</div>
                ) : (
                  <Button full onClick={() => setPendingPlan(plan)} disabled={paying === plan.slug || !cadenceAvailable}>
                    {paying === plan.slug ? "Opening payment…"
                      : !cadenceAvailable ? "Annual billing only"
                      : isCurrentTier ? `Switch to ${cadence}`
                      : (plan.sort_order ?? 0) < myOrder ? `Downgrade to ${planLabel(plan.slug, plan.name)}`
                      : `Upgrade to ${planLabel(plan.slug, plan.name)}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Card className="mt-8 text-center text-sm text-gray-500">
        Plans auto-renew {cadence}. Cancel anytime — you keep access until the period ends. GST charged on top. · Powered by Razorpay.
      </Card>

      <Modal
        open={!!pendingPlan}
        onClose={() => setPendingPlan(null)}
        title="Billing details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingPlan(null)}>Cancel</Button>
            <Button
              disabled={!billing.state_code}
              onClick={() => {
                if (!billing.state_code) { toast.error("Please select your billing state."); return; }
                const plan = pendingPlan;
                setPendingPlan(null);
                handleUpgrade(plan);
              }}
            >
              Continue to payment
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-500">Used for your GST invoice. GSTIN and PAN are optional.</p>
        <FormField label="Business / legal name" required>
          <Input value={billing.name} onChange={(e) => setBilling((b) => ({ ...b, name: e.target.value }))} />
        </FormField>
        <FormField label="Billing address" required>
          <Input value={billing.address} onChange={(e) => setBilling((b) => ({ ...b, address: e.target.value }))} />
        </FormField>
        <FormField label="Billing state" required hint="Determines your GST place of supply">
          <Select
            value={billing.state_code}
            onChange={(e) => {
              const code = e.target.value;
              const name = INDIAN_STATES.find((s) => s.code === code)?.name || "";
              setBilling((b) => ({ ...b, state_code: code, state: name }));
            }}
          >
            <option value="">Select your state…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="GSTIN" hint="Optional">
            <Input value={billing.gstin} onChange={(e) => setBilling((b) => ({ ...b, gstin: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="PAN" hint="Optional">
            <Input value={billing.pan} onChange={(e) => setBilling((b) => ({ ...b, pan: e.target.value.toUpperCase() }))} />
          </FormField>
        </div>
      </Modal>

      {/* Subscription details drawer — consolidates status, renewal price, billing
          period switch and upgrade path (the retention + upsell surface). All data
          is already loaded; no extra fetch. */}
      <Sheet open={showDetails} onClose={() => setShowDetails(false)} side="right" title="Subscription details">
        {(() => {
          const myPlan = plans.find((p) => p.slug === currentPlan);
          const renewCadence = user?.billing_cadence || cadence;
          const base = myPlan ? priceFor(myPlan, renewCadence) : 0;
          const tax = Math.round(base * GST_RATE * 100) / 100;
          const fmtDay = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
          const otherCadence = renewCadence === "monthly" ? "annual" : "monthly";
          const canSwitch = myPlan && priceFor(myPlan, otherCadence) > 0;
          return (
            <div className="px-2 pb-4">
              <p className="mb-1 text-lg font-semibold text-gray-900">{planLabel(currentPlan, currentPlan)}</p>

              <div className={cn("mb-5 rounded-xl p-4 text-sm", status === "cancelled" ? "bg-amber-50" : "bg-emerald-50")}>
                <p className="font-semibold text-gray-800">
                  {status === "cancelled" ? "Auto-renew is off" : "Subscription renews automatically"}
                </p>
                <p className="mt-1 text-gray-600">
                  {status === "cancelled"
                    ? <>Access ends {expiry ? fmtDay(expiry) : "at period end"}.</>
                    : <>Next charge is {inr(base)} + {inr(tax)} GST {expiry ? `on ${fmtDay(expiry)}` : ""}. Renews {renewCadence === "monthly" ? "monthly" : "for 12 months"}.</>}
                </p>
              </div>

              <dl className="divide-y divide-gray-100 text-sm">
                <div className="flex items-center justify-between py-3">
                  <dt className="text-gray-500">Status</dt>
                  <dd className={cn("font-semibold", daysLeft <= 0 ? "text-red-500" : status === "cancelled" ? "text-amber-600" : "text-emerald-600")}>
                    {daysLeft <= 0 ? "Expired" : status === "cancelled" ? "Cancelled" : "Active"}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-gray-500">Expiration date</dt>
                  <dd className="font-medium text-gray-800">{expiry ? fmtDay(expiry) : "—"}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-gray-500">Renewal price</dt>
                  <dd className="font-medium text-gray-800">{inr(base)}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-gray-500">Taxes &amp; fees</dt>
                  <dd className="font-medium text-gray-800">{inr(tax)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-gray-500">Next billing period</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{renewCadence === "monthly" ? "Monthly" : "12 months"}</span>
                    {canSwitch && (
                      <Button variant="secondary" size="sm" onClick={() => { setCadence(otherCadence); setShowDetails(false); setPendingPlan(myPlan); }}>
                        Change
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-sm text-gray-500">
                Need more resources?{" "}
                <button type="button" className="font-semibold text-primary hover:opacity-80" onClick={() => setShowDetails(false)}>
                  Upgrade to a higher plan.
                </button>
              </p>
            </div>
          );
        })()}
      </Sheet>

      <ConfirmSheet
        open={confirmCancel}
        title="Cancel auto-renew?"
        message="You keep full access until the end of your current billing period. Auto-renewal will stop."
        confirmLabel="Cancel auto-renew"
        cancelLabel="Keep plan"
        onConfirm={doCancel}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
};

export default UpgradePlan;
