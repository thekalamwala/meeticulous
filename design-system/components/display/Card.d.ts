import * as React from 'react';
/**
 * Flat rounded surface (24px radius). Sits on tinted grounds rather than floating; `raised` only for overlays/interactive.
 * @startingPoint section="Display" subtitle="Surface, blush, brand and outline cards" viewport="700x300"
 */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'surface' | 'cream' | 'blush' | 'brand' | 'outline';
  size?: 's' | 'm';
  raised?: boolean;
  interactive?: boolean;
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;
