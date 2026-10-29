import { useState, cloneElement } from 'react';
import { Sheet } from './Overlay';
import { useLongPress } from './useLongPress';
import { cn } from './cn';

// Long-press (or click, with openOnClick) a trigger to open a bottom-sheet
// action list. Replaces per-card button grids for secondary row actions.
export function ContextMenu({ items = [], trigger, title, openOnClick = false }) {
  const [open, setOpen] = useState(false);
  const longPress = useLongPress(() => setOpen(true));
  const handlers = {
    ...longPress,
    ...(openOnClick ? { onClick: () => setOpen(true) } : {}),
  };
  return (
    <>
      {cloneElement(trigger, handlers)}
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col pb-2">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setOpen(false); it.onSelect?.(); }}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-gray-50',
                it.danger ? 'text-red-600' : 'text-gray-800',
              )}
            >
              {it.icon && <it.icon className="h-5 w-5" />}
              {it.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export default ContextMenu;
