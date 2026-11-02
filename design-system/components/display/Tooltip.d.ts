import * as React from 'react';
/** Ink tooltip on hover/focus. */
export interface TooltipProps {
  content: React.ReactNode;
  placement?: 'top' | 'bottom';
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}
export declare function Tooltip(props: TooltipProps): JSX.Element;
