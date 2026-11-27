import { useEffect, useState } from 'react';
import { getPublicPlans } from '../../services/api';
import { normalizePlan } from '../../utils/themeUtils';
import { useAuth } from '../../context/AuthContext';
import { useFeature } from '../../context/FeatureContext';

/**
 * Who may create digital products — shared by the Products list and its editor.
 *
 * Admin kill-switch (fail-open: on unless an admin disabled it) + a database-driven
 * plan gate. A plan can sell digital products when its DB `digital_products`
 * allowance is non-zero (-1 = unlimited). We gate on the real allowance, never on
 * the slug — a higher tier must never be prompted to "upgrade" to a lower one.
 * Alias resolution comes from themeUtils rather than a local map — the canonical
 * free slug has already changed once (starter → free) and a private copy silently
 * stopped matching any plan row, which made the gate fall through to "can create".
 */
export default function useProductGate() {
  const { user } = useAuth();
  const digitalProductsOn = useFeature('digital_products');
  const [plans, setPlans] = useState(null); // DB subscription_plans; null = loading

  useEffect(() => {
    getPublicPlans().then(({ data }) => setPlans(data || [])).catch(() => setPlans([]));
  }, []);

  const sortedPlans = [...(plans || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const myPlan = sortedPlans.find((p) => p.slug === normalizePlan(user?.plan));
  const myProductLimit = Number(myPlan?.limits?.digital_products ?? 0);
  // Fail open while plans load (null) or when the plan is unrecognised — mirrors
  // FeatureContext, so we never wrongly block someone we can't classify.
  const planIncludesProducts = plans === null || !myPlan ? true : myProductLimit !== 0;
  // Cheapest strictly-higher tier that actually includes products — names the
  // upgrade CTA. No hardcoded plan name or price (both drift over time).
  const upgradePlan = sortedPlans.find(
    (p) => Number(p.limits?.digital_products ?? 0) !== 0 && (p.sort_order || 0) > (myPlan?.sort_order || 0),
  );
  return {
    digitalProductsOn,
    canCreate: planIncludesProducts && digitalProductsOn,
    plansLoaded: plans !== null,
    upgradePlan,
  };
}
