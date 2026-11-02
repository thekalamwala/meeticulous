/** Official logo files, never redrawn. kind: wordmark · icon (camera+calendar) · ee · monogram. tone: color · inverse (on maroon) · white · primary · black. */
export interface LogoProps {
  kind?: 'wordmark' | 'icon' | 'ee' | 'monogram';
  tone?: 'color' | 'inverse' | 'white' | 'primary' | 'black' | 'small';
  height?: number;
  assetBase?: string;
  style?: React.CSSProperties;
  className?: string;
}
export declare function Logo(props: LogoProps): JSX.Element;
