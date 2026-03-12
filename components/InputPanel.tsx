'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { calculateTotalCapitalNeeded } from '@/lib/calculations';
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
    currentAssets:   <Placeholder />,
    cashFlow:        <Placeholder />,
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
  const { purchaseTarget, assumptions, setPurchaseTarget } = useStore();

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

  const totalCapitalNeeded = calculateTotalCapitalNeeded(purchaseTarget, assumptions);

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
        tooltip="Cash you want to keep liquid after closing for immediate repairs, moving costs, and emergencies."
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

      {/* Total Capital Needed summary */}
      <div className="rounded-lg bg-[#1B3A5C] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D6E8F7]/80">
          Total Capital Needed
        </p>
        <p className="mt-1 text-xl font-bold text-white">
          {formatCurrency(totalCapitalNeeded)}
        </p>
      </div>
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
