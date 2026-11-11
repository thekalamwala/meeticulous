import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from './AuthorChip';
import useFocusTrap from './useFocusTrap';

const ROLE_LABEL = { guest: 'Guest', host: 'Host', host_guest: 'Host & guest', staff: 'Staff' };

// Bottom sheet that replaces the broken hover-card on touch. One action:
// Visit profile (no Follow). Dismiss on backdrop tap, Esc, or swipe-down.
export default function MiniProfileSheet({ author, onClose }) {
  const { ref, onKeyDown } = useFocusTrap(onClose);
  const startY = useRef(null);
  const [dragY, setDragY] = useState(0);

  const isStaff = author?.badge === 'official' || author?.badge === 'staff';
  const roleKey = isStaff ? 'staff' : (author?.role || 'guest');

  // Swipe-down to dismiss: follow the finger, close past a 70px threshold.
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 70) onClose();
    else setDragY(0);
    startY.current = null;
  };

  return (
    <div className="mt-sheet-backdrop mt-sheet-backdrop--bottom" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${author?.display_name || 'Member'} profile`}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        className="mt-sheet"
      >
        <div className="mt-sheet__handle" aria-hidden="true" />
        <div className="mt-sheet__cover" aria-hidden="true" />
        <div className="mt-sheet__body">
          <Avatar author={author} />
          <div className="mt-sheet__name">{author?.display_name || 'Member'}</div>
          <div className="text-xs text-muted">{ROLE_LABEL[roleKey]}{isStaff ? ' · Meeticulous' : ''}</div>
          {author?.profile_url
            ? <Link to={author.profile_url} onClick={onClose} className="mt-btn mt-btn--block">Visit profile</Link>
            : <button type="button" onClick={onClose} className="mt-btn mt-btn--secondary mt-btn--block">Close</button>}
        </div>
      </div>
    </div>
  );
}
