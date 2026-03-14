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
  MonthlyCashFlow,
  MortgagePaymentResult,
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

/**
 * Returns the appreciated home price at the given number of months from now.
 * Uses monthly compounding per CLAUDE.md architecture rules.
 *
 * @param purchaseTarget  Purchase target configuration (source of targetHomePrice).
 * @param assumptions     Assumptions (source of homePriceAppreciation).
 * @param atMonthsFromNow Months from today. Defaults to targetMonthsFromNow.
 */
function getAppreciatedPrice(
  purchaseTarget: PurchaseTarget,
  assumptions: InvestmentAssumptions,
  atMonthsFromNow?: number
): number {
  const months =
    atMonthsFromNow !== undefined
      ? atMonthsFromNow
      : purchaseTarget.targetMonthsFromNow;
  const monthlyRate = assumptions.homePriceAppreciation / 12;
  return purchaseTarget.targetHomePrice * Math.pow(1 + monthlyRate, months);
}

// ─── Function 1: calculatePurchaseDayCapital ──────────────────────────────────

/**
 * One-time capital required at time of purchase. Includes down payment,
 * closing costs, and move-in expenses.
 *
 * Formula:
 *   appreciatedPrice   = targetHomePrice × (1 + homePriceAppreciation/12)^months
 *   purchaseDayCapital = appreciatedPrice × (downPaymentPct + closingCostPct)
 *                        + moveInCosts
 *
 * Note: post-close reserve is NOT included here — it stays in the account.
 * moveInCosts is a flat dollar addition (not percentage-based).
 *
 * @param purchaseTarget  The user's purchase target configuration.
 * @param assumptions     Investment and market assumptions.
 * @param atMonthsFromNow Months from today to evaluate at. Defaults to
 *                        purchaseTarget.targetMonthsFromNow when omitted.
 * @returns Dollar amount of capital leaving the account on or before closing.
 */
export function calculatePurchaseDayCapital(
  purchaseTarget: PurchaseTarget,
  assumptions: InvestmentAssumptions,
  atMonthsFromNow?: number
): number {
  const appreciatedPrice = getAppreciatedPrice(purchaseTarget, assumptions, atMonthsFromNow);
  return (
    appreciatedPrice * (purchaseTarget.downPaymentPct + purchaseTarget.closingCostPct) +
    purchaseTarget.moveInCosts
  );
}

// ─── Function 2: calculateFullReadinessCapital ────────────────────────────────

/**
 * Full capital needed to purchase with confidence. Includes purchase day
 * capital, post-close reserve, and 4 months of post-purchase living expenses
 * as a transition buffer.
 *
 * Formula:
 *   postPurchaseMonthlyExpenses = mortgageResult.total + cashFlow.otherMonthlyExpenses
 *   liquidityBuffer             = postPurchaseMonthlyExpenses × 4
 *   postCloseReserve            = appreciatedPrice × postCloseReservePct
 *   fullReadinessCapital        = calculatePurchaseDayCapital(...)
 *                                 + postCloseReserve
 *                                 + liquidityBuffer
 *
 * @param purchaseTarget  The user's purchase target configuration.
 * @param cashFlow        Monthly cash flow inputs (provides otherMonthlyExpenses).
 * @param mortgageResult  Pre-computed mortgage payment result (provides total PITI+PMI).
 * @param assumptions     Investment and market assumptions.
 * @param atMonthsFromNow Months from today to evaluate at. Defaults to
 *                        purchaseTarget.targetMonthsFromNow when omitted.
 * @returns Total dollar amount of capital required to be fully purchase-ready.
 */
export function calculateFullReadinessCapital(
  purchaseTarget: PurchaseTarget,
  cashFlow: MonthlyCashFlow,
  mortgageResult: MortgagePaymentResult,
  assumptions: InvestmentAssumptions,
  atMonthsFromNow?: number
): number {
  const appreciatedPrice = getAppreciatedPrice(purchaseTarget, assumptions, atMonthsFromNow);
  const purchaseDayCapital = calculatePurchaseDayCapital(purchaseTarget, assumptions, atMonthsFromNow);
  const postCloseReserve = appreciatedPrice * purchaseTarget.postCloseReservePct;
  const postPurchaseMonthlyExpenses = mortgageResult.total + cashFlow.otherMonthlyExpenses;
  const liquidityBuffer = postPurchaseMonthlyExpenses * 4;
  return purchaseDayCapital + postCloseReserve + liquidityBuffer;
}

// ─── Function 3: calculateMonthlyViability ────────────────────────────────────

/**
 * Checks whether post-purchase monthly cash flow is positive. If negative,
 * the user cannot sustain the mortgage and the app should block the
 * readiness projection.
 *
 * Formula:
 *   monthlyNet = (cashFlow.grossIncome / 12)
 *                − mortgageResult.total
 *                − cashFlow.otherMonthlyExpenses
 *                + cashFlow.currentMonthlyRent   ← rent disappears after purchase
 *   isViable   = monthlyNet >= 0
 *   deficit    = isViable ? 0 : Math.abs(monthlyNet)
 *
 * @param cashFlow       Monthly cash flow inputs.
 * @param mortgageResult Pre-computed mortgage payment result.
 * @returns Object with isViable flag, monthlyNet, and deficit.
 */
export function calculateMonthlyViability(
  cashFlow: MonthlyCashFlow,
  mortgageResult: MortgagePaymentResult
): { isViable: boolean; monthlyNet: number; deficit: number } {
  const monthlyNet =
    cashFlow.grossIncome / 12 -
    mortgageResult.total -
    cashFlow.otherMonthlyExpenses +
    cashFlow.currentMonthlyRent;
  const isViable = monthlyNet >= 0;
  return {
    isViable,
    monthlyNet,
    deficit: isViable ? 0 : Math.abs(monthlyNet),
  };
}

// ─── Function 4: calculateAccessibleCapital ──────────────────────────────────

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

// ─── Function 5: getGlidePathEquityPct ───────────────────────────────────────

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

// ─── Function 6: getExpectedAnnualReturn ─────────────────────────────────────

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

// ─── Function 7: calculateMortgagePayment ────────────────────────────────────

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
 * @returns MortgagePaymentResult with individual payment components and a total.
 */
export function calculateMortgagePayment(state: AppState): MortgagePaymentResult {
  const { purchaseTarget, assumptions, mortgageInputs } = state;

  // Home price after appreciation at the target date
  const appreciatedHomePrice = getAppreciatedPrice(
    purchaseTarget,
    assumptions,
    purchaseTarget.targetMonthsFromNow
  );

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

// ─── Function 8: generateProjection ──────────────────────────────────────────

/**
 * Generates a month-by-month projection of capital accumulation from today
 * (month 0) through targetMonthsFromNow + 6.
 *
 * Each step applies the CLAUDE.md accumulation formula:
 *   balance = (previousBalance + monthlyHomeSavings) × (1 + monthlyReturn)
 * where monthlyReturn = annualReturn / 12.
 *
 * Month 0 is the current state — the formula is applied starting at month 1.
 * The savingsTarget is the Full Readiness Capital at the target date (constant
 * across all projection points), serving as the goal-line in the chart.
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

  // The goal line: full readiness capital required at the target date
  const mortgageResult = calculateMortgagePayment(state);
  const savingsTarget = calculateFullReadinessCapital(
    purchaseTarget,
    cashFlow,
    mortgageResult,
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

// ─── Function 9: findReadinessDate ───────────────────────────────────────────

/**
 * Finds the first month in the projection where the projected balance meets
 * or exceeds the savings target.
 *
 * The savings target is read from each point's own savingsTarget field
 * (which is constant across all points — see generateProjection).
 *
 * @param projection    Array of ProjectionPoints from generateProjection().
 * @param purchaseTarget  Purchase target configuration (reserved for future use).
 * @param assumptions   Investment assumptions (reserved for future use).
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

// ─── Function 10: calculateReadinessScore ────────────────────────────────────

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
        'Your projected savings will not reach full readiness capital within the extended window. Consider increasing monthly savings, adjusting your timeline, or revising the target price.',
    };
  } else {
    const monthsAheadOrBehind = readinessMonth - targetMonthsFromNow;
    if (monthsAheadOrBehind <= 0) {
      capitalTrajectory = {
        status: 'green',
        label: 'On Track',
        message: `You're projected to reach full readiness capital on time${monthsAheadOrBehind < 0 ? ` — ${Math.abs(monthsAheadOrBehind)} month${Math.abs(monthsAheadOrBehind) === 1 ? '' : 's'} early` : ''}.`,
      };
    } else if (monthsAheadOrBehind <= 6) {
      capitalTrajectory = {
        status: 'amber',
        label: 'Slightly Behind',
        message: `You're projected to hit full readiness capital ${monthsAheadOrBehind} month${monthsAheadOrBehind === 1 ? '' : 's'} after your intended date. A modest savings increase would close the gap.`,
      };
    } else {
      capitalTrajectory = {
        status: 'red',
        label: 'Behind Target',
        message: `You're projected to reach full readiness capital ${monthsAheadOrBehind} months past your intended date. Consider increasing monthly savings or extending your timeline.`,
      };
    }
  }

  // ── Savings Rate ───────────────────────────────────────────────────────────
  // Compare actual monthly home savings to the amount required to hit the
  // full readiness capital target on time.
  // (savingsTarget comes from generateProjection which already uses calculateFullReadinessCapital)

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
      message: 'Your current accessible capital already covers full readiness capital.',
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
  // Post-close reserve measured against post-purchase monthly expenses
  // (mortgage + other monthly expenses), not gross income.

  let reserveCushion: ReadinessDimension;

  const appreciatedHomePrice = getAppreciatedPrice(purchaseTarget, assumptions, targetMonthsFromNow);
  const reserveAmount = purchaseTarget.postCloseReservePct * appreciatedHomePrice;
  const postPurchaseMonthlyExpenses = monthlyPITI + cashFlow.otherMonthlyExpenses;

  if (postPurchaseMonthlyExpenses <= 0) {
    reserveCushion = {
      status: 'amber',
      label: 'Expenses Unknown',
      message:
        'Enter your mortgage details and monthly expenses to evaluate your post-close reserve cushion.',
    };
  } else {
    const monthsCovered = reserveAmount / postPurchaseMonthlyExpenses;

    if (monthsCovered > 3) {
      reserveCushion = {
        status: 'green',
        label: 'Adequate Reserve',
        message: `Your planned post-close reserve of ${formatUSD(reserveAmount)} covers ${monthsCovered.toFixed(1)} months of post-purchase expenses — well above the 3-month guideline.`,
      };
    } else if (monthsCovered >= 1) {
      reserveCushion = {
        status: 'amber',
        label: 'Thin Reserve',
        message: `Your planned reserve of ${formatUSD(reserveAmount)} covers ${monthsCovered.toFixed(1)} months of post-purchase expenses. Aim for at least 3 months to buffer unexpected costs after closing.`,
      };
    } else {
      reserveCushion = {
        status: 'red',
        label: 'Insufficient Reserve',
        message: `Your planned reserve of ${formatUSD(reserveAmount)} covers less than 1 month of post-purchase expenses. Increase the post-close reserve percentage or revisit the target price.`,
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
