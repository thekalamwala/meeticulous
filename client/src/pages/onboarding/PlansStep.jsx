import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ChevronDown, Rocket, Loader2 } from 'lucide-react';
import { getPublicPlans, activateFreePlan, advanceToLive, createSubscription, syncSubscription, getMe } from '../../services/api';
import { planLabel } from '../../utils/themeUtils';
import { fireCelebration } from '../../utils/celebration';
import useOnboardingGuard from './useOnboardingGuard';
import ProgressBar from './ProgressBar';
import loadRazorpay from '../../utils/loadRazorpay';
import { INDIAN_STATES } from '../../lib/indianStates';
import PetalSpinner from '../../components/common/PetalSpinner';

const GST_RATE = 0.18; // display only — server is authoritative
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Concise feature list straight from the DB plan record (mirrors UpgradePlan).
const featureLines = (plan) => {
  const L = plan.limits || {};
  const lim = (v, label) => (v === -1 ? `Unlimited ${label}` : `${v ?? 0} ${label}`);
  const lines = [
    lim(L.services, 'services'),
    L.bookings_per_year === -1 ? 'Unlimited bookings' : `${(L.bookings_per_year ?? 0).toLocaleString('en-IN')} bookings / year`,
    Number(plan.commission_percentage) > 0 ? `${Number(plan.commission_percentage)}% commission` : '0% commission',
  ];
  if (plan.features?.advanced_reports) lines.push('Advanced analytics');
  if (plan.support_type) lines.push(`${plan.support_type.replace(/_/g, ' ')} support`);
  return lines;
};

const priceFor = (plan, c) => (c === 'monthly' ? Number(plan.monthly_price) || 0 : Number(plan.annual_price) || 0);
const isPaidPlan = (plan) => priceFor(plan, 'monthly') > 0 || priceFor(plan, 'annual') > 0;

const PlansStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const ready = useOnboardingGuard();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cadence, setCadence] = useState('annual');
  const [busy, setBusy] = useState(null);            // plan slug | 'free' | null
  const [me, setMe] = useState(null);
  const [showPaid, setShowPaid] = useState(false);   // drawer for paid plans
  const [billing, setBilling] = useState({ state_code: '', state: '' }); // GST place of supply
  const [pendingPaid, setPendingPaid] = useState(null); // {plan, payCadence} awaiting billing state
  // Cache created subscriptions per plan+cadence. On a retry (webhook lag),
  // reuse the existing subscription instead of minting a second one.
  const subCacheRef = useRef({});

  // Extracted so the empty/error fallback can retry the fetch. Without this,
  // a failed or empty getPublicPlans left every CTA null-guarded → the host saw
  // the "one click from live" header with no button at all and was stranded on
  // the last step.
  const loadPlans = useCallback(() => {
    setLoading(true);
    getPublicPlans()
      .then((r) => setPlans(r.data || []))
      .catch(() => toast.error('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPlans();
    getMe()
      .then((r) => {
        setMe(r.data);
        const bd = r.data?.billing_details;
        if (bd?.state_code) setBilling({ state_code: bd.state_code, state: bd.state || '' });
      })
      .catch(() => {});
  }, [loadPlans]);

  const freePlan = plans.find((p) => !isPaidPlan(p)) || null;
  const paidPlans = plans.filter(isPaidPlan);
  // Hero = the top-priced paid plan by annual price (Studio). Chosen by price,
  // not a hardcoded slug, so it survives a plan rename. Always sold annual.
  const heroPlan = [...paidPlans].sort((a, b) => priceFor(b, 'annual') - priceFor(a, 'annual'))[0] || null;
  const heroAnnual = heroPlan ? priceFor(heroPlan, 'annual') : 0;
  // Drawer shows the remaining paid plans — the hero already has its own card.
  // The drawer used to list only the NON-hero paid plans. With a single paid
  // plan (v3.165) that left it permanently empty, which also made monthly
  // pricing unreachable during onboarding — the hero is always sold annual.
  // List every paid plan instead, so the drawer keeps its real job: the
  // monthly/annual choice.
  const otherPaid = paidPlans;

  const goNext = () => navigate(`/vendor-register/${slug}/live`);

  // Free plan: activate, fire celebration, navigate. The /live screen fires
  // a second, larger burst on mount — this one is the "your click did
  // something" acknowledgement so the transition doesn't feel silent.
  const chooseFree = async () => {
    setBusy('free');
    try {
      await activateFreePlan();
      fireCelebration();
      toast.success('You\'re live!');
      goNext();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to activate plan');
      setBusy(null);
    }
  };

  // Paid plan: Razorpay flow. Logic intact from the previous version — only
  // the UI wrapper around it changed. See the header of this handler for the
  // (deliberately unchanged) confirmation dance around webhook lag.
  // payCadence lets a caller force a cadence (the Studio hero always pays
  // annual) independent of the drawer's monthly/annual toggle state.
  const choosePaid = async (plan, payCadence = cadence) => {
    const price = priceFor(plan, payCadence);
    if (!(price > 0)) { toast.error(`No ${payCadence} price for this plan.`); return; }
    // GST place of supply must be captured before the mandate is created (the
    // backend enforces it). If we don't have a state yet, prompt for it and resume.
    const stateCode = billing.state_code || me?.billing_details?.state_code || '';
    if (!stateCode) { setPendingPaid({ plan, payCadence }); return; }
    const billingSnap = {
      state_code: stateCode,
      state: billing.state || me?.billing_details?.state || '',
      name: me?.billing_details?.name || me?.name || '',
    };
    const loaded = await loadRazorpay();
    if (!loaded) return toast.error('Payment gateway failed to load');

    setBusy(plan.slug);
    try {
      // Reuse an already-created subscription for this plan+cadence if the host
      // is retrying after a webhook-lag "tap again" — prevents double subscriptions.
      const cacheKey = `${plan.slug}:${payCadence}`;
      let sub = subCacheRef.current[cacheKey];
      if (!sub) {
        ({ data: sub } = await createSubscription({ plan: plan.slug, cadence: payCadence, billing: billingSnap }));
        subCacheRef.current[cacheKey] = sub;
      }
      const prefillData = me
        ? { name: me.name, email: me.email, contact: me.phone }
        : (() => {
            try { const u = JSON.parse(localStorage.getItem('user') || '{}'); return { name: u.name, email: u.email }; }
            catch { return {}; }
          })();

      const FREE_SLUGS = ['explorer', 'starter', '', null, undefined];
      const tryFinalize = async () => {
        try { await syncSubscription(); } catch { /* webhook will finalize */ }
        let freshMe;
        try { ({ data: freshMe } = await getMe()); } catch { return false; }
        if (FREE_SLUGS.includes(freshMe?.plan)) return false;
        await advanceToLive();
        fireCelebration();
        toast.success(`${planLabel(plan.slug, plan.name)} active — renews ${payCadence}.`);
        goNext();
        return true;
      };

      const options = {
        key: sub.key,
        subscription_id: sub.subscription_id,
        name: 'Meeticulous',
        description: `${planLabel(plan.slug, plan.name)} — ${payCadence} (auto-renews)`,
        handler: async () => {
          if (await tryFinalize()) return;
          if (import.meta.env?.MODE !== 'test') {
            await new Promise((r) => setTimeout(r, 2000));
          }
          if (await tryFinalize()) return;
          toast.success('Payment received — finalizing your plan. Tap the plan again in a moment to continue.');
          setBusy(null);
        },
        modal: {
          ondismiss: () => {
            setBusy(null);
            toast('Checkout closed — you can pick a plan when you\'re ready.');
          },
        },
        prefill: prefillData,
        theme: { color: '#2E1065' },
      };
      new window.Razorpay(options).open();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start subscription');
      setBusy(null);
    }
  };

  if (!ready) {
    return (
      <>
        <ProgressBar current={4} total={4} />
        <div className="app-container flex min-h-[calc(100vh-72px)] items-center justify-center">
          <PetalSpinner size={48} />
        </div>
      </>
    );
  }

  return (
    <>
      <ProgressBar current={4} total={4} />
      <div className="app-container flex min-h-[calc(100vh-72px)] items-start sm:items-center justify-center py-8 sm:py-12">
        <div className="w-full max-w-2xl px-4">
          <button
            onClick={() => navigate(`/vendor-register/${slug}/preview`)}
            className="text-sm text-gray-500 hover:text-gray-800 mb-4 inline-block"
          >
            ← Back
          </button>

          {/* Hero — publish moment */}
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Rocket className="h-7 w-7 text-primary" strokeWidth={2} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">You're one click from live</h1>
            <p className="text-gray-500 text-sm">
              Go live with everything unlocked on Studio — or start free below.
            </p>
          </div>

          {loading ? (
            <p className="text-center text-sm text-gray-400 py-10">Loading plans…</p>
          ) : plans.length === 0 ? (
            /* Plans failed to load or came back empty — never strand the host on
               the last step. Free activation doesn't need the plans list, so
               offer it directly alongside a retry. */
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 sm:p-7 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Couldn’t load the plans just now. You can retry, or go live free and upgrade later.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={loadPlans}
                  disabled={busy !== null}
                  className="btn border border-gray-300 text-gray-700 py-2.5 px-5 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-50 transition"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={chooseFree}
                  disabled={busy !== null}
                  className="btn bg-primary-cta text-white py-2.5 px-6 text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition inline-flex items-center justify-center gap-2"
                >
                  {busy === 'free' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} /> Publishing…</>
                  ) : (
                    <><Rocket className="w-4 h-4" strokeWidth={2.5} /> Go live free</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Primary CTA card — Studio (top paid), sold annual */}
              {heroPlan && (
                <div className="relative rounded-2xl border-2 border-primary bg-primary-light/60 p-6 sm:p-7 shadow-sm">
                  <div className="absolute -top-3 left-6">
                    <span className="bg-primary-cta text-white text-xs font-bold px-3 py-1 rounded-full">Recommended</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">{planLabel(heroPlan.slug, heroPlan.name)}</h2>
                      <p className="mt-1">
                        <span className="text-2xl font-bold text-primary">{inr(Math.round(heroAnnual * (1 + GST_RATE)))}</span>
                        <span className="text-sm font-normal text-gray-500">/year</span>
                      </p>
                      <p className="text-[11px] text-gray-500">
                        incl. GST · billed today · auto-renews yearly
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => choosePaid(heroPlan, 'annual')}
                      disabled={busy !== null}
                      className="btn bg-primary-cta text-white py-3 px-6 text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {busy === heroPlan.slug ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                          Processing…
                        </>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4" strokeWidth={2.5} />
                          Pay {inr(Math.round(heroAnnual * (1 + GST_RATE)))}/yr &amp; go live
                        </>
                      )}
                    </button>
                  </div>

                  {featureLines(heroPlan).length > 0 && (
                    <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {featureLines(heroPlan).slice(0, 6).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" strokeWidth={3} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Free fallback — keep the no-credit-card escape */}
              {freePlan && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={chooseFree}
                    disabled={busy !== null}
                    className="text-sm text-gray-600 hover:text-primary font-medium disabled:opacity-50 transition inline-flex items-center gap-1.5"
                  >
                    {busy === 'free' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                        Publishing…
                      </>
                    ) : (
                      <>Prefer to start free? Publish on {planLabel(freePlan.slug, freePlan.name)} →</>
                    )}
                  </button>
                </div>
              )}

              {/* Paid drawer trigger */}
              {otherPaid.length > 0 && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setShowPaid((v) => !v)}
                    aria-expanded={showPaid}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary transition"
                  >
                    {showPaid ? 'Hide plans' : 'See all plans & monthly pricing'}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showPaid ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                  </button>
                </div>
              )}

              {/* Paid plans drawer */}
              {showPaid && otherPaid.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <div className="inline-flex bg-gray-100 rounded-full p-1">
                      {['monthly', 'annual'].map((c) => (
                        <button key={c} type="button" onClick={() => setCadence(c)}
                          className={`px-5 py-1.5 text-sm font-semibold rounded-full transition-colors ${cadence === c ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                          {c === 'monthly' ? 'Monthly' : 'Annual'}
                          {c === 'annual' && <span className="ml-1.5 text-[10px] text-emerald-600 font-bold">save more</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {otherPaid.map((plan) => {
                      const price = priceFor(plan, cadence);
                      const cadenceAvailable = price > 0;
                      const isBusy = busy === plan.slug;
                      return (
                        <div key={plan.slug} className="p-5 rounded-xl border border-gray-200 flex flex-col bg-white">
                          <h3 className="text-base font-bold mb-1.5">{planLabel(plan.slug, plan.name)}</h3>
                          {cadenceAvailable ? (
                            <>
                              <p className="text-xl font-bold text-primary mb-0.5">
                                {inr(Math.round(price * (1 + GST_RATE)))}<span className="text-sm font-normal text-gray-500">/{cadence === 'monthly' ? 'mo' : 'yr'}</span>
                              </p>
                              <p className="text-[11px] text-gray-500 mb-1">incl. GST · {inr(price)} + 18% GST</p>
                            </>
                          ) : (
                            <p className="text-sm font-semibold text-gray-400 py-2 mb-1">Annual billing only</p>
                          )}

                          <ul className="space-y-1.5 mt-3 flex-1">
                            {featureLines(plan).slice(0, 5).map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs">
                                <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" strokeWidth={3} />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>

                          <button type="button"
                            onClick={() => choosePaid(plan)}
                            disabled={busy !== null || !cadenceAvailable}
                            className="btn w-full mt-4 border border-primary text-primary py-2 text-sm font-semibold hover:bg-primary hover:text-white disabled:opacity-50 transition">
                            {isBusy ? 'Processing…'
                              : !cadenceAvailable ? 'Annual only'
                              : `Choose ${planLabel(plan.slug, plan.name)}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-center text-xs text-gray-400">
                    Paid plans auto-renew. Cancel anytime — you keep access until the period ends.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {pendingPaid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
             onClick={() => setPendingPaid(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900">Billing state</h3>
            <p className="mt-1 text-sm text-gray-500">Required for your GST tax invoice — it sets your place of supply.</p>
            <select
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={billing.state_code}
              onChange={(e) => {
                const code = e.target.value;
                const name = INDIAN_STATES.find((s) => s.code === code)?.name || '';
                setBilling({ state_code: code, state: name });
              }}
            >
              <option value="">Select your state…</option>
              {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm text-gray-500"
                      onClick={() => setPendingPaid(null)}>Cancel</button>
              <button type="button"
                className="btn rounded-lg bg-primary-cta px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!billing.state_code}
                onClick={() => { const p = pendingPaid; setPendingPaid(null); choosePaid(p.plan, p.payCadence); }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlansStep;
