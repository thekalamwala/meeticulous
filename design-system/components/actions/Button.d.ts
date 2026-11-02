import * as React from 'react';
/**
 * Pill button. Primary = solid maroon; secondary = maroon outline; ghost = text; onBrand = pink fill for maroon grounds; danger = destructive.
 * @startingPoint section="Actions" subtitle="Pill buttons in every variant" viewport="700x260"
 */
export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'onBrand' | 'danger';
  size?: 's' | 'm' | 'l';
  block?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  as?: 'button' | 'a';
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
