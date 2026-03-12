'use client';

import { useRef, useState, useEffect } from 'react';
import { debounce } from '@/lib/utils';

interface PercentInputProps {
  /** Value as a decimal fraction, e.g. 0.035 for 3.5% */
  value: number;
  onChange: (value: number) => void;
  /** Min value as a decimal fraction (e.g. 0 for 0%) */
  min?: number;
  /** Max value as a decimal fraction (e.g. 1 for 100%) */
  max?: number;
  label: string;
  tooltip?: string;
}

export default function PercentInput({
  value,
  onChange,
  min,
  max,
  label,
  tooltip,
}: PercentInputProps) {
  const [focused, setFocused] = useState(false);
  const [rawInput, setRawInput] = useState('');

  // Stable debounced callback — same ref pattern as CurrencyInput
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debouncedOnChange = useRef(
    debounce((val: number) => onChangeRef.current(val), 300)
  ).current;

  useEffect(() => {
    if (!focused) {
      setRawInput(toDisplayString(value));
    }
  }, [value, focused]);

  /** Converts a decimal to a clean display string: 0.035 → "3.5", 0.04 → "4" */
  function toDisplayString(decimal: number): string {
    if (!Number.isFinite(decimal)) return '0';
    // Multiply by 100, round to 4 decimal places, then strip trailing zeros
    return String(parseFloat((decimal * 100).toFixed(4)));
  }

  const displayValue = focused ? rawInput : toDisplayString(value);

  const handleFocus = () => {
    setFocused(true);
    setRawInput(toDisplayString(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits and at most one decimal point
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const sanitized = raw.replace(/^(\d*\.?\d*).*$/, '$1');
    setRawInput(sanitized);

    const displayNum = parseFloat(sanitized);
    if (Number.isFinite(displayNum)) {
      debouncedOnChange(displayNum / 100);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const displayNum = parseFloat(rawInput);
    const safe = Number.isFinite(displayNum) ? displayNum : 0;
    let decimal = safe / 100;
    if (min !== undefined) decimal = Math.max(min, decimal);
    if (max !== undefined) decimal = Math.min(max, decimal);
    onChange(decimal);
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
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          className="
            min-w-0 flex-1 py-2 pl-3 text-sm text-gray-900
            bg-transparent outline-none placeholder:text-gray-400
          "
          aria-label={label}
        />
        {/* % suffix */}
        <span className="pr-3 pl-1 text-sm font-medium text-gray-500 select-none">
          %
        </span>
      </div>
    </div>
  );
}

// ─── Tooltip icon (identical to CurrencyInput's) ─────────────────────────────

function TooltipIcon({ text }: { text: string }) {
  return (
    <span className="group relative ml-0.5 inline-flex cursor-help">
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
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
