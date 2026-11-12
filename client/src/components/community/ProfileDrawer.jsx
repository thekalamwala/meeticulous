import { Link } from 'react-router-dom';
import { Briefcase, FileText, Settings, X } from 'lucide-react';
import { Avatar } from './AuthorChip';
import useFocusTrap from './useFocusTrap';

// Right slide-in profile drawer — the burger replacement (grid tile + Profile tab).
// No Follow/connection actions anywhere. Stats (viewers/impressions) are omitted
// until the client has that data; the links + View full profile are the core.
export default function ProfileDrawer({ open, onClose, user }) {
  const { ref, onKeyDown } = useFocusTrap(onClose);
  if (!open) return null;

  const isHost = !!(user?.is_host || user?.role === 'host');
  const name = user?.name || user?.first_name || 'You';
  const author = { display_name: name, avatar_url: user?.profile_image, role: isHost ? 'host' : 'guest' };
  const profileHref = user?.username ? `/${user.username}` : '/dashboard/profile';

  return (
    <div className="mt-sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={ref} role="dialog" aria-modal="true" aria-label="Profile menu" onKeyDown={onKeyDown} className="mt-drawer">
        <div className="mt-drawer__head">
          <button type="button" onClick={onClose} aria-label="Close menu" className="mt-drawer__close">
            <X size={20} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-3">
            <Avatar author={author} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{name}</div>
              <div className="text-xs text-muted">{isHost ? 'Host' : 'Guest'}</div>
            </div>
          </div>
        </div>

        <nav aria-label="Profile links" className="mt-drawer__links">
          {isHost && (
            <Link to="/dashboard/services" onClick={onClose} className="mt-drawer__link">
              <Briefcase size={20} aria-hidden="true" />My offerings
            </Link>
          )}
          {isHost && (
            <Link to="/dashboard/profile" onClick={onClose} className="mt-drawer__link">
              <FileText size={20} aria-hidden="true" />Manage pages
            </Link>
          )}
          <Link to="/dashboard/profile" onClick={onClose} className="mt-drawer__link">
            <Settings size={20} aria-hidden="true" />Settings &amp; privacy
          </Link>
        </nav>

        <Link to={profileHref} onClick={onClose} className="mt-btn mt-btn--block">View full profile</Link>
      </aside>
    </div>
  );
}
