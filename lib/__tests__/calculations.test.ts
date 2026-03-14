/**
 * lib/__tests__/calculations.test.ts
 *
 * Unit tests for lib/calculations.ts using the example inputs from
 * the "Example Test Case" section of CLAUDE.md:
 *
 *   Target home price:       $600,000
 *   Down payment:            20%
 *   Closing costs:           3%
 *   Post-close reserve:      2%
 *   Move-in costs:           $10,000
 *   Target date:             24 months from now
 *   Current accessible cap:  $80,000  (all in Cash/HYSA)
 *   Monthly home savings:    $3,000/mo
 *   Home price appreciation: 3.5%
 *
 * ─── NOTE ON CLAUDE.md EXAMPLE VALUES ────────────────────────────────────────
 * The example in CLAUDE.md states:
 *   "Total capital needed at month 24: ~$155,700"
 *   "Month 24 projected balance:        ~$152,000"
 *
 * These figures do NOT match the specified formulas:
 *
 *   $155,700 ≈ $600,000 × (1.035)^1 × 0.25  — only 1 year of appreciation,
 *              not 2 years (24 months). The correct value using monthly
 *              compounding over 24 months for calculatePurchaseDayCapital is
 *              ~$157,991 (+ $10k move-in = purchase day only, no reserve).
 *
 *   $152,000 = $80,000 + 24 × $3,000         — zero investment return.
 *              The correct value applying the dynamic glide path blended
 *              return is ~$164,057.
 *
 * The tests below assert the CORRECT formula outputs. If the CLAUDE.md
 * example is updated in the future, the tolerances here should be rechecked.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import {
  calculateAccessibleCapital,
  calculatePurchaseDayCapital,
  calculateFullReadinessCapital,
  calculateMonthlyViability,
  generateProjection,
  getExpectedAnnualReturn,
  getGlidePathEquityPct,
} from '@/lib/calculations';

import type {
  AppState,
  AssetBucket,
  GlidePathSettings,
  InvestmentAssumptions,
  MonthlyCashFlow,
  MortgagePaymentResult,
  PurchaseTarget,
} from '@/lib/types';

// ─── Shared fixtures (CLAUDE.md example inputs) ───────────────────────────────

const purchaseTarget: PurchaseTarget = {
  targetHomePrice:      600_000,
  downPaymentPct:       0.20,
  closingCostPct:       0.03,
  postCloseReservePct:  0.02,
  moveInCosts:          10_000,
  targetMonthsFromNow:  24,
};

const assumptions: InvestmentAssumptions = {
  hysaYield:             0.045,
  conservativeReturn:    0.040,
  moderateReturn:        0.065,
  aggressiveReturn:      0.090,
  capitalGainsTaxRate:   0.15,
  inflationRate:         0.030,
  homePriceAppreciation: 0.035,
};

const cashFlow: MonthlyCashFlow = {
  grossIncome:               120_000,
  monthlyHomeSavings:        3_000,
  otherSavingsRate:          0,
  annualIncomeGrowthRate:    0.03,
  annualSavingsRateIncrease: 0,
  currentMonthlyRent:        2_000,
  otherMonthlyExpenses:      3_000,
};

// Single HYSA bucket holding all $80k — no tax adjustments needed
const hysa80kBucket: AssetBucket = {
  id:                    'cash-hysa',
  label:                 'Cash / HYSA',
  balance:               80_000,
  costBasis:             0,
  isAvailableForPurchase: true,
  isIlliquid:            false,
};

const autoGlide: GlidePathSettings = {
  mode:            'auto',
  manualEquityPct: 0.65,
};

/** Minimal AppState for the CLAUDE.md example scenario. */
const exampleState: AppState = {
  scenarioName:      'Example Test Case',
  purchaseTarget,
  assetBuckets:      [hysa80kBucket],
  cashFlow,
  assumptions,
  glidePathSettings: autoGlide,
  mortgageInputs: {
    interestRate:          0.068,
    loanTermYears:         30,
    annualPropertyTaxRate: 0.011,
    annualInsurance:       2_400,
    pmiRate:               0.008,
  },
};

// ─── 1. calculatePurchaseDayCapital ──────────────────────────────────────────

describe('calculatePurchaseDayCapital', () => {
  /**
   * Formula: appreciatedPrice × (down + closing) + moveInCosts
   *
   * At month 0 (no appreciation):
   *   appreciatedPrice = 600,000 × (1 + 0/12)^0 = 600,000
   *   purchaseDayCapital = 600,000 × 0.23 + 10,000
   *                      = 138,000 + 10,000
   *                      = 148,000
   */
  it('returns ~$148,000 at month 0 (no appreciation, 20% down + 3% closing + $10k move-in)', () => {
    const result = calculatePurchaseDayCapital(purchaseTarget, assumptions, 0);
    // 600,000 × 0.23 + 10,000 = 148,000 exactly
    expect(result).toBeCloseTo(148_000, 0);
  });

  it('returns more at month 24 than month 0 due to appreciation', () => {
    const at0  = calculatePurchaseDayCapital(purchaseTarget, assumptions, 0);
    const at24 = calculatePurchaseDayCapital(purchaseTarget, assumptions, 24);
    expect(at24).toBeGreaterThan(at0);
  });

  it('uses targetMonthsFromNow as default when atMonthsFromNow is omitted', () => {
    const explicit = calculatePurchaseDayCapital(purchaseTarget, assumptions, 24);
    const defaulted = calculatePurchaseDayCapital(purchaseTarget, assumptions);
    expect(explicit).toBeCloseTo(defaulted, 5);
  });

  it('does NOT include post-close reserve percentage', () => {
    // Reserve is 2% of appreciatedPrice. If included the result would be higher.
    const withReserveIncluded = calculatePurchaseDayCapital(purchaseTarget, assumptions, 0);
    // 600,000 × 0.23 + 10,000 = 148,000 (no reserve)
    // 600,000 × 0.25 + 10,000 = 160,000 (with reserve) — should NOT match this
    expect(withReserveIncluded).toBeCloseTo(148_000, 0);
    expect(withReserveIncluded).not.toBeCloseTo(160_000, 0);
  });

  it('returns more capital with higher moveInCosts', () => {
    const base    = calculatePurchaseDayCapital(purchaseTarget, assumptions, 0);
    const higher  = calculatePurchaseDayCapital({ ...purchaseTarget, moveInCosts: 25_000 }, assumptions, 0);
    expect(higher - base).toBeCloseTo(15_000, 0);
  });
});

// ─── 2. calculateFullReadinessCapital ────────────────────────────────────────

describe('calculateFullReadinessCapital', () => {
  /**
   * Uses a fixed mock mortgage result to keep the test isolated from the
   * mortgage calculation logic.
   *
   * At month 0 with mock mortgage total $2,500/mo:
   *   purchaseDayCapital        = 148,000
   *   postCloseReserve          = 600,000 × 0.02 = 12,000
   *   postPurchaseMonthlyExp    = 2,500 + 3,000 = 5,500
   *   liquidityBuffer           = 5,500 × 4 = 22,000
   *   fullReadinessCapital      = 148,000 + 12,000 + 22,000 = 182,000
   */
  const mockMortgageResult: MortgagePaymentResult = {
    principalAndInterest: 2_000,
    pmi: 0,
    tax: 300,
    insurance: 200,
    total: 2_500,
  };

  it('adds post-close reserve and 4-month liquidity buffer on top of purchase day capital', () => {
    const result = calculateFullReadinessCapital(
      purchaseTarget,
      cashFlow,
      mockMortgageResult,
      assumptions,
      0
    );
    // 148,000 + 12,000 + 22,000 = 182,000
    expect(result).toBeCloseTo(182_000, 0);
  });

  it('is always greater than calculatePurchaseDayCapital at the same horizon', () => {
    const purchaseDay = calculatePurchaseDayCapital(purchaseTarget, assumptions, 0);
    const fullReadiness = calculateFullReadinessCapital(
      purchaseTarget,
      cashFlow,
      mockMortgageResult,
      assumptions,
      0
    );
    expect(fullReadiness).toBeGreaterThan(purchaseDay);
  });

  it('increases when otherMonthlyExpenses increases (larger buffer)', () => {
    const base  = calculateFullReadinessCapital(purchaseTarget, cashFlow, mockMortgageResult, assumptions, 0);
    const higher = calculateFullReadinessCapital(
      purchaseTarget,
      { ...cashFlow, otherMonthlyExpenses: 5_000 },
      mockMortgageResult,
      assumptions,
      0
    );
    // buffer delta = (5000 - 3000) × 4 = 8,000
    expect(higher - base).toBeCloseTo(8_000, 0);
  });

  it('uses targetMonthsFromNow as default when atMonthsFromNow is omitted', () => {
    const explicit = calculateFullReadinessCapital(purchaseTarget, cashFlow, mockMortgageResult, assumptions, 24);
    const defaulted = calculateFullReadinessCapital(purchaseTarget, cashFlow, mockMortgageResult, assumptions);
    expect(explicit).toBeCloseTo(defaulted, 5);
  });
});

// ─── 3. calculateMonthlyViability ────────────────────────────────────────────

describe('calculateMonthlyViability', () => {
  /**
   * Formula: monthlyNet = grossIncome/12 - mortgage.total - otherExpenses + rent
   */

  it('case 1: $120k income, $3,200 mortgage, $3,000 expenses, $2,500 rent → isViable=true, net=$6,300', () => {
    const cf: MonthlyCashFlow = {
      grossIncome:               120_000,
      monthlyHomeSavings:        0,
      otherSavingsRate:          0,
      annualIncomeGrowthRate:    0.03,
      annualSavingsRateIncrease: 0,
      currentMonthlyRent:        2_500,
      otherMonthlyExpenses:      3_000,
    };
    const mortgage: MortgagePaymentResult = {
      principalAndInterest: 2_600,
      pmi: 0,
      tax: 350,
      insurance: 250,
      total: 3_200,
    };
    // monthlyNet = 10,000 - 3,200 - 3,000 + 2,500 = 6,300
    const result = calculateMonthlyViability(cf, mortgage);
    expect(result.isViable).toBe(true);
    expect(result.monthlyNet).toBeCloseTo(6_300, 2);
    expect(result.deficit).toBe(0);
  });

  it('case 2: $60k income, $3,200 mortgage, $3,000 expenses, $2,500 rent → isViable=true, net=$1,300', () => {
    const cf: MonthlyCashFlow = {
      grossIncome:               60_000,
      monthlyHomeSavings:        0,
      otherSavingsRate:          0,
      annualIncomeGrowthRate:    0.03,
      annualSavingsRateIncrease: 0,
      currentMonthlyRent:        2_500,
      otherMonthlyExpenses:      3_000,
    };
    const mortgage: MortgagePaymentResult = {
      principalAndInterest: 2_600,
      pmi: 0,
      tax: 350,
      insurance: 250,
      total: 3_200,
    };
    // monthlyNet = 5,000 - 3,200 - 3,000 + 2,500 = 1,300
    const result = calculateMonthlyViability(cf, mortgage);
    expect(result.isViable).toBe(true);
    expect(result.monthlyNet).toBeCloseTo(1_300, 2);
    expect(result.deficit).toBe(0);
  });

  it('case 3: $60k income, $4,500 mortgage, $3,500 expenses, $2,000 rent → isViable=false, deficit=$1,000', () => {
    const cf: MonthlyCashFlow = {
      grossIncome:               60_000,
      monthlyHomeSavings:        0,
      otherSavingsRate:          0,
      annualIncomeGrowthRate:    0.03,
      annualSavingsRateIncrease: 0,
      currentMonthlyRent:        2_000,
      otherMonthlyExpenses:      3_500,
    };
    const mortgage: MortgagePaymentResult = {
      principalAndInterest: 3_800,
      pmi: 0,
      tax: 450,
      insurance: 250,
      total: 4_500,
    };
    // monthlyNet = 5,000 - 4,500 - 3,500 + 2,000 = -1,000
    const result = calculateMonthlyViability(cf, mortgage);
    expect(result.isViable).toBe(false);
    expect(result.monthlyNet).toBeCloseTo(-1_000, 2);
    expect(result.deficit).toBeCloseTo(1_000, 2);
  });

  it('treats monthlyNet === 0 as viable (not a deficit)', () => {
    const cf: MonthlyCashFlow = {
      grossIncome:               72_000,  // $6,000/mo
      monthlyHomeSavings:        0,
      otherSavingsRate:          0,
      annualIncomeGrowthRate:    0.03,
      annualSavingsRateIncrease: 0,
      currentMonthlyRent:        2_000,
      otherMonthlyExpenses:      3_000,
    };
    const mortgage: MortgagePaymentResult = {
      principalAndInterest: 4_000,
      pmi: 0,
      tax: 700,
      insurance: 300,
      total: 5_000,
    };
    // monthlyNet = 6,000 - 5,000 - 3,000 + 2,000 = 0
    const result = calculateMonthlyViability(cf, mortgage);
    expect(result.isViable).toBe(true);
    expect(result.monthlyNet).toBeCloseTo(0, 2);
    expect(result.deficit).toBe(0);
  });
});

// ─── 4. generateProjection — array length ────────────────────────────────────

describe('generateProjection — data point count', () => {
  /**
   * The function generates month 0 through targetMonthsFromNow + 6 inclusive,
   * so the total count is targetMonthsFromNow + 7.
   * For a 24-month target: months 0..30 = 31 points.
   */
  it('returns exactly targetMonthsFromNow + 7 points (months 0 through 30)', () => {
    const projection = generateProjection(exampleState);

    expect(projection).toHaveLength(24 + 7); // 31 points

    // First and last month indices are correct
    expect(projection[0].month).toBe(0);
    expect(projection[projection.length - 1].month).toBe(30);
  });

  it('has consecutive month numbers with no gaps', () => {
    const projection = generateProjection(exampleState);
    projection.forEach((point, idx) => {
      expect(point.month).toBe(idx);
    });
  });
});

// ─── 5. generateProjection — month 24 balance ────────────────────────────────

describe('generateProjection — month 24 projected balance', () => {
  /**
   * Starting from $80,000 and contributing $3,000/month under the auto
   * glide path for a 24-month target, using
   *   balance = (prev + savings) × (1 + monthlyReturn)
   *
   * Returns breakdown per phase:
   *   Months 1–12  (mtt 23→12): equity 0.30, return 5.5% /yr → ~$121,600
   *   Months 13–18 (mtt 11→ 6): equity 0.15, return 4.75%/yr → ~$142,770
   *   Months 19–24 (mtt  5→ 0): equity 0.05, return 4.25%/yr → ~$164,057
   *
   * CLAUDE.md example states ~$152,000 which equals 80,000 + 24 × 3,000
   * (zero investment return). The test here validates the correct value.
   */
  it('reaches approximately $164,057 at month 24 under the auto glide path', () => {
    const projection = generateProjection(exampleState);
    const month24 = projection.find((p) => p.month === 24)!;

    expect(month24).toBeDefined();
    // Correct formula value — within $2,000 for accumulated rounding
    expect(month24.projectedBalance).toBeGreaterThanOrEqual(162_057);
    expect(month24.projectedBalance).toBeLessThanOrEqual(166_057);
  });

  it('has a higher balance at month 24 than month 0 (savings + returns)', () => {
    const projection = generateProjection(exampleState);
    const month0  = projection[0].projectedBalance;
    const month24 = projection.find((p) => p.month === 24)!.projectedBalance;
    expect(month24).toBeGreaterThan(month0);
  });

  it('month 0 balance equals the initial accessible capital', () => {
    const projection = generateProjection(exampleState);
    expect(projection[0].projectedBalance).toBeCloseTo(80_000, 2);
  });
});

// ─── 6. getGlidePathEquityPct — auto tier boundaries ─────────────────────────

describe('getGlidePathEquityPct — auto mode tier thresholds', () => {
  const autoSettings: GlidePathSettings = { mode: 'auto', manualEquityPct: 0 };

  it('returns 0.65 for 40 months to target (36+ tier)', () => {
    expect(getGlidePathEquityPct(40, autoSettings)).toBe(0.65);
  });

  it('returns 0.65 exactly at the 36-month boundary', () => {
    expect(getGlidePathEquityPct(36, autoSettings)).toBe(0.65);
  });

  it('returns 0.50 for 30 months to target (24–36 tier)', () => {
    expect(getGlidePathEquityPct(30, autoSettings)).toBe(0.50);
  });

  it('returns 0.50 exactly at the 24-month boundary', () => {
    expect(getGlidePathEquityPct(24, autoSettings)).toBe(0.50);
  });

  it('returns 0.30 for 18 months to target (12–24 tier)', () => {
    expect(getGlidePathEquityPct(18, autoSettings)).toBe(0.30);
  });

  it('returns 0.30 exactly at the 12-month boundary', () => {
    expect(getGlidePathEquityPct(12, autoSettings)).toBe(0.30);
  });

  it('returns 0.15 for 9 months to target (6–12 tier)', () => {
    expect(getGlidePathEquityPct(9, autoSettings)).toBe(0.15);
  });

  it('returns 0.15 exactly at the 6-month boundary', () => {
    expect(getGlidePathEquityPct(6, autoSettings)).toBe(0.15);
  });

  it('returns 0.05 for 3 months to target (0–6 tier)', () => {
    expect(getGlidePathEquityPct(3, autoSettings)).toBe(0.05);
  });

  it('returns 0.05 for 0 months (at target date)', () => {
    expect(getGlidePathEquityPct(0, autoSettings)).toBe(0.05);
  });

  it('returns 0.05 for negative months (past target date)', () => {
    expect(getGlidePathEquityPct(-3, autoSettings)).toBe(0.05);
  });

  it('returns manualEquityPct directly in manual mode, ignoring months', () => {
    const manual: GlidePathSettings = { mode: 'manual', manualEquityPct: 0.42 };
    expect(getGlidePathEquityPct(40, manual)).toBe(0.42);
    expect(getGlidePathEquityPct(3,  manual)).toBe(0.42);
  });
});

// ─── 7. calculateAccessibleCapital — capital gains tax ───────────────────────

describe('calculateAccessibleCapital — capital gains tax on brokerage', () => {
  /**
   * Given:
   *   Taxable brokerage: balance $50,000, cost basis $30,000
   *   capitalGainsTaxRate: 15%
   *
   *   gain      = $50,000 - $30,000        = $20,000
   *   tax owed  = $20,000 × 0.15           = $3,000
   *   after-tax = $50,000 - $3,000         = $47,000  ✓
   */
  it('subtracts capital gains tax on taxable brokerage gains: $50k balance / $30k basis → $47k', () => {
    const buckets: AssetBucket[] = [
      {
        id:                    'taxable-brokerage',
        label:                 'Taxable Brokerage',
        balance:               50_000,
        costBasis:             30_000,
        isAvailableForPurchase: true,
        isIlliquid:            false,
      },
    ];

    const result = calculateAccessibleCapital(buckets, 0.15);
    expect(result).toBeCloseTo(47_000, 2);
  });

  it('uses full balance for non-brokerage buckets (no tax)', () => {
    const buckets: AssetBucket[] = [
      {
        id:                    'cash-hysa',
        label:                 'Cash / HYSA',
        balance:               80_000,
        costBasis:             0,
        isAvailableForPurchase: true,
        isIlliquid:            false,
      },
    ];

    const result = calculateAccessibleCapital(buckets, 0.15);
    expect(result).toBeCloseTo(80_000, 2);
  });

  it('excludes buckets where isAvailableForPurchase is false', () => {
    const buckets: AssetBucket[] = [
      {
        id:                    'cash-hysa',
        label:                 'Cash / HYSA',
        balance:               80_000,
        costBasis:             0,
        isAvailableForPurchase: true,
        isIlliquid:            false,
      },
      {
        id:                    'traditional-ira-401k',
        label:                 'Traditional IRA / 401(k)',
        balance:               200_000,
        costBasis:             0,
        isAvailableForPurchase: false,
        isIlliquid:            false,
      },
    ];

    // Only the $80k HYSA is included
    const result = calculateAccessibleCapital(buckets, 0.15);
    expect(result).toBeCloseTo(80_000, 2);
  });

  it('does not apply negative gains (cost basis > balance is floored at zero gain)', () => {
    const buckets: AssetBucket[] = [
      {
        id:                    'taxable-brokerage',
        label:                 'Taxable Brokerage',
        balance:               30_000,
        costBasis:             50_000, // at a loss — no capital gains tax
        isAvailableForPurchase: true,
        isIlliquid:            false,
      },
    ];

    // Loss position: no tax, full balance accessible
    const result = calculateAccessibleCapital(buckets, 0.15);
    expect(result).toBeCloseTo(30_000, 2);
  });

  it('sums multiple accessible buckets correctly', () => {
    const buckets: AssetBucket[] = [
      {
        id:                    'cash-hysa',
        label:                 'Cash / HYSA',
        balance:               80_000,
        costBasis:             0,
        isAvailableForPurchase: true,
        isIlliquid:            false,
      },
      {
        id:                    'taxable-brokerage',
        label:                 'Taxable Brokerage',
        balance:               50_000,
        costBasis:             30_000, // $20k gain → $3k tax → $47k
        isAvailableForPurchase: true,
        isIlliquid:            false,
      },
    ];

    // 80,000 + 47,000 = 127,000
    const result = calculateAccessibleCapital(buckets, 0.15);
    expect(result).toBeCloseTo(127_000, 2);
  });
});

// ─── 8. getExpectedAnnualReturn — two-asset blend ────────────────────────────

describe('getExpectedAnnualReturn', () => {
  /**
   * Formula: (equityPct × aggressiveReturn) + ((1 − equityPct) × conservativeReturn)
   *
   * Given equityPct = 0.65, aggressive = 0.09, conservative = 0.04:
   *   (0.65 × 0.09) + (0.35 × 0.04) = 0.0585 + 0.014 = 0.0725  ✓
   */
  it('blends aggressiveReturn and conservativeReturn correctly at 65% equity', () => {
    const blend = getExpectedAnnualReturn(0.65, assumptions);
    // (0.65 × 0.09) + (0.35 × 0.04) = 0.0585 + 0.014 = 0.0725
    expect(blend).toBeCloseTo(0.0725, 6);
  });

  it('equals conservativeReturn at 0% equity', () => {
    const blend = getExpectedAnnualReturn(0, assumptions);
    expect(blend).toBeCloseTo(assumptions.conservativeReturn, 6);
  });

  it('equals aggressiveReturn at 100% equity', () => {
    const blend = getExpectedAnnualReturn(1, assumptions);
    expect(blend).toBeCloseTo(assumptions.aggressiveReturn, 6);
  });

  it('increases monotonically as equityPct increases', () => {
    const at25 = getExpectedAnnualReturn(0.25, assumptions);
    const at50 = getExpectedAnnualReturn(0.50, assumptions);
    const at75 = getExpectedAnnualReturn(0.75, assumptions);
    expect(at50).toBeGreaterThan(at25);
    expect(at75).toBeGreaterThan(at50);
  });

  it('does NOT use moderateReturn in its blend', () => {
    // If moderateReturn were used, changing it would change the result.
    // Verify the result is determined solely by aggressive + conservative.
    const base = getExpectedAnnualReturn(0.65, assumptions);
    const modifiedModerate: InvestmentAssumptions = {
      ...assumptions,
      moderateReturn: 0.999, // wildly different moderate return
    };
    const changed = getExpectedAnnualReturn(0.65, modifiedModerate);
    expect(changed).toBeCloseTo(base, 6);
  });
});
