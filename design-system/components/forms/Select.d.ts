import * as React from 'react';
/** Native select styled as an Input. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Array<string | { value: string; label: string }>;
}
export declare function Select(props: SelectProps): JSX.Element;
