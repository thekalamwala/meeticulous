import { Clock, Check, CheckCircle2, X, UserX } from "lucide-react";

/**
 * Unified booking-status chip. Icon-only on mobile (< sm) so narrow columns
 * never clip "Cancelled"; icon + label from sm up. title/aria-label carry the
 * full status at every size.
 */
// Loop & Slot status palette (brand ramp only). pending = marigold (an awaiting
// slot the host must act on — data, not decoration); confirmed = maroon (booked);
// completed = c-emerald; cancelled = neutral ink; no-show = rose.
const STATUS_MAP = {
  pending:   { label: "Pending",   Icon: Clock,        cls: "bg-marigold-100 text-marigold-800 border-marigold-300" },
  confirmed: { label: "Confirmed", Icon: Check,        cls: "bg-maroon-100 text-maroon-700 border-maroon-200" },
  completed: { label: "Completed", Icon: CheckCircle2, cls: "bg-c-emerald/10 text-c-emerald border-c-emerald/20" },
  cancelled: { label: "Cancelled", Icon: X,            cls: "bg-ink/5 text-ink/50 border-ink/10" },
  no_show:   { label: "No-show",   Icon: UserX,        cls: "bg-rose/10 text-rose-700 border-rose/20" },
};

const StatusChip = ({ status, className = "" }) => {
  const key = String(status || "").toLowerCase();
  const { label, Icon, cls } = STATUS_MAP[key] || STATUS_MAP.pending;
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap ${cls} ${className}`}
    >
      <Icon size={12} strokeWidth={2.5} className="shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
};

export default StatusChip;
