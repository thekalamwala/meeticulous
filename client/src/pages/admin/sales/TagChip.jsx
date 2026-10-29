import { chipClass } from './salesTagColors';

// A coloured tag pill. Pass onRemove to show an × (lead detail).
// Sized to match the admin <Badge> (the "Won" stage pill): 11px / 2px×8px pad /
// line-height 1.4, borderless — so tag pills and stage pills line up in the table.
export default function TagChip({ name, color, onRemove, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] leading-[1.4] px-2 py-0.5 rounded-full ${chipClass(color)} ${className}`}>
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100 leading-none">×</button>
      )}
    </span>
  );
}
