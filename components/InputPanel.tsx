'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  calculatePurchaseDayCapital,
  calculateFullReadinessCapital,
  calculateMortgagePayment,
  calculateAccessibleCapital,
} from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import CurrencyInput from '@/components/ui/CurrencyInput';
import PercentInput from '@/components/ui/PercentInput';

// ─── Section definitions ──────────────────────────────────────────────────────

type SectionKey =
  | 'purchaseTarget'
  | 'currentAssets'
  | 'cashFlow'
  | 'assumptions'
  | 'mortgageContext';

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'purchaseTarget',  title: 'Purchase Target'        },
  { key: 'currentAssets',   title: 'Current Assets'         },
  { key: 'cashFlow',        title: 'Monthly Cash Flow'      },
  { key: 'assumptions',     title: 'Investment Assumptions' },
  { key: 'mortgageContext', title: 'Mortgage Context'       },
];

// ─── Root component ───────────────────────────────────────────────────────────

export default function InputPanel() {
  const { scenarioName } = useStore();

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    purchaseTarget:  true,
    currentAssets:   true,
    cashFlow:        true,
    assumptions:     true,
    mortgageContext: true,
  });

  const toggle = (key: SectionKey) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // Map each key to its content — replace placeholder as each section is built
  const content: Record<SectionKey, React.ReactNode> = {
    purchaseTarget:  <PurchaseTargetSection />,
    currentAssets:   <CurrentAssetsSection />,
    cashFlow:        <CashFlowSection />,
    assumptions:     <Placeholder />,
    mortgageContext: <Placeholder />,
  };

  return (
    <aside
      aria-label="Input panel"
      className="
        flex h-screen w-[360px] shrink-0 flex-col overflow-y-auto
        border-r border-gray-200 bg-white
      "
    >
      {/* Panel header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Scenario
        </p>
        <h2 className="text-sm font-bold text-[#1B3A5C]">{scenarioName}</h2>
      </div>

      {/* Collapsible sections */}
      <div className="flex flex-col py-2">
        {SECTIONS.map(({ key, title }) => (
          <Section
            key={key}
            title={title}
            isOpen={open[key]}
            onToggle={() => toggle(key)}
          >
            {content[key]}
          </Section>
        ))}
      </div>
    </aside>
  );
}

// ─── Purchase Target section ──────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function PurchaseTargetSection() {
  const state = useStore();
  const { purchaseTarget, cashFlow, assumptions, setPurchaseTarget } = state;

  // Derive the currently-selected month and year from targetMonthsFromNow
  const derivedDate = new Date();
  derivedDate.setDate(1);
  derivedDate.setMonth(derivedDate.getMonth() + purchaseTarget.targetMonthsFromNow);
  const selectedMonth = derivedDate.getMonth() + 1; // 1-indexed
  const selectedYear  = derivedDate.getFullYear();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear + i);

  /** Converts a month (1-12) + year to monthsFromNow, clamped to 6–60. */
  const toMonthsFromNow = (month: number, year: number): number => {
    const now = new Date();
    now.setDate(1);
    const target = new Date(year, month - 1, 1);
    const raw = (target.getFullYear() - now.getFullYear()) * 12
              + (target.getMonth() - now.getMonth());
    return Math.max(6, Math.min(60, raw));
  };

  const handleMonthChange = (month: number) => {
    setPurchaseTarget({ targetMonthsFromNow: toMonthsFromNow(month, selectedYear) });
  };

  const handleYearChange = (year: number) => {
    setPurchaseTarget({ targetMonthsFromNow: toMonthsFromNow(selectedMonth, year) });
  };

  // Summary values — recomputed on every input change (no debounce needed)
  const purchaseDayCapital    = calculatePurchaseDayCapital(purchaseTarget, assumptions);
  const fullReadinessCapital  = calculateFullReadinessCapital(
    purchaseTarget,
    cashFlow,
    calculateMortgagePayment(state),
    assumptions
  );

  return (
    <div className="flex flex-col gap-4">
      <CurrencyInput
        label="Target Home Price"
        value={purchaseTarget.targetHomePrice}
        onChange={(v) => setPurchaseTarget({ targetHomePrice: v })}
        min={100_000}
        max={3_000_000}
        tooltip="The price you expect to pay for the home. This grows over time based on your Home Price Appreciation assumption."
      />

      <PercentInput
        label="Down Payment"
        value={purchaseTarget.downPaymentPct}
        onChange={(v) => setPurchaseTarget({ downPaymentPct: v })}
        min={0.03}
        max={0.40}
        tooltip="Percentage of home price paid upfront. 20% avoids PMI."
      />

      <PercentInput
        label="Closing Costs"
        value={purchaseTarget.closingCostPct}
        onChange={(v) => setPurchaseTarget({ closingCostPct: v })}
        min={0.01}
        max={0.06}
        tooltip="Typically 2–4% of purchase price. Covers lender fees, title insurance, escrow, and other transaction costs."
      />

      <PercentInput
        label="Post-Close Reserve"
        value={purchaseTarget.postCloseReservePct}
        onChange={(v) => setPurchaseTarget({ postCloseReservePct: v })}
        min={0}
        max={0.05}
        tooltip="Cash you want to keep liquid after closing. Held in savings for immediate repairs, surprises, or emergencies. This stays in your account — it is not spent at closing."
      />

      <CurrencyInput
        label="Move-In Costs"
        value={purchaseTarget.moveInCosts}
        onChange={(v) => setPurchaseTarget({ moveInCosts: v })}
        min={0}
        max={100_000}
        tooltip="One-time costs at move-in: furniture, moving company, appliances, immediate repairs. Spent on or around closing day. If unsure, $10,000 is a reasonable starting estimate."
      />

      {/* Target Purchase Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-[#1B3A5C]">
          Target Purchase Date
        </label>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            aria-label="Purchase month"
            className="
              flex-1 rounded-md border border-gray-300 bg-white
              px-2 py-2 text-sm text-gray-900
              hover:border-[#2E6DA4]
              focus:border-[#2E6DA4] focus:outline-none focus:ring-2 focus:ring-[#D6E8F7]
              transition-colors duration-150
            "
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            aria-label="Purchase year"
            className="
              flex-1 rounded-md border border-gray-300 bg-white
              px-2 py-2 text-sm text-gray-900
              hover:border-[#2E6DA4]
              focus:border-[#2E6DA4] focus:outline-none focus:ring-2 focus:ring-[#D6E8F7]
              transition-colors duration-150
            "
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Summary boxes ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">

        {/* Box 1 — Purchase Day Capital (lighter style) */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              Purchase Day Capital
            </p>
            <SummaryTooltip
              text="Down payment + closing costs + move-in costs. The cash that leaves your account on closing day."
            />
          </div>
          <p className="mt-1 text-xl font-bold text-[#1B3A5C]">
            {formatCurrency(purchaseDayCapital)}
          </p>
          <p className="mt-0.5 text-[9px] text-gray-400">Due at or before closing</p>
        </div>

        {/* Box 2 — Full Readiness Capital (primary navy style) */}
        <div className="rounded-lg bg-[#1B3A5C] px-4 py-3">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D6E8F7]/80">
              Full Readiness Capital
            </p>
            <SummaryTooltip
              text="Everything due at closing, plus your post-close reserve, plus 4 months of post-purchase living expenses as a transition buffer. This is what the app plans toward."
              dark
            />
          </div>
          <p className="mt-1 text-xl font-bold text-white">
            {formatCurrency(fullReadinessCapital)}
          </p>
          <p className="mt-0.5 text-[9px] text-[#D6E8F7]/50">
            Your savings target — includes 4-month buffer
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Summary box tooltip ──────────────────────────────────────────────────────
// Reusable ℹ tooltip for the summary boxes at the bottom of each section.
// Uses the same CSS group/group-hover pattern as CurrencyInput's TooltipIcon.

function SummaryTooltip({ text, dark = false }: { text: string; dark?: boolean }) {
  const badgeClasses = dark
    ? 'border-[#D6E8F7]/60 text-[#D6E8F7]/60'
    : 'border-gray-400 text-gray-400';

  return (
    <span className="group relative inline-flex cursor-help">
      <span
        aria-hidden="true"
        className={`
          flex h-3.5 w-3.5 items-center justify-center rounded-full border
          text-[9px] font-bold leading-none select-none
          ${badgeClasses}
        `}
      >
        i
      </span>
      <span
        role="tooltip"
        className="
          pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52
          -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-2 text-xs
          leading-snug text-white shadow-lg
          opacity-0 transition-opacity duration-150 group-hover:opacity-100
        "
      >
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

// ─── Current Assets section ───────────────────────────────────────────────────

/** Balance input tooltip text keyed by bucket id. */
const BUCKET_TOOLTIPS: Record<string, string> = {
  'cash-hysa':
    'Cash in checking, savings, or high-yield savings accounts. Fully accessible with no penalties or taxes.',
  'taxable-brokerage':
    'Stocks, ETFs, or mutual funds in a standard brokerage account. Capital gains tax applies on appreciation when sold.',
  'roth-ira':
    'Enter your contributions portion only — not the full account value. Roth IRA contributions can be withdrawn penalty-free at any time.',
  'traditional-ira-401k':
    'Pre-tax retirement savings. Early withdrawal before age 59½ incurs a 10% penalty plus ordinary income tax.',
  'other':
    'Other assets such as real estate equity or business value. Typically illiquid — cannot be quickly converted to cash for a purchase.',
};

function CurrentAssetsSection() {
  const { assetBuckets, assumptions } = useStore();

  const accessibleCapital = calculateAccessibleCapital(
    assetBuckets,
    assumptions.capitalGainsTaxRate
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Bucket rows — separated by hairline dividers */}
      {assetBuckets.map((bucket, idx) => (
        <div
          key={bucket.id}
          className={idx > 0 ? 'border-t border-gray-100 pt-4 mt-4' : ''}
        >
          <AssetBucketRow bucket={bucket} />
        </div>
      ))}

      {/* Accessible Capital summary */}
      <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          Accessible Capital (est. after tax)
        </p>
        <p className="mt-1 text-xl font-bold text-[#1B3A5C]">
          {formatCurrency(accessibleCapital)}
        </p>
      </div>
    </div>
  );
}

// ─── Asset Bucket Row ─────────────────────────────────────────────────────────

interface AssetBucketRowProps {
  bucket: {
    id: string;
    label: string;
    balance: number;
    costBasis: number;
    isAvailableForPurchase: boolean;
    isIlliquid: boolean;
  };
}

function AssetBucketRow({ bucket }: AssetBucketRowProps) {
  const { updateAssetBucket } = useStore();

  const isIraOrK = bucket.id === 'traditional-ira-401k';
  const isBrokerage = bucket.id === 'taxable-brokerage';

  return (
    <div className="flex flex-col gap-3">
      {/* Heading row: label + optional warning icon */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-[#1B3A5C]">{bucket.label}</span>
        {isIraOrK && (
          <WarningTooltip text="Early withdrawal penalties apply." />
        )}
      </div>

      {/* Balance input */}
      <CurrencyInput
        label="Balance"
        value={bucket.balance}
        onChange={(v) => updateAssetBucket(bucket.id, { balance: v })}
        min={0}
        max={10_000_000}
        tooltip={BUCKET_TOOLTIPS[bucket.id] ?? 'Current account balance.'}
      />

      {/* Cost basis — taxable brokerage only */}
      {isBrokerage && (
        <div className="pl-0">
          <CurrencyInput
            label="Cost Basis"
            value={bucket.costBasis}
            onChange={(v) => updateAssetBucket(bucket.id, { costBasis: v })}
            min={0}
            max={10_000_000}
            tooltip="Your original purchase price. Used to estimate taxes owed when liquidating. If unsure, use 70% of current balance as an estimate."
          />
        </div>
      )}

      {/* Use-for-purchase toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">Use for home purchase?</span>
        <ToggleSwitch
          checked={bucket.isAvailableForPurchase}
          onChange={(checked) =>
            updateAssetBucket(bucket.id, { isAvailableForPurchase: checked })
          }
          label={`Toggle ${bucket.label} for home purchase`}
        />
      </div>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
// Pure Tailwind implementation — no external library.
// Follows WCAG: role="switch", aria-checked, visible focus ring.

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string; // screen-reader label (aria-label)
}

function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center
        rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6DA4] focus-visible:ring-offset-1
        ${checked ? 'bg-[#2E6DA4]' : 'bg-gray-300'}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-4 w-4 transform rounded-full
          bg-white shadow-sm
          transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ─── Warning tooltip ──────────────────────────────────────────────────────────
// Amber exclamation badge with hover tooltip — used on the IRA/401k bucket.
// Color is paired with the "!" text label so it is never the sole indicator.

function WarningTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help">
      {/* Badge: amber border + "!" — both color and symbol convey the warning */}
      <span
        aria-hidden="true"
        className="
          flex h-3.5 w-3.5 items-center justify-center rounded-full border
          border-amber-500 text-[9px] font-bold leading-none text-amber-600
          select-none
        "
      >
        !
      </span>
      <span
        role="tooltip"
        className="
          pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48
          -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-2 text-xs
          leading-snug text-white shadow-lg
          opacity-0 transition-opacity duration-150 group-hover:opacity-100
        "
      >
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}

// ─── Monthly Cash Flow section ────────────────────────────────────────────────

function CashFlowSection() {
  const { cashFlow, setCashFlow } = useStore();

  return (
    <div className="flex flex-col gap-4">
      <CurrencyInput
        label="Gross Annual Income"
        value={cashFlow.grossIncome}
        onChange={(v) => setCashFlow({ grossIncome: v })}
        min={0}
        max={1_000_000}
        tooltip="Your total pre-tax annual income. Used to calculate your debt-to-income ratio and post-purchase viability."
      />

      <CurrencyInput
        label="Monthly Home Savings"
        value={cashFlow.monthlyHomeSavings}
        onChange={(v) => setCashFlow({ monthlyHomeSavings: v })}
        min={0}
        max={50_000}
        tooltip="Amount you set aside each month specifically for your home purchase. This is what drives the projection."
      />

      <CurrencyInput
        label="Current Monthly Rent"
        value={cashFlow.currentMonthlyRent}
        onChange={(v) => setCashFlow({ currentMonthlyRent: v })}
        min={0}
        max={10_000}
        tooltip="Your current rent payment. This expense disappears after buying, which improves your post-purchase cash flow."
      />

      <CurrencyInput
        label="Other Monthly Expenses"
        value={cashFlow.otherMonthlyExpenses}
        onChange={(v) => setCashFlow({ otherMonthlyExpenses: v })}
        min={0}
        max={20_000}
        tooltip="All non-housing recurring expenses: groceries, utilities, car, subscriptions, dining. Used to calculate whether you can sustain the mortgage comfortably."
      />
    </div>
  );
}

// ─── Placeholder (other sections, not yet built) ──────────────────────────────

function Placeholder() {
  return <p className="text-xs italic text-gray-400">Coming soon</p>;
}

// ─── Collapsible section shell ────────────────────────────────────────────────

interface SectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, isOpen, onToggle, children }: SectionProps) {
  return (
    <div className="mx-3 my-1 overflow-hidden rounded-sm border-l-[3px] border-[#2E6DA4]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="
          flex w-full items-center gap-2 px-3 py-2.5
          bg-[#D6E8F7]/30 hover:bg-[#D6E8F7]/60
          transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6DA4]
        "
      >
        <ChevronIcon
          className={`
            h-3.5 w-3.5 shrink-0 text-[#2E6DA4]
            transition-transform duration-200 ease-in-out
            ${isOpen ? 'rotate-180' : 'rotate-0'}
          `}
        />
        <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider text-[#1B3A5C]">
          {title}
        </span>
      </button>

      <div
        className={`
          overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out
          ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
