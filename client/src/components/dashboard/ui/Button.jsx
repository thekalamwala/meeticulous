import { forwardRef } from 'react';
import { cn } from './cn';

// Loop & Slot buttons: maroon fill, pill radius, warm-neutral never grey, outline/
// ghost tint pink on hover, 3px rose focus ring (applied in buttonClasses base).
const VARIANTS = {
  primary: 'bg-maroon text-white hover:bg-maroon-700 border-2 border-transparent',
  secondary: 'bg-white text-maroon border-2 border-maroon hover:bg-pink-100',
  outline: 'bg-transparent text-maroon border-2 border-maroon hover:bg-pink-100',
  ghost: 'bg-transparent text-maroon border-2 border-transparent hover:bg-pink-100',
  danger: 'bg-error-fg text-white border-2 border-transparent hover:brightness-90',
  'danger-outline': 'bg-transparent text-error-fg border-2 border-error-fg hover:bg-error-bg',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-10 w-10 p-0',
};

export function buttonClasses({ variant = 'primary', size = 'md', full = false, className = '' } = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition select-none',
    'active:translate-y-px',
    'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    full && 'w-full',
    className,
  );
}

export const Button = forwardRef(function Button(
  { variant, size, full, className, type = 'button', children, ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses({ variant, size, full, className })} {...props}>
      {children}
    </button>
  );
});

export default Button;
