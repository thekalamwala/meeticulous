// Settings / Help — dashboard_v2 graduation. The host Chat page is just the
// SupportChat widget; v2 adds the shared Settings SubNav + v2 heading above it so
// Help sits in the same hub as Account / Plan / Verification.
import SupportChat from '../components/chat/SupportChat';
import { PageHeading, SubNav } from '../components/dashboard/ui/v2';
import { SETTINGS_NAV } from './dashboardNav';

const ChatPageV2 = () => (
  <div className="flex flex-col gap-2.5">
    <PageHeading title="Help" sub="Chat with the Meeticulous team." />
    <SupportChat />
  </div>
);

export default ChatPageV2;
