import * as React from 'react';
/** Segmented pill tabs (default) or underline tabs for page sections. */
export interface TabsProps {
  items: Array<string | { value: string; label: React.ReactNode; count?: number }>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  variant?: 'pill' | 'underline';
  className?: string;
}
export declare function Tabs(props: TabsProps): JSX.Element;
