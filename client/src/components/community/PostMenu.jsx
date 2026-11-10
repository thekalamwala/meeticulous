import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MoreHorizontal, Pin, Bookmark, EyeOff, Ban, Flag } from 'lucide-react';
import { savePost, unsavePost, blockMember, adminPin } from '../../services/communityApi';

// The per-post "⋯" menu (feed cards). Report opens the page's report dialog; Hide is a
// local convenience; Bookmark/Block hit the new endpoints; Pin is staff/admin only.
// On your own post only Bookmark + Hide show (you don't block or report yourself).
export default function PostMenu({ item, onHide, onReport, isOwn = false, canPin = false }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(!!item.viewer?.saved);
  const ref = useRef(null);
  const author = item.author;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const run = (fn) => async () => {
    setOpen(false);
    try { await fn(); } catch { toast.error('Something went wrong — try again.'); }
  };

  const toggleSave = run(async () => {
    const next = !saved;
    setSaved(next);
    try { await (next ? savePost(item.id) : unsavePost(item.id)); toast.success(next ? 'Saved' : 'Removed from saved'); }
    catch (e) { setSaved(!next); throw e; }
  });
  const doHide = run(async () => { onHide?.(item.id); toast('Hidden from your feed'); });
  const doBlock = run(async () => {
    if (!author?.id) return;
    await blockMember(author.id);
    onHide?.(item.id);
    toast.success(`You won't see ${author.display_name} here anymore`);
  });
  const doPin = run(async () => { await adminPin(item.id, true); toast.success('Pinned to the feed'); });
  const doReport = run(async () => { onReport?.(item); });

  const MenuItem = ({ Icon, label, onClick, danger }) => (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-blush ${danger ? 'font-medium text-rose' : 'text-ink'}`}
    >
      <Icon size={18} aria-hidden="true" />{label}
    </button>
  );

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post actions"
        onClick={() => setOpen((o) => !o)}
        className="mt-btn mt-btn--ghost mt-btn--s rounded-full px-2 text-muted hover:text-maroon"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-2xl border-2 border-maroon/10 bg-white py-1 shadow-lg">
          {canPin && <MenuItem Icon={Pin} label="Pin to feed" onClick={doPin} />}
          <MenuItem Icon={Bookmark} label={saved ? 'Saved' : 'Bookmark it'} onClick={toggleSave} />
          <MenuItem Icon={EyeOff} label="Hide it" onClick={doHide} />
          {!isOwn && author?.id && <MenuItem Icon={Ban} label="Block them" onClick={doBlock} />}
          {!isOwn && <MenuItem Icon={Flag} label="Report it" onClick={doReport} danger />}
        </div>
      )}
    </div>
  );
}
