import * as React from 'react';
/** Round icon-only button. `label` is required for accessibility (aria-label + title). */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'onBrand' | 'danger';
  size?: 's' | 'm' | 'l';
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
