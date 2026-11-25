// Settings / Plan & billing — dashboard_v2 graduation. Reuses the UpgradePlan
// page (real plan state, Razorpay checkout, gift/billing logic) verbatim with
// `embedded`, which prepends the shared Settings SubNav above its plan header.
import UpgradePlan from './UpgradePlan';

const UpgradePlanV2 = () => <UpgradePlan embedded />;

export default UpgradePlanV2;
