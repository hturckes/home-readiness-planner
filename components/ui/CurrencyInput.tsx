'use client';

import { useRef, useState, useEffect } from 'react';
import { debounce } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  tooltip?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  min,
  max,
  label,
  tooltip,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  // rawInput holds the in-progress string while the user is typing
  const [rawInput, setRawInput] = useState('');

  // Keep a stable debounced callback that always calls the latest onChange.
  // The ref pattern ensures the debounced function is created once and never
  // recreated on re-renders, avoiding timer resets during rapid typing.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debouncedOnChange = useRef(
    debounce((val: number) => onChangeRef.current(val), 300)
  ).current;

  // Sync display when the parent updates value while we're not focused
  // (e.g. after resetToDefaults)
  useEffect(() => {
    if (!focused) {
      setRawInput(String(value));
    }
  }, [value, focused]);

  /** Formatted display for the resting (non-focused) state */
  const formattedDisplay = Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : '0';

  const displayValue = focused ? rawInput : formattedDisplay;

  const handleFocus = () => {
    setFocused(true);
    // Show the raw number (no commas) so the user can edit cleanly
    setRawInput(Number.isFinite(value) ? String(value) : '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip everything except digits (no decimals for currency)
    const digits = e.target.value.replace(/[^0-9]/g, '');
    setRawInput(digits);
    const num = digits === '' ? 0 : Number(digits);
    debouncedOnChange(num);
  };

  const handleBlur = () => {
    setFocused(false);
    const num = rawInput === '' ? 0 : Number(rawInput);
    const safe = Number.isFinite(num) ? num : 0;
    let clamped = safe;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    // Fire immediately on blur (no debounce) with the clamped value
    onChange(clamped);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center gap-1">
        <label className="text-xs font-semibold text-[#1B3A5C] uppercase tracking-wide">
          {label}
        </label>
        {tooltip && <TooltipIcon text={tooltip} />}
      </div>

      {/* Input row */}
      <div
        className={`
          flex items-center rounded-md border bg-white transition-colors duration-150
          ${focused
            ? 'border-[#2E6DA4] ring-2 ring-[#D6E8F7]'
            : 'border-gray-300 hover:border-[#2E6DA4]'
          }
        `}
      >
        {/* $ prefix */}
        <span className="pl-3 pr-1 text-sm font-medium text-gray-500 select-none">
          $
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          className="
            min-w-0 flex-1 py-2 pr-3 text-sm text-gray-900
            bg-transparent outline-none placeholder:text-gray-400
          "
          aria-label={label}
        />
      </div>
    </div>
  );
}

// ─── Tooltip icon ─────────────────────────────────────────────────────────────

function TooltipIcon({ text }: { text: string }) {
  return (
    <span className="group relative ml-0.5 inline-flex cursor-help">
      {/* Trigger: small ℹ badge */}
      <span
        aria-hidden="true"
        className="
          flex h-3.5 w-3.5 items-center justify-center rounded-full border
          border-[#2E6DA4] text-[9px] font-bold leading-none text-[#2E6DA4]
          select-none
        "
      >
        i
      </span>

      {/* Popup — visible on hover via Tailwind group-hover */}
      <span
        role="tooltip"
        className="
          pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-44
          -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-2 text-xs
          leading-snug text-white shadow-lg
          opacity-0 transition-opacity duration-150
          group-hover:opacity-100
        "
      >
        {text}
        {/* Arrow */}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
