import * as React from 'react';
/** On/off toggle. On = maroon track with pink knob. */
export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}
export declare function Switch(props: SwitchProps): JSX.Element;
