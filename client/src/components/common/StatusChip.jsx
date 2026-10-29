import { Clock, Check, CheckCircle2, X, UserX } from "lucide-react";

/**
 * Unified booking-status chip. Icon-only on mobile (< sm) so narrow columns
 * never clip "Cancelled"; icon + label from sm up. title/aria-label carry the
 * full status at every size.
 */
const STATUS_MAP = {
  pending:   { label: "Pending",   Icon: Clock,        cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  confirmed: { label: "Confirmed", Icon: Check,        cls: "bg-green-100 text-green-700 border-green-200" },
  completed: { label: "Completed", Icon: CheckCircle2, cls: "bg-blue-100 text-blue-600 border-blue-200" },
  cancelled: { label: "Cancelled", Icon: X,            cls: "bg-red-100 text-red-600 border-red-200" },
  no_show:   { label: "No-show",   Icon: UserX,        cls: "bg-orange-100 text-orange-700 border-orange-200" },
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
