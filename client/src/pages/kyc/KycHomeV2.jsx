// Settings / Verification — dashboard_v2 graduation. Reuses the KycHome page
// (real KYC status, payout gate, re-submit flow) verbatim with `embedded`, which
// swaps the hero for the shared Settings SubNav + v2 heading.
import KycHome from './KycHome';

const KycHomeV2 = () => <KycHome embedded />;

export default KycHomeV2;
