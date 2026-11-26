// Settings / Plan & billing — Kept. The UpgradePlan page (real plan state,
// Razorpay checkout, gift/billing logic, prices from subscription_plans ex-GST and
// shown x1.18) rendered with `embedded` inside the Settings shell: grouped list on
// the left on desktop, a pushed sub-screen with a back chevron on phones.
import UpgradePlan from './UpgradePlan';
import SettingsShell from './settings/SettingsShell';

const UpgradePlanV2 = () => (
  <SettingsShell pane="plan" sub="Your plan, what Pro adds, and how you pay.">
    <UpgradePlan embedded />
  </SettingsShell>
);

export default UpgradePlanV2;
