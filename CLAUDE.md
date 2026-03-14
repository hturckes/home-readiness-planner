# Home Readiness Planner — Claude Code Project Context

## What We're Building

A home buying readiness planning application that helps prospective homebuyers assess their financial readiness to purchase a home within a 1–5 year horizon. Users input their current financial position, adjust assumptions, and get real-time projections of their savings trajectory, investment allocation, and overall readiness.

**Full product requirements are in @PRD.md — always read that file for complete feature specifications before implementing any feature.**

---

## Tech Stack

- **Framework:** Next.js with TypeScript (App Router)
- **Styling:** Tailwind CSS — utility classes only, no custom CSS files
- **Charts:** Recharts with ResponsiveContainer on all charts
- **State:** Zustand with localStorage persistence middleware
- **No backend** — this is a fully client-side app in v1

---

## Project Structure

```
home-readiness-planner/
├── app/
│   └── page.tsx              # Root layout — InputPanel + Dashboard side by side
├── lib/
│   ├── types.ts              # All TypeScript interfaces and types
│   ├── store.ts              # Zustand store — single source of truth
│   ├── calculations.ts       # All math logic — pure functions only, no React
│   └── utils.ts              # Helpers including safeNumber()
├── components/
│   ├── InputPanel.tsx        # Left sidebar with all user inputs
│   ├── Dashboard.tsx         # Right content area with tabs
│   ├── ProjectionChart.tsx   # Recharts projection line chart
│   ├── GlidePathChart.tsx    # Recharts stacked area allocation chart
│   ├── ReadinessScorecard.tsx # 5-dimension readiness scoring
│   ├── ScenarioComparison.tsx # Side-by-side scenario table
│   ├── SensitivityPanel.tsx  # Lever impact analysis
│   ├── MortgageContext.tsx   # PITI estimator and DTI indicator
│   └── ui/
│       ├── CurrencyInput.tsx # $ prefix, comma formatting, min/max
│       └── PercentInput.tsx  # % suffix, 0–100 range
└── PRD.md                    # Full product requirements (this project)
```

---

## Core Architecture Rules

These rules must be followed throughout the entire codebase:

### State Management
- **All application state lives in the Zustand store in `lib/store.ts`** — components never manage their own local copy of app-level state
- Components use `useStore()` to read state and call store actions to update it
- The store persists to localStorage automatically via Zustand's persist middleware
- Local UI state (e.g., which tab is open, whether a section is collapsed) is fine to keep in component-level `useState`

### Calculations
- **All financial math lives in `lib/calculations.ts` as pure functions** — no React imports, no side effects
- Components call these functions with state from the store — they never compute financial values inline
- Every calculation function must have a JSDoc comment explaining its inputs, outputs, and the formula used
- Functions must be unit-testable in isolation

### Display Safety
- **Never render NaN, undefined, null, or Infinity in the UI**
- Always wrap number outputs in `safeNumber(value, fallback)` from `lib/utils.ts`
- Default fallback for currency display is `"—"`

### Real-Time Updates
- **No submit buttons for recalculation** — all outputs update immediately as inputs change
- Debounce free-text number inputs by 300ms to avoid excessive recalculation while typing
- Sliders and toggles trigger immediate recalculation with no debounce

### Styling
- Tailwind utility classes only — no inline styles, no external CSS files
- Color palette: Navy `#1B3A5C`, Blue `#2E6DA4`, Light Blue `#D6E8F7`
- Status colors: Green `green-700/green-100`, Amber `amber-700/amber-100`, Red `red-700/red-100`
- **Color is never the sole status indicator** — always pair with a text label or icon (accessibility requirement)

---

## Key Financial Logic

### Total Capital Needed
```
Total = (Home Price × home price appreciation ^ years) × (down payment % + closing cost % + reserve %)
```
The target itself grows over time as home prices appreciate — this is intentional and should be shown visually.

### Accessible Capital
```
Cash/HYSA: full balance
Taxable Brokerage: balance - (gain × capital gains tax rate)
  where gain = balance - cost basis
Roth IRA: contributions portion only (user-inputted)
401k/Traditional IRA: excluded by default
```

### Glide Path (Auto Mode)
| Months to Target | Equity % |
|---|---|
| 36+ | 65% |
| 24–36 | 50% |
| 12–24 | 30% |
| 6–12 | 15% |
| 0–6 | 5% |

### Blended Expected Return
```
return = (equity% × aggressiveReturn) + (safeAsset% × conservativeReturn)
```

### Monthly Projection
Each month: `balance = (balance + monthlySavings) × (1 + monthlyReturn)`
where `monthlyReturn = annualReturn / 12`

---

## Readiness Score Thresholds

| Dimension | Green | Amber | Red |
|---|---|---|---|
| Capital Trajectory | On track or ahead | Within 6 months of target date | More than 6 months behind |
| Savings Rate | >80% of required monthly savings | 60–80% | <60% |
| Risk Alignment | Matches glide path tier | 1 tier off | 2+ tiers off |
| Affordability (front-end DTI) | <28% | 28–35% | >35% |
| Reserve Cushion | >3 months expenses | 1–3 months | <1 month |

---

## Default Assumption Values

```typescript
hysaYield: 0.045          // 4.5%
conservativeReturn: 0.040  // 4.0%
moderateReturn: 0.065      // 6.5%
aggressiveReturn: 0.090    // 9.0%
capitalGainsTaxRate: 0.15  // 15%
inflationRate: 0.030       // 3.0%
homePriceAppreciation: 0.035 // 3.5%
targetHomePrice: 500000
downPaymentPct: 0.20
closingCostPct: 0.03
postCloseReservePct: 0.02
targetMonthsFromNow: 36
annualIncomeGrowthRate: 0.03
mortgageRate: 0.068        // update to current market rate
loanTermYears: 30
propertyTaxRate: 0.011
annualInsurance: 2400
pmiRate: 0.008
```

---

## What Is Out of Scope (Do Not Build)

- User authentication or backend database
- Live market data feeds — all rates are manual inputs
- Monte Carlo simulation (architecture should support it later, but no UI)
- PDF export
- Mobile native app
- Multi-property comparison

---

## Example Test Case

Use this to verify calculations are working correctly:

- Target home price: $600,000
- Down payment: 20%, Closing costs: 3%, Post-close reserve: 2%
- Target date: 24 months from now
- Current accessible capital: $80,000
- Monthly home savings: $3,000/month
- Home price appreciation: 3.5%

**Expected results:**
- Total capital needed at month 24: ~$155,700 (after appreciation)
- Month 24 projected balance: ~$152,000 (assuming ~5% blended return with glide path)
- Readiness status: Amber (slightly behind)
