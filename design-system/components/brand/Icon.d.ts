/** Lucide icon (2px round stroke — matches the logo icon's stroke ratio). Inherits currentColor. */
export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  label?: string;
  style?: React.CSSProperties;
  className?: string;
}
export declare function Icon(props: IconProps): JSX.Element;
