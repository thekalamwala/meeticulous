import * as React from 'react';
/** Checkbox with 6px-radius box; checked = maroon fill, white tick. */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  description?: React.ReactNode;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
