/** Camera+calendar illustration family (6u monoline on 240×160). light = maroon line for light grounds; dark = white line for maroon grounds. */
export interface IllustrationProps {
  name?: 'availability' | 'group' | 'reschedule' | 'reminder' | 'payment' | 'live';
  mode?: 'light' | 'dark';
  width?: number | string;
  assetBase?: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
}
export declare function Illustration(props: IllustrationProps): JSX.Element;
