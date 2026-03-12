/**
 * Returns the fallback string when value is NaN, null, undefined, or Infinity.
 * Otherwise returns the number formatted with toLocaleString (comma-separated).
 *
 * All display-facing formatting functions use this as their validity guard.
 */
export function safeNumber(value: unknown, fallback: string = '—'): string {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  if (isNaN(n) || !isFinite(n)) return fallback;
  return n.toLocaleString('en-US');
}

/**
 * Formats a number as a whole-dollar currency string.
 * e.g. 152000 → "$152,000"
 */
export function formatCurrency(value: number): string {
  const guard = safeNumber(value);
  if (guard === '—') return '—';
  return '$' + Math.round(value).toLocaleString('en-US');
}

/**
 * Formats a number as a compact currency string.
 * e.g. 152000 → "$152k", 1500000 → "$1.5m"
 */
export function formatCurrencyCompact(value: number): string {
  const guard = safeNumber(value);
  if (guard === '—') return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}$${formatted}m`;
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1_000)}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Formats a decimal as a percentage string.
 * e.g. 0.065 → "6.5%"
 *
 * @param value   Decimal fraction (0–1 range expected, e.g. 0.065 for 6.5%)
 * @param decimals Number of decimal places (default: 1)
 */
export function formatPercent(value: number, decimals: number = 1): string {
  const guard = safeNumber(value);
  if (guard === '—') return '—';
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Converts a number of months from today into a readable "Mon YYYY" label.
 * e.g. formatMonthYear(15) → "Jun 2027" (if today is March 2026)
 */
export function formatMonthYear(monthsFromNow: number): string {
  const guard = safeNumber(monthsFromNow);
  if (guard === '—') return '—';
  const date = new Date();
  date.setMonth(date.getMonth() + Math.round(monthsFromNow));
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Standard debounce. Returns a debounced version of fn that delays invocation
 * by delay milliseconds after the last call.
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
