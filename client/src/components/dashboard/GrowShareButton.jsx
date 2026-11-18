// Grow — "Share your page" action. Copies the host's public profile link
// (origin/username) to the clipboard. username is the public slug (same source
// as ProfileCompletionPanel / the Dashboard "view page" link).
import { Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Button } from './ui';

const GrowShareButton = () => {
  const { user } = useAuth();
  const link = user?.username ? `${window.location.origin}/${user.username}` : null;
  const share = async () => {
    if (!link) { toast.error('Finish your profile to get a shareable link.'); return; }
    try { await navigator.clipboard.writeText(link); toast.success('Booking page link copied'); }
    catch { toast.error("Couldn't copy the link."); }
  };
  return (
    <Button size="sm" variant="secondary" onClick={share}>
      <Share2 className="h-4 w-4" /> Share page
    </Button>
  );
};

export default GrowShareButton;
