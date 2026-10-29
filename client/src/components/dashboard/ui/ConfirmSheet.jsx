import { Sheet } from './Overlay';
import { Button } from './Button';

/**
 * Native-style confirmation as a bottom sheet — the app replacement for
 * window.confirm(). Actions stack full-width for thumb reach.
 *
 * <ConfirmSheet open={…} title="Delete service?" message="…"
 *   confirmLabel="Delete" danger busy={saving}
 *   onConfirm={…} onClose={…} />
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-2 pb-2 pt-1">
        {message && <p className="mb-5 text-sm leading-relaxed text-gray-600">{message}</p>}
        <div className="flex flex-col gap-2">
          <Button
            full
            size="lg"
            variant={danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
          <Button full size="lg" variant="ghost" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export default ConfirmSheet;
