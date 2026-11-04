import { useRef } from 'react';
import Dialog from './Dialog';
import ComposerForm from './ComposerForm';

// Modal composer: the shared ComposerForm inside a Dialog. The page composer
// (/community/new, NewPost.jsx) uses ComposerForm directly with a live preview.
function ComposerModal({ onClose, defaultKind, ...props }) {
  const dirty = useRef(false);
  // Esc, backdrop and Close ask before throwing away a draft (dirty flag kept by the form).
  const dismiss = () => {
    if (dirty.current && !window.confirm('Discard this draft?')) return;
    onClose();
  };
  return (
    <Dialog title={defaultKind === 'thread' ? 'New thread' : 'New post'} onClose={dismiss}>
      <ComposerForm variant="modal" onClose={onClose} defaultKind={defaultKind} dirtyRef={dirty} {...props} />
    </Dialog>
  );
}

// Mounted only while open so every opening starts with a clean form.
export default function Composer({ open, ...props }) {
  return open ? <ComposerModal {...props} /> : null;
}
