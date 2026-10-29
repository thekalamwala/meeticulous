import { forwardRef } from 'react';
import { cn } from './cn';

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary/90 border border-transparent',
  secondary: 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50',
  outline: 'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50',
  ghost: 'bg-transparent text-gray-600 border border-transparent hover:bg-gray-100',
  danger: 'bg-red-600 text-white border border-transparent hover:bg-red-700',
  'danger-outline': 'bg-transparent text-red-600 border border-red-300 hover:bg-red-50',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-10 w-10 p-0',
};

export function buttonClasses({ variant = 'primary', size = 'md', full = false, className = '' } = {}) {
  return cn(
    'inline-flex items-center justify-center rounded font-semibold whitespace-nowrap transition-colors select-none',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
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
