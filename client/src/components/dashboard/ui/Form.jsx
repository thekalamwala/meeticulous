import { forwardRef } from 'react';
import { cn } from './cn';

const fieldBase =
  'block w-full rounded border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-colors ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

export const Input = forwardRef(function Input({ className = '', invalid = false, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(fieldBase, 'h-10 px-3', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-200', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', invalid = false, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, 'px-3 py-2', invalid && 'border-red-400 focus:ring-red-200', className)}
      {...props}
    />
  );
});

// On-brand native <select>: blue chevron + accent instead of the OS default
// (grey arrow / blue highlight). The dropdown popup is OS-rendered and only
// partially stylable, but the control itself now reads on-theme.
const SELECT_STYLE = {
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  accentColor: 'var(--primary)',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2300457C' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.7rem center',
};

export const Select = forwardRef(function Select({ className = '', invalid = false, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      style={SELECT_STYLE}
      className={cn(fieldBase, 'h-10 cursor-pointer px-3 pr-8', invalid && 'border-red-400 focus:ring-red-200', className)}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ htmlFor, required, children, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-gray-700', className)}>
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

export function FormField({ label, htmlFor, required, hint, error, children, className = '' }) {
  return (
    <div className={cn('mb-4', className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default FormField;
