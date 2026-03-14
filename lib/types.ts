// ─── Purchase Target ─────────────────────────────────────────────────────────

export interface PurchaseTarget {
  targetHomePrice: number;
  downPaymentPct: number;
  closingCostPct: number;
  postCloseReservePct: number;
  /** One-time cost for furniture, moving, and immediate repairs. */
  moveInCosts: number;
  targetMonthsFromNow: number;
}

// ─── Asset Buckets ────────────────────────────────────────────────────────────

export interface AssetBucket {
  id: string;
  label: string;
  balance: number;
  /** Used to calculate after-tax liquidation value for taxable brokerage accounts */
  costBasis: number;
  isAvailableForPurchase: boolean;
  isIlliquid: boolean;
}

// ─── Monthly Cash Flow ────────────────────────────────────────────────────────

export interface MonthlyCashFlow {
  grossIncome: number;
  monthlyHomeSavings: number;
  otherSavingsRate: number;
  annualIncomeGrowthRate: number;
  annualSavingsRateIncrease: number;
  /** Current rent payment that will disappear after purchase. */
  currentMonthlyRent: number;
  /** All non-housing recurring expenses: groceries, utilities, subscriptions, etc. */
  otherMonthlyExpenses: number;
}

// ─── Investment Assumptions ───────────────────────────────────────────────────

export interface InvestmentAssumptions {
  hysaYield: number;
  conservativeReturn: number;
  moderateReturn: number;
  aggressiveReturn: number;
  capitalGainsTaxRate: number;
  inflationRate: number;
  homePriceAppreciation: number;
}

// ─── Glide Path Settings ──────────────────────────────────────────────────────

export interface GlidePathSettings {
  mode: 'auto' | 'manual';
  /** Equity allocation as a decimal (0–1). Only used when mode is 'manual'. */
  manualEquityPct: number;
}

// ─── Mortgage Inputs ──────────────────────────────────────────────────────────

export interface MortgageInputs {
  interestRate: number;
  loanTermYears: number;
  annualPropertyTaxRate: number;
  annualInsurance: number;
  pmiRate: number;
}

// ─── Mortgage Payment Result ──────────────────────────────────────────────────

export interface MortgagePaymentResult {
  principalAndInterest: number;
  pmi: number;
  tax: number;
  insurance: number;
  total: number;
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppState {
  purchaseTarget: PurchaseTarget;
  assetBuckets: AssetBucket[];
  cashFlow: MonthlyCashFlow;
  assumptions: InvestmentAssumptions;
  glidePathSettings: GlidePathSettings;
  mortgageInputs: MortgageInputs;
  scenarioName: string;
}

// ─── Projection ───────────────────────────────────────────────────────────────

export interface ProjectionPoint {
  month: number;
  projectedBalance: number;
  savingsTarget: number;
  equityPct: number;
  expectedReturn: number;
}

// ─── Readiness Scorecard ──────────────────────────────────────────────────────

export interface ReadinessDimension {
  status: 'green' | 'amber' | 'red';
  label: string;
  message: string;
}

export interface ReadinessScore {
  capitalTrajectory: ReadinessDimension;
  savingsRate: ReadinessDimension;
  riskAlignment: ReadinessDimension;
  affordability: ReadinessDimension;
  reserveCushion: ReadinessDimension;
}

// ─── Scenario ─────────────────────────────────────────────────────────────────

export interface SavedScenario {
  id: string;
  name: string;
  state: AppState;
  createdAt: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Pre-configured asset buckets matching PRD section 2.2.
 * isAvailableForPurchase reflects the PRD defaults for each account type.
 */
export const DEFAULT_ASSET_BUCKETS: AssetBucket[] = [
  {
    id: 'cash-hysa',
    label: 'Cash / HYSA',
    balance: 0,
    costBasis: 0,
    isAvailableForPurchase: true,
    isIlliquid: false,
  },
  {
    id: 'taxable-brokerage',
    label: 'Taxable Brokerage',
    balance: 0,
    costBasis: 0,
    isAvailableForPurchase: true,
    isIlliquid: false,
  },
  {
    id: 'roth-ira',
    label: 'Roth IRA (contributions)',
    balance: 0,
    costBasis: 0,
    // Contributions are penalty-free; available by default, user can toggle off
    isAvailableForPurchase: true,
    isIlliquid: false,
  },
  {
    id: 'traditional-ira-401k',
    label: 'Traditional IRA / 401(k)',
    balance: 0,
    costBasis: 0,
    // Excluded by default — early withdrawal carries penalty
    isAvailableForPurchase: false,
    isIlliquid: false,
  },
  {
    id: 'other',
    label: 'Other / Real Estate',
    balance: 0,
    costBasis: 0,
    // User-defined; defaulting to unavailable due to illiquid flag
    isAvailableForPurchase: false,
    isIlliquid: true,
  },
];

/**
 * Default application state using the exact decimal values from CLAUDE.md.
 */
export const DEFAULT_STATE: AppState = {
  scenarioName: 'Base Case',

  purchaseTarget: {
    targetHomePrice: 500000,
    downPaymentPct: 0.20,
    closingCostPct: 0.03,
    postCloseReservePct: 0.02,
    moveInCosts: 10000,
    targetMonthsFromNow: 36,
  },

  assetBuckets: DEFAULT_ASSET_BUCKETS,

  cashFlow: {
    grossIncome: 0,
    monthlyHomeSavings: 0,
    otherSavingsRate: 0,
    annualIncomeGrowthRate: 0.03,
    annualSavingsRateIncrease: 0,
    currentMonthlyRent: 2000,
    otherMonthlyExpenses: 3000,
  },

  assumptions: {
    hysaYield: 0.045,
    conservativeReturn: 0.040,
    moderateReturn: 0.065,
    aggressiveReturn: 0.090,
    capitalGainsTaxRate: 0.15,
    inflationRate: 0.030,
    homePriceAppreciation: 0.035,
  },

  glidePathSettings: {
    mode: 'auto',
    // Default equity % for 36+ months horizon per CLAUDE.md glide path table
    manualEquityPct: 0.65,
  },

  mortgageInputs: {
    interestRate: 0.068,
    loanTermYears: 30,
    annualPropertyTaxRate: 0.011,
    annualInsurance: 2400,
    pmiRate: 0.008,
  },
};
