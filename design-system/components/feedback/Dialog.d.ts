import * as React from 'react';
/** Modal on an ink overlay, 32px radius. `inline` positions it inside its parent (for previews). */
export interface DialogProps {
  open?: boolean;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
  inline?: boolean;
  className?: string;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
