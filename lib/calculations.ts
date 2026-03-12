/**
 * lib/calculations.ts
 *
 * All financial math for the Home Readiness Planner.
 * Pure functions only — zero React imports, zero side effects.
 * Every function is unit-testable in isolation.
 */

import {
  AppState,
  AssetBucket,
  GlidePathSettings,
  InvestmentAssumptions,
  ProjectionPoint,
  PurchaseTarget,
  ReadinessDimension,
  ReadinessScore,
} from '@/lib/types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Equity % values for each auto glide-path tier (index 0 = longest horizon). */
const GLIDE_TIER_VALUES = [0.65, 0.50, 0.30, 0.15, 0.05] as const;

/**
 * Maps any equityPct to the index of the nearest GLIDE_TIER_VALUES entry.
 * Used to quantify how many tiers apart two allocations are.
 */
function getNearestTierIndex(equityPct: number): number {
  return GLIDE_TIER_VALUES.reduce<number>((nearest, tier, idx) => {
    const currentDist = Math.abs(equityPct - GLIDE_TIER_VALUES[nearest]);
    const candidateDist = Math.abs(equityPct - tier);
    return candidateDist < currentDist ? idx : nearest;
  }, 0);
}

/** Clamps a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Function 1: calculateTotalCapitalNeeded ─────────────────────────────────

/**
 * Returns the total capital needed to purchase the home at a given point
 * in time, after home-price appreciation is applied.
 *
 * Formula:
 *   adjustedPrice = targetHomePrice × (1 + homePriceAppreciation / 12) ^ months
 *   total = adjustedPrice × (downPaymentPct + closingCostPct + postCloseReservePct)
 *
 * Monthly compounding is used so that shorter and longer horizons are treated
 * consistently even when the function is called mid-projection.
 *
 * @param purchaseTarget  The user's purchase target configuration.
 * @param assumptions     Investment and market assumptions (provides homePriceAppreciation).
 * @param atMonthsFromNow Months from today to evaluate at. Defaults to
 *                        purchaseTarget.targetMonthsFromNow when omitted.
 * @returns Total dollar amount of capital needed.
 */
export function calculateTotalCapitalNeeded(
  purchaseTarget: PurchaseTarget,
  assumptions: InvestmentAssumptions,
  atMonthsFromNow?: number
): number {
  const months =
    atMonthsFromNow !== undefined
      ? atMonthsFromNow
      : purchaseTarget.targetMonthsFromNow;

  const monthlyAppreciationRate = assumptions.homePriceAppreciation / 12;
  const adjustedPrice =
    purchaseTarget.targetHomePrice * Math.pow(1 + monthlyAppreciationRate, months);

  const totalPct =
    purchaseTarget.downPaymentPct +
    purchaseTarget.closingCostPct +
    purchaseTarget.postCloseReservePct;

  return adjustedPrice * totalPct;
}

// ─── Function 2: calculateAccessibleCapital ──────────────────────────────────

/**
 * Returns the total accessible capital from all eligible asset buckets,
 * applying capital-gains tax to the taxable brokerage account.
 *
 * Rules per bucket:
 *   - Only buckets with isAvailableForPurchase === true are included.
 *   - Taxable brokerage (id === 'taxable-brokerage'):
 *       gain = max(0, balance - costBasis)
 *       afterTaxValue = balance - (gain × capitalGainsTaxRate)
 *   - All other eligible buckets: full balance is used.
 *
 * @param assetBuckets        Array of user-configured asset buckets.
 * @param capitalGainsTaxRate Long-term capital gains rate as a decimal (e.g. 0.15).
 * @returns Total accessible capital in dollars.
 */
export function calculateAccessibleCapital(
  assetBuckets: AssetBucket[],
  capitalGainsTaxRate: number
): number {
  return assetBuckets.reduce((total, bucket) => {
    if (!bucket.isAvailableForPurchase) return total;

    if (bucket.id === 'taxable-brokerage') {
      const gain = Math.max(0, bucket.balance - bucket.costBasis);
      const afterTaxValue = bucket.balance - gain * capitalGainsTaxRate;
      return total + afterTaxValue;
    }

    return total + bucket.balance;
  }, 0);
}

// ─── Function 3: getGlidePathEquityPct ───────────────────────────────────────

/**
 * Returns the appropriate equity allocation percentage for a given
 * number of months remaining until the purchase target.
 *
 * In auto mode the allocation de-risks as the target approaches:
 *   36+ months  → 0.65  (moderate growth)
 *   24–36 months → 0.50  (moderate-conservative)
 *   12–24 months → 0.30  (conservative)
 *    6–12 months → 0.15  (very conservative)
 *     0–6 months → 0.05  (capital preservation)
 *
 * Negative monthsToTarget (past the target date) uses the 0–6 tier (0.05).
 *
 * In manual mode, settings.manualEquityPct is returned directly without
 * any range-based adjustment.
 *
 * @param monthsToTarget Months remaining until the purchase date. May be negative.
 * @param settings       Current glide-path mode and manual override value.
 * @returns Equity fraction as a decimal (0–1).
 */
export function getGlidePathEquityPct(
  monthsToTarget: number,
  settings: GlidePathSettings
): number {
  if (settings.mode === 'manual') {
    return clamp(settings.manualEquityPct, 0, 1);
  }

  // Auto mode — exact thresholds from CLAUDE.md
  if (monthsToTarget >= 36) return 0.65;
  if (monthsToTarget >= 24) return 0.50;
  if (monthsToTarget >= 12) return 0.30;
  if (monthsToTarget >= 6)  return 0.15;
  return 0.05;
}

// ─── Function 4: getExpectedAnnualReturn ─────────────────────────────────────

/**
 * Calculates the blended expected annual return for a given equity allocation.
 *
 * Formula (from CLAUDE.md):
 *   return = (equityPct × aggressiveReturn) + ((1 − equityPct) × conservativeReturn)
 *
 * Note: moderateReturn is NOT used in this blend — only the two extremes are
 * blended to produce a smooth interpolation across the equity spectrum.
 *
 * @param equityPct   Fraction allocated to equities (0–1).
 * @param assumptions Investment assumption set (provides aggressiveReturn and
 *                    conservativeReturn).
 * @returns Expected annual return as a decimal (e.g. 0.072 for 7.2%).
 */
export function getExpectedAnnualReturn(
  equityPct: number,
  assumptions: InvestmentAssumptions
): number {
  const safeEquityPct = clamp(equityPct, 0, 1);
  return (
    safeEquityPct * assumptions.aggressiveReturn +
    (1 - safeEquityPct) * assumptions.conservativeReturn
  );
}

// ─── Function 5: generateProjection ──────────────────────────────────────────

/**
 * Generates a month-by-month projection of capital accumulation from today
 * (month 0) through targetMonthsFromNow + 6.
 *
 * Each step applies the CLAUDE.md accumulation formula:
 *   balance = (previousBalance + monthlyHomeSavings) × (1 + monthlyReturn)
 * where monthlyReturn = annualReturn / 12.
 *
 * Month 0 is the current state — the formula is applied starting at month 1.
 * The savingsTarget is constant across all points (capital needed at
 * targetMonthsFromNow after home-price appreciation) so it serves as a flat
 * goal-line in the projection chart.
 *
 * @param state Full application state (source of truth for all inputs).
 * @returns Array of ProjectionPoint objects ordered by month.
 */
export function generateProjection(state: AppState): ProjectionPoint[] {
  const { purchaseTarget, assetBuckets, cashFlow, assumptions, glidePathSettings } = state;
  const { targetMonthsFromNow } = purchaseTarget;
  const { monthlyHomeSavings } = cashFlow;

  const totalMonths = targetMonthsFromNow + 6;

  // Starting balance: accessible capital today
  const initialBalance = calculateAccessibleCapital(
    assetBuckets,
    assumptions.capitalGainsTaxRate
  );

  // The goal line: capital required at the target date (fixed for the chart)
  const savingsTarget = calculateTotalCapitalNeeded(
    purchaseTarget,
    assumptions,
    targetMonthsFromNow
  );

  const points: ProjectionPoint[] = [];
  let balance = initialBalance;

  for (let month = 0; month <= totalMonths; month++) {
    const monthsToTarget = targetMonthsFromNow - month;
    const equityPct = getGlidePathEquityPct(monthsToTarget, glidePathSettings);
    const expectedReturn = getExpectedAnnualReturn(equityPct, assumptions);
    const monthlyReturn = expectedReturn / 12;

    if (month > 0) {
      // Apply the CLAUDE.md formula: add savings first, then apply return
      balance = (balance + monthlyHomeSavings) * (1 + monthlyReturn);
    }

    points.push({
      month,
      projectedBalance: balance,
      savingsTarget,
      equityPct,
      expectedReturn,
    });
  }

  return points;
}

// ─── Function 6: findReadinessDate ───────────────────────────────────────────

/**
 * Finds the first month in the projection where the projected balance meets
 * or exceeds the savings target.
 *
 * The savings target is read from each point's own savingsTarget field
 * (which is constant across all points — see generateProjection).
 *
 * @param projection    Array of ProjectionPoints from generateProjection().
 * @param purchaseTarget  Purchase target configuration (currently unused —
 *                        included for future use with dynamic targets).
 * @param assumptions   Investment assumptions (currently unused — included for
 *                      future use with dynamic targets).
 * @returns The month number when the target is first reached, or null if
 *          the target is never reached within the projection window.
 */
export function findReadinessDate(
  projection: ProjectionPoint[],
  purchaseTarget: PurchaseTarget,       // eslint-disable-line @typescript-eslint/no-unused-vars
  assumptions: InvestmentAssumptions    // eslint-disable-line @typescript-eslint/no-unused-vars
): number | null {
  for (const point of projection) {
    if (point.projectedBalance >= point.savingsTarget) {
      return point.month;
    }
  }
  return null;
}

// ─── Function 8: calculateMortgagePayment ────────────────────────────────────
// (Defined before calculateReadinessScore because it is called from there.)

/**
 * Estimates the total monthly mortgage payment (PITI + PMI) at the projected
 * purchase date after home-price appreciation.
 *
 * Components:
 *   Principal & Interest — standard amortization formula:
 *     P&I = L × (r × (1+r)^n) / ((1+r)^n − 1)
 *     where L = loan amount, r = monthly rate, n = total payments
 *     Special case: if interestRate === 0, P&I = L / n
 *   PMI — applied only when downPaymentPct < 0.20:
 *     monthlyPMI = (loanAmount × pmiRate) / 12
 *   Tax  — (appreciatedHomePrice × annualPropertyTaxRate) / 12
 *   Insurance — annualInsurance / 12
 *
 * @param state Full application state.
 * @returns Object with individual payment components and a total.
 */
export function calculateMortgagePayment(state: AppState): {
  principalAndInterest: number;
  pmi: number;
  tax: number;
  insurance: number;
  total: number;
} {
  const { purchaseTarget, assumptions, mortgageInputs } = state;

  // Home price after appreciation at the target date
  const appreciatedHomePrice = calculateTotalCapitalNeeded(
    { ...purchaseTarget, downPaymentPct: 1, closingCostPct: 0, postCloseReservePct: 0 },
    assumptions,
    purchaseTarget.targetMonthsFromNow
  );
  // ^ Trick: pass 100% "down payment" so the formula returns only the appreciated price.

  const loanAmount = Math.max(
    0,
    appreciatedHomePrice * (1 - purchaseTarget.downPaymentPct)
  );

  const n = mortgageInputs.loanTermYears * 12;
  const monthlyRate = mortgageInputs.interestRate / 12;

  let principalAndInterest: number;
  if (n === 0) {
    principalAndInterest = 0;
  } else if (monthlyRate === 0) {
    // Zero-interest loan: equal principal payments
    principalAndInterest = loanAmount / n;
  } else {
    const factor = Math.pow(1 + monthlyRate, n);
    principalAndInterest = (loanAmount * (monthlyRate * factor)) / (factor - 1);
  }

  const pmi =
    purchaseTarget.downPaymentPct < 0.2
      ? (loanAmount * mortgageInputs.pmiRate) / 12
      : 0;

  const tax = (appreciatedHomePrice * mortgageInputs.annualPropertyTaxRate) / 12;
  const insurance = mortgageInputs.annualInsurance / 12;
  const total = principalAndInterest + pmi + tax + insurance;

  return { principalAndInterest, pmi, tax, insurance, total };
}

// ─── Function 7: calculateReadinessScore ─────────────────────────────────────

/**
 * Scores the user's current financial position across all five readiness
 * dimensions using the exact thresholds defined in CLAUDE.md.
 *
 * Each dimension returns a ReadinessDimension with:
 *   status  — 'green' | 'amber' | 'red'
 *   label   — short display label
 *   message — plain-English explanation of the score
 *
 * @param state      Full application state.
 * @param projection Pre-computed projection from generateProjection().
 * @returns ReadinessScore with all five dimensions scored.
 */
export function calculateReadinessScore(
  state: AppState,
  projection: ProjectionPoint[]
): ReadinessScore {
  const { purchaseTarget, cashFlow, assumptions, glidePathSettings } = state;
  const { targetMonthsFromNow } = purchaseTarget;

  // ── Capital Trajectory ─────────────────────────────────────────────────────
  // Compare the month we're projected to hit the target vs. the target date.

  const readinessMonth = findReadinessDate(projection, purchaseTarget, assumptions);
  let capitalTrajectory: ReadinessDimension;

  if (readinessMonth === null) {
    capitalTrajectory = {
      status: 'red',
      label: 'Off Track',
      message:
        'Your projected savings will not reach the capital target within the extended window. Consider increasing monthly savings, adjusting your timeline, or revising the target price.',
    };
  } else {
    const monthsAheadOrBehind = readinessMonth - targetMonthsFromNow;
    if (monthsAheadOrBehind <= 0) {
      capitalTrajectory = {
        status: 'green',
        label: 'On Track',
        message: `You're projected to reach your savings target on time${monthsAheadOrBehind < 0 ? ` — ${Math.abs(monthsAheadOrBehind)} month${Math.abs(monthsAheadOrBehind) === 1 ? '' : 's'} early` : ''}.`,
      };
    } else if (monthsAheadOrBehind <= 6) {
      capitalTrajectory = {
        status: 'amber',
        label: 'Slightly Behind',
        message: `You're projected to hit your target ${monthsAheadOrBehind} month${monthsAheadOrBehind === 1 ? '' : 's'} after your intended date. A modest savings increase would close the gap.`,
      };
    } else {
      capitalTrajectory = {
        status: 'red',
        label: 'Behind Target',
        message: `You're projected to reach your target ${monthsAheadOrBehind} months past your intended date. Consider increasing monthly savings or extending your timeline.`,
      };
    }
  }

  // ── Savings Rate ───────────────────────────────────────────────────────────
  // Compare actual monthly home savings to the amount required to hit the
  // target on time from the current accessible capital position.

  let savingsRate: ReadinessDimension;

  const accessibleCapital = calculateAccessibleCapital(
    state.assetBuckets,
    assumptions.capitalGainsTaxRate
  );
  const savingsTarget =
    projection.length > 0 ? projection[0].savingsTarget : 0;
  const capitalGap = Math.max(0, savingsTarget - accessibleCapital);
  const requiredMonthlySavings =
    targetMonthsFromNow > 0 ? capitalGap / targetMonthsFromNow : 0;

  if (requiredMonthlySavings <= 0) {
    savingsRate = {
      status: 'green',
      label: 'Fully Funded',
      message: 'Your current accessible capital already covers the total capital needed.',
    };
  } else {
    const actualSavings = cashFlow.monthlyHomeSavings;
    const ratio = actualSavings / requiredMonthlySavings;

    if (ratio >= 0.8) {
      savingsRate = {
        status: 'green',
        label: 'Strong Savings',
        message: `Your monthly savings of ${formatUSD(actualSavings)} covers ${Math.round(ratio * 100)}% of the ${formatUSD(requiredMonthlySavings)}/mo needed to hit your target on time.`,
      };
    } else if (ratio >= 0.6) {
      savingsRate = {
        status: 'amber',
        label: 'Moderate Savings',
        message: `Your monthly savings cover ${Math.round(ratio * 100)}% of the ${formatUSD(requiredMonthlySavings)}/mo needed. An additional ${formatUSD(requiredMonthlySavings - actualSavings)}/mo would put you on track.`,
      };
    } else {
      savingsRate = {
        status: 'red',
        label: 'Insufficient Savings',
        message: `Your monthly savings cover only ${Math.round(ratio * 100)}% of the ${formatUSD(requiredMonthlySavings)}/mo needed. Consider a significant savings increase or timeline adjustment.`,
      };
    }
  }

  // ── Risk Alignment ─────────────────────────────────────────────────────────
  // Compare the current equity allocation tier to what the auto glide path
  // would prescribe for the current months-to-target.

  const autoEquityPct = getGlidePathEquityPct(targetMonthsFromNow, {
    mode: 'auto',
    manualEquityPct: 0,
  });
  const currentEquityPct = getGlidePathEquityPct(
    targetMonthsFromNow,
    glidePathSettings
  );

  const autoTier = getNearestTierIndex(autoEquityPct);
  const currentTier = getNearestTierIndex(currentEquityPct);
  const tierDiff = Math.abs(currentTier - autoTier);

  let riskAlignment: ReadinessDimension;
  const autoLabel = `${Math.round(autoEquityPct * 100)}% equity`;
  const currentLabel = `${Math.round(currentEquityPct * 100)}% equity`;

  if (glidePathSettings.mode === 'auto' || tierDiff === 0) {
    riskAlignment = {
      status: 'green',
      label: 'Well Aligned',
      message: `Your allocation (${currentLabel}) matches the recommended glide-path tier for your ${targetMonthsFromNow}-month horizon.`,
    };
  } else if (tierDiff === 1) {
    riskAlignment = {
      status: 'amber',
      label: 'Slightly Misaligned',
      message: `Your allocation (${currentLabel}) is one tier ${currentTier < autoTier ? 'more aggressive' : 'more conservative'} than the recommended ${autoLabel} for your timeline.`,
    };
  } else {
    riskAlignment = {
      status: 'red',
      label: 'Misaligned',
      message: `Your allocation (${currentLabel}) is ${tierDiff} tiers ${currentTier < autoTier ? 'more aggressive' : 'more conservative'} than the recommended ${autoLabel}. This may expose your home fund to inappropriate risk.`,
    };
  }

  // ── Affordability (front-end DTI) ─────────────────────────────────────────
  // PITI + PMI as a fraction of gross monthly income.

  let affordability: ReadinessDimension;
  const { total: monthlyPITI } = calculateMortgagePayment(state);
  const monthlyGrossIncome = cashFlow.grossIncome > 0 ? cashFlow.grossIncome / 12 : 0;

  if (monthlyGrossIncome <= 0) {
    affordability = {
      status: 'amber',
      label: 'Income Unknown',
      message:
        'Enter your gross monthly income to calculate your debt-to-income ratio.',
    };
  } else {
    const dti = monthlyPITI / monthlyGrossIncome;
    const dtiPct = Math.round(dti * 1000) / 10; // one decimal place

    if (dti < 0.28) {
      affordability = {
        status: 'green',
        label: 'Affordable',
        message: `Your estimated front-end DTI is ${dtiPct}%, well within the 28% guideline.`,
      };
    } else if (dti <= 0.35) {
      affordability = {
        status: 'amber',
        label: 'Stretch Affordable',
        message: `Your estimated front-end DTI is ${dtiPct}%, between the 28% guideline and 35% limit. Lenders may still approve this, but it leaves less budget cushion.`,
      };
    } else {
      affordability = {
        status: 'red',
        label: 'Over Guideline',
        message: `Your estimated front-end DTI is ${dtiPct}%, above the 35% threshold. Consider a lower target price, larger down payment, or higher income before purchasing.`,
      };
    }
  }

  // ── Reserve Cushion ────────────────────────────────────────────────────────
  // Post-close reserve as a multiple of gross monthly income.

  let reserveCushion: ReadinessDimension;

  // Appreciated home price at target date (same calculation used for mortgage)
  const appreciatedHomePrice = purchaseTarget.targetHomePrice *
    Math.pow(1 + assumptions.homePriceAppreciation / 12, targetMonthsFromNow);
  const reserveAmount = purchaseTarget.postCloseReservePct * appreciatedHomePrice;

  if (monthlyGrossIncome <= 0) {
    reserveCushion = {
      status: 'amber',
      label: 'Income Unknown',
      message:
        'Enter your gross monthly income to evaluate your post-close reserve cushion.',
    };
  } else {
    const reserveMonths = reserveAmount / monthlyGrossIncome;

    if (reserveMonths > 3) {
      reserveCushion = {
        status: 'green',
        label: 'Adequate Reserve',
        message: `Your planned post-close reserve of ${formatUSD(reserveAmount)} covers ${reserveMonths.toFixed(1)} months of gross income — well above the 3-month guideline.`,
      };
    } else if (reserveMonths >= 1) {
      reserveCushion = {
        status: 'amber',
        label: 'Thin Reserve',
        message: `Your planned reserve of ${formatUSD(reserveAmount)} covers ${reserveMonths.toFixed(1)} months of gross income. Aim for at least 3 months to buffer unexpected post-purchase expenses.`,
      };
    } else {
      reserveCushion = {
        status: 'red',
        label: 'Insufficient Reserve',
        message: `Your planned reserve of ${formatUSD(reserveAmount)} covers less than 1 month of gross income. Increase the post-close reserve percentage or revisit the target price.`,
      };
    }
  }

  return {
    capitalTrajectory,
    savingsRate,
    riskAlignment,
    affordability,
    reserveCushion,
  };
}

// ─── Private display helper ───────────────────────────────────────────────────
// Kept local to this file to avoid a circular import with lib/utils.ts.
// Used only inside human-readable score messages.

function formatUSD(value: number): string {
  return '$' + Math.round(value).toLocaleString('en-US');
}
