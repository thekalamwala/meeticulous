/**
 * The calendar slot — Meeticulous's core layout module and booking UI atom. empty (outline) · open (marigold) · booked (maroon + pink dot) · busy (hatched).
 * @startingPoint section="Brand" subtitle="Slot grid — the booking atom" viewport="700x260"
 */
export interface SlotCellProps {
  state?: 'empty' | 'open' | 'booked' | 'busy';
  time?: string;
  label?: string;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export declare function SlotCell(props: SlotCellProps): JSX.Element;
