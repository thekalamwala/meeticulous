import { forwardRef } from 'react';
import { cn } from './cn';
import MeetDropdown from '../../ui/MeetDropdown';
import { optionsFromChildren } from '../../ui/selectChildren';

// Minimalist: a clean bottom border instead of a full frame, transparent, no
// ring — paired with a label above (see Label / FormField). Matches the
// user-facing form style (.fb-input).
const fieldBase =
  'block w-full border-solid border-x-0 border-t-0 border-b-[1.5px] rounded-none border-neutral-300 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors ' +
  'focus:border-primary focus:outline-none focus:shadow-none ' +
  'disabled:cursor-not-allowed disabled:text-neutral-400';

export const Input = forwardRef(function Input({ className = '', invalid = false, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(fieldBase, 'h-10 px-0.5', invalid && 'border-red-400 focus:border-red-500', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', invalid = false, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldBase, 'px-0.5 py-2', invalid && 'border-red-400', className)}
      {...props}
    />
  );
});

// Branded dropdown: wraps MeetDropdown but keeps this component's native-<select>
// API — <option> children and an event-shaped onChange — so no caller changes.
// A native select's value is always a string, so we stringify to match, and the
// onChange handler still receives { target: { value, name } }.
export const Select = forwardRef(function Select(
  { className = '', invalid = false, children, value, onChange, name, id, disabled, ...props },
  _ref,
) {
  return (
    <MeetDropdown
      id={id}
      name={name}
      disabled={disabled}
      ariaLabel={props['aria-label']}
      className={cn(invalid && 'mt-dd--invalid', className)}
      value={value == null ? '' : String(value)}
      onChange={(v) => onChange?.({ target: { value: v, name } })}
      options={optionsFromChildren(children)}
    />
  );
});

export function Label({ htmlFor, required, children, className = '' }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-neutral-700', className)}>
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
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default FormField;
