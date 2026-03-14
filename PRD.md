# Home Buying Readiness Planner — Product Requirements Document

**Version:** 1.0  
**Author:** Harrison  
**Target Platform:** Web (React / Next.js)  
**Status:** Draft — Ready for Review  
**Last Updated:** March 2026

---

## 1. Product Overview

### 1.1 Purpose

The Home Buying Readiness Planner is an interactive, browser-based financial modeling tool that helps prospective homebuyers assess their readiness to purchase a home within a target horizon of 1 to 5 years. The application enables users to input their current financial position, adjust key assumptions, and receive real-time projections of their savings trajectory, investment allocation, and overall readiness across multiple scenarios.

The tool is designed to be self-service and exploratory — users should be able to pull on different levers (savings rate, investment risk, target price, timeline) and immediately see the downstream impact on their readiness date and capital position.

### 1.2 Core Value Proposition

- Translates complex financial planning logic into an intuitive, interactive experience
- Surfaces the trade-offs between saving more, investing more aggressively, or adjusting the target
- Applies a risk glide path automatically as the target date approaches, with user override capability
- Helps users distinguish between "home purchase" capital and "long-term wealth" capital, avoiding common allocation mistakes

### 1.3 Target User

**Primary:** Individuals or couples in the early-to-mid stages of homebuying planning, 1–5 years from a target purchase, with some investable assets and regular income.

**Secondary:** Financial planners or advisors using the tool in client-facing consultations.

### 1.4 Key Principles

1. Work backwards from a defined purchase target, not forward from current assets
2. Separate short-horizon home purchase capital from long-horizon retirement capital
3. De-risk home purchase capital via an explicit glide path as the target date approaches
4. All assumptions are visible, editable, and reset-able to defaults
5. Projections update in real time as inputs change — no "submit" or "calculate" button

---

## 2. Functional Requirements

### 2.1 User Input: Purchase Target

The user must define a purchase target that anchors all downstream calculations. These inputs should be prominently positioned at the top of the interface as the primary configuration.

| Input Field | Description | Default / Range |
|---|---|---|
| Target Home Price | Estimated purchase price of home | $500,000 \| $100K–$3M |
| Down Payment % | % of purchase price as down payment | 20% \| 3%–40% |
| Closing Cost % | Estimated closing costs as % of price | 3% \| 1%–6% |
| Post-Close Reserve | Cash reserve to hold after purchase | 2% of price \| 0%–5% |
| Target Purchase Date | Month and year of intended purchase | 36 months from today \| 6–60 mo. |

> **DERIVED:** Total Capital Needed = Down Payment + Closing Costs + Post-Close Reserve. This is the primary savings target displayed prominently throughout the app.

### 2.2 User Input: Current Financial Position

The user defines their current asset pool by bucket. Each bucket carries a different accessibility and tax treatment, which the model uses to determine what is "in play" for the purchase.

| Asset Bucket | Current Balance | Available for Purchase? | Notes |
|---|---|---|---|
| Cash / HYSA | User input | Yes — 100% | No tax impact |
| Taxable Brokerage | User input | Yes — net of cap gains tax | Est. tax applied on gains |
| Roth IRA (contributions) | User input | Optional — contributions only | Penalty-free contributions |
| Traditional IRA / 401(k) | User input | No (excluded by default) | Penalty applies |
| Other / Real Estate | User input | User-defined toggle | Illiquid flag option |

For the taxable brokerage, the user should input both total balance and approximate cost basis (or unrealized gain %), so the model can estimate after-tax liquidation value.

### 2.3 User Input: Monthly Cash Flow

Defines the user's forward-looking capacity to accumulate capital toward the purchase goal.

| Field | Description | Default |
|---|---|---|
| Monthly Gross Income | Combined household gross income | User input |
| Monthly Take-Home Pay | Net after tax and deductions | Auto-estimated or user input |
| Monthly Savings to Home Fund | Amount earmarked for home purchase | User input (slider) |
| Savings Rate to Other Goals | 401(k), Roth IRA, other investing | User input |
| Annual Income Growth Rate | Expected annual % increase in income | 3% \| 0%–10% |
| Annual Savings Rate Increase | Incremental savings growth per year | 0% \| 0%–5% |

### 2.4 Investment Assumptions

These assumptions drive return projections across the investment horizon and can be adjusted by the user. Defaults should reflect current market conventions.

| Assumption | Description | Default |
|---|---|---|
| HYSA / Cash Yield | Annual return on cash / HYSA | 4.5% \| 0%–7% |
| Conservative Portfolio Return | Short-duration bonds, T-bills, etc. | 4.0% \| 0%–7% |
| Moderate Portfolio Return | Balanced equity / bond allocation | 6.5% \| 2%–10% |
| Aggressive Portfolio Return | Primarily equities | 9.0% \| 3%–14% |
| Capital Gains Tax Rate | Long-term cap gains rate on brokerage liquidation | 15% \| 0%–23.8% |
| Inflation Rate | Used for real vs. nominal projections | 3.0% \| 0%–6% |
| Home Price Appreciation | Annual growth in target home price | 3.5% \| 0%–8% |

> **NOTE:** The home price appreciation assumption causes the savings target itself to grow over time, creating a dynamic goal. This should be visually surfaced to the user.

### 2.5 Risk Glide Path

The application shall implement an automated risk glide path that de-risks the home purchase portfolio as the target date approaches. This is one of the most important behavioral nudges in the tool.

| Months to Purchase | Risk Level | Equity Allocation | Safe Asset Allocation |
|---|---|---|---|
| 36+ months | Moderate | 60–70% | 30–40% bonds / cash |
| 24–36 months | Moderate-Conservative | 40–60% | 40–60% bonds / cash |
| 12–24 months | Conservative | 20–40% | 60–80% bonds / HYSA |
| 6–12 months | Very Conservative | 10–20% | 80–90% HYSA / T-bills |
| 0–6 months | Capital Preservation | 0–10% | 90–100% HYSA / money market |

The glide path should be displayed visually as a timeline chart showing the shifting allocation over time. Users should be able to:

- Toggle between "Auto Glide Path" and "Manual Allocation" modes
- In manual mode, set equity allocation at any point and override the automated schedule
- See the return assumption change dynamically as allocation shifts

### 2.6 Output: Readiness Dashboard

The primary output is a real-time dashboard that synthesizes all inputs into a clear readiness assessment.

#### 2.6.1 Primary Readiness Indicators

- **Projected Readiness Date** — the month/year at which the user crosses the capital threshold
- **Capital Gap** — current accessible capital vs. total capital needed
- **Months Ahead / Behind Target** — delta between projected readiness and desired purchase date
- **Monthly Savings Required** — to hit target exactly on the desired date (vs. current savings rate)

#### 2.6.2 Projection Chart

- Line chart showing projected capital accumulation over time
- Horizontal reference line showing the dynamic savings target (grows with home price appreciation)
- Shaded confidence band showing best-case / base-case / worst-case scenarios
- Vertical marker at the user's target purchase date
- Crosshair interaction: hover any point on the timeline to see projected balance

#### 2.6.3 Asset Allocation Visualization

- Stacked area chart or donut chart showing the glide path allocation over time
- Real-time update as risk level or manual overrides change

#### 2.6.4 Readiness Score Card

A summary card that scores the user across 5 readiness dimensions, each rated Green / Amber / Red:

| Dimension | Assessment Logic | Score Threshold |
|---|---|---|
| Capital Trajectory | Is current savings path on track to hit target by desired date? | On track / Within 6 mo. / Off track |
| Savings Rate | Is monthly savings rate sufficient given current assets? | >80% of needed / 60-80% / <60% |
| Risk Alignment | Is allocation appropriate for time horizon per glide path? | Aligned / 1 tier off / Misaligned |
| Affordability | Will projected mortgage payment be within DTI guidelines? | <28% / 28-35% / >35% of gross |
| Reserve Cushion | Will post-close reserves be adequate? | >3 mo. / 1-3 mo. / <1 mo. |

---

## 3. Scenario Analysis & Sensitivity

### 3.1 Scenario Comparison Mode

Users should be able to save up to 3 named scenarios and view them side by side. This allows direct comparison of, for example, "Buy in 2 years at $550K vs. Buy in 3 years at $650K" or "Aggressive investing vs. Conservative with more cash."

- Each scenario stores a full snapshot of all input values and assumptions
- Comparison view shows projected readiness date, capital gap, and monthly savings required for each
- Scenarios are saved in browser session (not persisted to a database in v1)
- User can rename, duplicate, or delete scenarios

### 3.2 Lever Sensitivity Panel

A dedicated section that shows the marginal impact of changing each key variable. This helps users understand which levers matter most for their situation.

| Lever | Variable Range Tested | Output Shown |
|---|---|---|
| Monthly Savings +/- $500 | ±$500 from current value | Change in readiness date |
| Investment Return +/- 2% | ±2% annual return | Change in projected balance |
| Target Price +/- $50K | ±$50K home price | Change in capital needed |
| Down Payment % ±5% | ±5% down payment | Change in upfront cash + monthly payment |
| Timeline ±6 months | ±6 mo. target date | Change in required monthly savings |

### 3.3 Monte Carlo Simulation (Optional — v2)

A toggle to run Monte Carlo simulations on investment returns, producing a probability distribution of readiness outcomes. The output should show the probability of being fully funded by the target date under variable market conditions. This feature is scoped for a future version but the architecture should not preclude it.

---

## 4. Mortgage Affordability Context

### 4.1 Monthly Payment Estimator

Once the purchase target is defined, the application should surface estimated mortgage payment information to contextualize the post-purchase financial picture. This is not a mortgage calculator — it is an affordability context panel.

| Input | Output | Notes |
|---|---|---|
| Current 30-yr fixed rate | Estimated P&I payment | User input; suggest current avg rate |
| Loan term (15 or 30 yr) | Total interest over loan life | Toggle selector |
| Annual property tax rate | Monthly PITI estimate | Default 1.1% \| user adjustable |
| Annual homeowner insurance | % of gross income (DTI check) | Default $2,400/yr \| user adjustable |
| PMI rate (if < 20% down) | Monthly PMI if applicable | Default 0.8% of loan \| auto-applied |

### 4.2 Debt-to-Income (DTI) Indicator

Using the estimated PITI + PMI monthly payment and the user-provided gross income, display a front-end DTI ratio with a visual indicator. Flag if it exceeds standard lending thresholds (28% front-end, 43% back-end with a placeholder for other debt payments).

---

## 5. UX & Interaction Requirements

### 5.1 Layout & Navigation

- Single-page application with a persistent left-side input panel and a main content area for outputs
- Input panel sections should be collapsible/expandable, organized into: Purchase Target, Current Assets, Monthly Cash Flow, Assumptions, Mortgage Context
- Main output area should have tabbed navigation: Readiness Dashboard, Scenario Comparison, Lever Sensitivity, Mortgage Context
- All charts should be responsive and readable on tablet-sized screens at minimum

### 5.2 Real-Time Recalculation

- All outputs must update in real time as the user adjusts any input or assumption — no manual submit button
- Sliders, number inputs, and toggle switches should all trigger immediate recalculation
- Debounce free-text number inputs by ~300ms to avoid excessive recalculation during typing

### 5.3 Input Controls

- Dollar amounts: numeric input with $ prefix, formatted with comma separators, min/max validation
- Percentage fields: numeric input with % suffix, constrained to valid ranges
- Timeline inputs: month/year selector (not a date picker)
- Risk allocation: slider for equity % (0–100), auto-calculating the complement as safe assets
- All inputs should display their default value on first load and show a "Reset to Default" option

### 5.4 Validation & Error States

- Surface inline validation errors immediately (e.g., savings rate that would require negative cash flow)
- If inputs create an impossible scenario (e.g., total capital needed already exceeds accessible assets post-liquidation), surface a clear plain-language warning with a suggested corrective action
- Never show NaN, undefined, or empty states in output fields — fall back to "—" or a descriptive message

### 5.5 Assumptions Transparency Panel

A dedicated section (accessible from any view) that shows every assumption currently being used in the model, its current value, and its default. This panel is critical for user trust — nothing should be a hidden variable.

- Assumptions displayed in a clean two-column table: "Assumption Name" | "Current Value (Default)"
- Each assumption has an edit icon that opens an inline edit control
- A single "Reset All Assumptions to Defaults" button at the bottom of the panel

### 5.6 Tooltips & Explanations

Each input field and output metric should have an accessible tooltip (hover or tap) with a plain-language explanation of what it means and why it matters. Users should never need external documentation to understand the model.

---

## 6. Non-Functional Requirements

### 6.1 Performance

- All recalculations must complete and re-render within 100ms of user input on a modern desktop browser
- Initial page load should be under 3 seconds on a standard broadband connection

### 6.2 Data Persistence

- v1: All state persists in browser localStorage only — no backend, no login required
- State should survive a page refresh within the same browser session
- A "Clear All Data" option should be available in settings
- v2 consideration: optional account-based persistence to sync across devices

### 6.3 Accessibility

- Keyboard navigable — all inputs and interactive elements reachable via tab/enter/arrow keys
- Color should never be the sole indicator of status — pair all color-coded indicators with text labels or icons
- Readiness score card colors should meet WCAG AA contrast standards

### 6.4 Technology Stack

- Frontend: React with Next.js
- Charting: Recharts
- Styling: Tailwind CSS
- State management: Zustand
- No backend required for v1

---

## 7. Out of Scope (v1)

| Feature | Notes |
|---|---|
| User authentication / accounts | v1 is anonymous browser-only; account sync is v2 |
| Monte Carlo simulation | Architecture should support it; UI deferred to v2 |
| Lender integrations or pre-approval | Out of scope; refer user to lender directly |
| Tax filing integration | Tax rates are manual inputs only in v1 |
| Live market data / rate feeds | All rates are manually entered assumptions in v1 |
| Mobile native app | Web responsive is sufficient for v1 |
| Export to PDF | Nice-to-have for v2; consider browser print CSS |
| Multi-property comparison | Single purchase target per session in v1 |

---

## 8. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Should the model account for 401(k) employer match as a cash flow offset (reducing net monthly cost of saving)? | Open |
| 2 | Should the post-close reserve be calculated as % of home value or as a flat dollar amount? Both have merit. | Open |
| 3 | What is the preferred charting library — Recharts vs. Nivo? Are there existing component preferences? | Open |
| 4 | Should the glide path apply only to the designated home fund bucket, or should it also affect guidance on how to invest new monthly contributions? | Open |
| 5 | Is there interest in a "dual-income" mode where household income inputs are split by earner to model more complex scenarios? | Open |
