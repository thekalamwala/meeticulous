// Settings / Verification — Kept. KycHome (real KYC status, payout gate,
// re-submit flow) inside the Settings shell. The Money session owns the KYC
// restyle, so KycHome keeps its own heading here (`bare` shell: back chevron and
// the desktop groups list only).
import KycHome from './KycHome';
import SettingsShell from '../settings/SettingsShell';

const KycHomeV2 = () => (
  <SettingsShell pane="verification" bare>
    <KycHome embedded />
  </SettingsShell>
);

export default KycHomeV2;
