/** The ee thread graphic. thread = flat line that loops once; ribbon = continuous loops; mark = the ee alone. One per layout. */
export interface ThreadProps {
  color?: 'rose' | 'pink' | 'white' | 'maroon';
  variant?: 'thread' | 'ribbon' | 'mark';
  width?: number | string;
  assetBase?: string;
  style?: React.CSSProperties;
  className?: string;
}
export declare function Thread(props: ThreadProps): JSX.Element;
