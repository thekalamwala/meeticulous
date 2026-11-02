import * as React from 'react';
/** Small status pill. Booking tones: booked (maroon + pink dot), open (marigold), busy (neutral). */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'booked' | 'open' | 'busy' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
  dot?: boolean;
  children?: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;
