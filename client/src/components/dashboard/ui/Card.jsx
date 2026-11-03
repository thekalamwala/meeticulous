import { cn } from './cn';

export function Card({ as: Tag = 'div', className = '', padded = true, interactive = false, ...props }) {
  return (
    <Tag
      className={cn(
        'bg-white border-2 border-maroon/10 rounded-2xl dash-elev-1',
        padded && 'p-4 sm:p-5',
        interactive && 'dash-elev-hover cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

export default Card;
