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
 *              compounding over 24 months is ~$160,860.
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
  calculateTotalCapitalNeeded,
  generateProjection,
  getExpectedAnnualReturn,
  getGlidePathEquityPct,
} from '@/lib/calculations';

import type {
  AppState,
  AssetBucket,
  GlidePathSettings,
  InvestmentAssumptions,
  PurchaseTarget,
} from '@/lib/types';

// ─── Shared fixtures (CLAUDE.md example inputs) ───────────────────────────────

const purchaseTarget: PurchaseTarget = {
  targetHomePrice:      600_000,
  downPaymentPct:       0.20,
  closingCostPct:       0.03,
  postCloseReservePct:  0.02,
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
  cashFlow: {
    grossIncome:               120_000,
    monthlyHomeSavings:        3_000,
    otherSavingsRate:          0,
    annualIncomeGrowthRate:    0.03,
    annualSavingsRateIncrease: 0,
  },
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

// ─── 1. calculateTotalCapitalNeeded ──────────────────────────────────────────

describe('calculateTotalCapitalNeeded', () => {
  /**
   * Formula: adjustedPrice = homePrice × (1 + appreciation/12)^months
   *          total = adjustedPrice × (down + closing + reserve)
   *
   * At 24 months with 3.5% annual appreciation (monthly compounding):
   *   adjustedPrice = 600,000 × (1 + 0.035/12)^24 ≈ 643,439
   *   total         = 643,439 × 0.25               ≈ 160,860
   *
   * CLAUDE.md example states ~$155,700. That figure corresponds to
   * approximately one year of appreciation rather than two; the tests
   * here validate the correct 24-month formula output.
   */
  it('returns ~$160,860 for the example inputs at month 24', () => {
    const result = calculateTotalCapitalNeeded(purchaseTarget, assumptions, 24);

    // Correct formula value — within $500 for floating-point rounding
    expect(result).toBeGreaterThanOrEqual(160_360);
    expect(result).toBeLessThanOrEqual(161_360);
  });

  it('uses targetMonthsFromNow as default when atMonthsFromNow is omitted', () => {
    const explicit = calculateTotalCapitalNeeded(purchaseTarget, assumptions, 24);
    const defaulted = calculateTotalCapitalNeeded(purchaseTarget, assumptions);
    expect(explicit).toBeCloseTo(defaulted, 5);
  });

  it('returns more capital needed at 36 months than at 24 months (appreciation grows the goal)', () => {
    const at24 = calculateTotalCapitalNeeded(purchaseTarget, assumptions, 24);
    const at36 = calculateTotalCapitalNeeded(purchaseTarget, assumptions, 36);
    expect(at36).toBeGreaterThan(at24);
  });

  it('returns exactly homePrice × percentages with zero appreciation and zero months', () => {
    const flatAssumptions: InvestmentAssumptions = {
      ...assumptions,
      homePriceAppreciation: 0,
    };
    const result = calculateTotalCapitalNeeded(purchaseTarget, flatAssumptions, 0);
    // 600,000 × 0.25 = 150,000
    expect(result).toBeCloseTo(150_000, 2);
  });
});

// ─── 2. generateProjection — array length ────────────────────────────────────

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

// ─── 3. generateProjection — month 24 balance ────────────────────────────────

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

// ─── 4. getGlidePathEquityPct — auto tier boundaries ─────────────────────────

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

// ─── 5. calculateAccessibleCapital — capital gains tax ───────────────────────

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

// ─── 6. getExpectedAnnualReturn — two-asset blend ────────────────────────────

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
