import * as React from 'react';
/** Radio — checked state is a maroon ring with the pink brand dot inside. */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  description?: React.ReactNode;
  name: string;
}
export declare function Radio(props: RadioProps): JSX.Element;
