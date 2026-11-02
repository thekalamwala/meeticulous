import * as React from 'react';
/** Ink notification with a status dot. brand dot = pink (booking events). */
export interface ToastProps {
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  onAction?: () => void;
  onClose?: () => void;
  className?: string;
}
export declare function Toast(props: ToastProps): JSX.Element;
