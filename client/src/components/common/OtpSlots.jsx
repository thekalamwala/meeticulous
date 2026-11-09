import { useRef, useState } from 'react';

/**
 * OTP entry rendered as separate digit slots (Loop & Slot).
 *
 * Deliberately ONE real <input> behind the boxes, not six inputs: the boxes are
 * presentation only, so the component keeps the exact contract the callers and
 * their tests rely on — a single `value` string, one `onChange(e)` with
 * `e.target.value`, native paste, `.value` readback, and placeholder/label/id
 * passthrough. Native `autoComplete="one-time-code"` gives mobile OTP autofill
 * for free. Callers still own filtering/slicing and auto-submit.
 *
 * ponytail: fake slots over one input, not a 6-input rewrite — same reason the
 * auth/booking OTP tests pass unchanged.
 */
export default function OtpSlots({
  value = '',
  onChange,
  length = 6,
  id,
  placeholder,
  autoFocus = false,
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('').slice(0, length);
  const activeIndex = Math.min(digits.length, length - 1);

  return (
    <div
      className={`relative ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Real input: transparent, full-area, source of truth for every caller + test. */}
      <input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-transparent outline-none z-10 disabled:cursor-not-allowed"
      />
      {/* Display boxes (presentation only). */}
      <div className="flex justify-center gap-2 sm:gap-3" aria-hidden="true">
        {Array.from({ length }).map((_, i) => {
          const filled = i < digits.length;
          const isActive = focused && !disabled && i === activeIndex;
          return (
            <div
              key={i}
              className={[
                'flex items-center justify-center',
                'w-11 h-14 sm:w-12 sm:h-16 rounded-lg border-2 transition-colors duration-150',
                'font-display text-2xl text-ink tabular-nums',
                disabled ? 'bg-blush/40 border-blush' : 'bg-cream',
                isActive
                  ? 'border-maroon ring-2 ring-rose'
                  : filled
                    ? 'border-maroon/40'
                    : 'border-blush',
              ].join(' ')}
            >
              {filled ? digits[i] : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
