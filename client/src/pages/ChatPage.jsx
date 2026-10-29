import SupportChat from '../components/chat/SupportChat';

// Host dashboard Chat (/dashboard/chat). The guest dashboard reuses the same
// SupportChat component from its own route — the server tells host from guest.
export default function ChatPage() {
  return <SupportChat />;
}
