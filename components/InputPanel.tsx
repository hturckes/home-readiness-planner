'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';

// ─── Section definitions ──────────────────────────────────────────────────────

type SectionKey =
  | 'purchaseTarget'
  | 'currentAssets'
  | 'cashFlow'
  | 'assumptions'
  | 'mortgageContext';

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'purchaseTarget', title: 'Purchase Target' },
  { key: 'currentAssets',  title: 'Current Assets'  },
  { key: 'cashFlow',       title: 'Monthly Cash Flow' },
  { key: 'assumptions',    title: 'Investment Assumptions' },
  { key: 'mortgageContext', title: 'Mortgage Context' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function InputPanel() {
  // Store is imported here to enforce single-source-of-truth.
  // Individual sections will destructure the values they need as they are built.
  const { scenarioName } = useStore();

  // All sections open by default
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    purchaseTarget:  true,
    currentAssets:   true,
    cashFlow:        true,
    assumptions:     true,
    mortgageContext: true,
  });

  const toggle = (key: SectionKey) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

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
      <div className="flex flex-col gap-0 py-2">
        {SECTIONS.map(({ key, title }) => (
          <Section
            key={key}
            title={title}
            isOpen={open[key]}
            onToggle={() => toggle(key)}
          >
            {/* Placeholder — each section body will be replaced in future prompts */}
            <p className="text-xs text-gray-400 italic">Coming soon</p>
          </Section>
        ))}
      </div>
    </aside>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, isOpen, onToggle, children }: SectionProps) {
  return (
    <div className="border-l-[3px] border-[#2E6DA4] mx-3 my-1 rounded-sm overflow-hidden">
      {/* Header button */}
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
        {/* Chevron — rotates to point up when section is open */}
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

      {/* Body — CSS max-height collapse/expand */}
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
      {/* Down chevron: rotates to up when section is open */}
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
