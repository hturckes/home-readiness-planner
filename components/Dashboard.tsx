'use client';

import { useStore } from '@/lib/store';
import {
  calculatePurchaseDayCapital,
  calculateFullReadinessCapital,
  calculateMonthlyViability,
  calculateMortgagePayment,
  generateProjection,
} from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';

// ─── Status palette ───────────────────────────────────────────────────────────

const STATUS_BG: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-green-100',
  amber: 'bg-amber-100',
  red:   'bg-red-100',
};

const STATUS_TEXT: Record<'green' | 'amber' | 'red', string> = {
  green: 'text-green-800',
  amber: 'text-amber-800',
  red:   'text-red-800',
};

const STATUS_LABEL_TEXT: Record<'green' | 'amber' | 'red', string> = {
  green: 'text-green-700',
  amber: 'text-amber-700',
  red:   'text-red-700',
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const state = useStore();
  const { purchaseTarget, cashFlow, assumptions } = state;

  // Compute mortgage payment first — needed by viability and full readiness
  const mortgageResult = calculateMortgagePayment(state);

  // Viability gate
  const viability = calculateMonthlyViability(cashFlow, mortgageResult);

  // KPI values
  const purchaseDayCapital = calculatePurchaseDayCapital(purchaseTarget, assumptions);
  const fullReadinessCapital = calculateFullReadinessCapital(
    purchaseTarget,
    cashFlow,
    mortgageResult,
    assumptions
  );

  // Determine status tint for Full Readiness Capital card
  // Compare projected balance at target month to the full readiness goal
  const projection = generateProjection(state);
  const targetPoint = projection.find((p) => p.month === purchaseTarget.targetMonthsFromNow);
  const projectedAtTarget = targetPoint?.projectedBalance ?? 0;

  let readinessStatus: 'green' | 'amber' | 'red';
  if (projectedAtTarget >= fullReadinessCapital) {
    readinessStatus = 'green';
  } else if (projectedAtTarget >= purchaseDayCapital) {
    readinessStatus = 'amber';
  } else {
    readinessStatus = 'red';
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">

      {/* ── Viability guard rail ─────────────────────────────────────────── */}
      {!viability.isViable && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-5"
        >
          {/* "Action Required" label — color is paired with text, never sole indicator */}
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">
            ⚠ Action Required
          </p>

          <h2 className="mt-1 text-base font-bold text-red-900">
            Monthly Cash Flow Warning
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-red-800">
            At your current income and expenses, purchasing this home would result
            in a monthly deficit of{' '}
            <span className="font-bold">{formatCurrency(viability.deficit)}</span>.
            Your mortgage and living expenses would exceed your income by this
            amount each month after buying.
          </p>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-red-700">
            To resolve this, consider:
          </p>
          <ul className="mt-1 space-y-1 text-sm text-red-800 list-disc list-inside">
            <li>Increasing your target down payment to reduce the mortgage</li>
            <li>Lowering your target home price</li>
            <li>Reducing other monthly expenses</li>
          </ul>
        </div>
      )}

      {/* ── KPI bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Card 1 — Purchase Day Capital (neutral navy) */}
        <div className="rounded-xl bg-[#1B3A5C] px-5 py-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#D6E8F7]/70">
            Purchase Day Capital
          </p>
          <p className="mt-0.5 text-[10px] text-[#D6E8F7]/50">Due at closing</p>
          <p className="mt-3 text-2xl font-bold text-white">
            {formatCurrency(purchaseDayCapital)}
          </p>
        </div>

        {/* Card 2 — Full Readiness Capital (status-tinted) */}
        <div
          className={`rounded-xl px-5 py-4 shadow-sm ${STATUS_BG[readinessStatus]}`}
        >
          {/* Label row with tooltip trigger */}
          <div className="flex items-center gap-1.5">
            <p
              className={`text-[10px] font-bold uppercase tracking-widest ${STATUS_LABEL_TEXT[readinessStatus]}`}
            >
              Full Readiness Capital
            </p>
            <FullReadinessTooltip />
          </div>

          <p className={`mt-0.5 text-[10px] opacity-60 ${STATUS_TEXT[readinessStatus]}`}>
            Includes 4-month buffer
          </p>

          <p className={`mt-3 text-2xl font-bold ${STATUS_TEXT[readinessStatus]}`}>
            {formatCurrency(fullReadinessCapital)}
          </p>

          {/* Status badge — text label ensures color is never the sole indicator */}
          <p className={`mt-2 text-[10px] font-semibold uppercase tracking-wide ${STATUS_LABEL_TEXT[readinessStatus]}`}>
            {readinessStatus === 'green' ? '✓ On Track'
              : readinessStatus === 'amber' ? '~ Approaching'
              : '✗ Below Target'}
          </p>
        </div>
      </div>

      {/* ── Projection placeholder — future tabs and chart go here ──────── */}
      {viability.isViable && (
        <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-10">
          <p className="text-sm font-medium text-gray-400">
            Projection chart &amp; scorecard coming soon
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Full Readiness Capital tooltip ──────────────────────────────────────────

function FullReadinessTooltip() {
  return (
    <span className="group relative inline-flex cursor-help">
      <span
        aria-hidden="true"
        className="
          flex h-3.5 w-3.5 items-center justify-center rounded-full border
          border-current text-[9px] font-bold leading-none
          opacity-60 select-none
        "
      >
        i
      </span>
      <span
        role="tooltip"
        className="
          pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56
          -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-xs
          leading-snug text-white shadow-lg
          opacity-0 transition-opacity duration-150 group-hover:opacity-100
        "
      >
        Purchase Day Capital plus post-close reserve plus 4 months of
        post-purchase living expenses. This is what the app plans toward.
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
