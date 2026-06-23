// Pure ROI domain logic for the three Investment ROI Sheet calculators.
// No React dependencies. Reuses the shared mortgage + formatting helpers
// from ./roi so all math lives in one tested place.

import {
  PURCHASE_PRICE,
  calcMortgageMonthly,
  calcYearOnePrincipal,
} from './roi';

export { PURCHASE_PRICE, fmtCAD, fmtPct } from './roi';

// ─── Shared financing (single source of truth) ────────────────────────────────

export interface Financing {
  purchasePrice: number;
  downPaymentPct: number;   // 0.20 = 20%
  mortgageRatePct: number;  // 0.055 = 5.5%
  amortizationYears: number;
  closingCostsPct: number;  // 0.025 = 2.5%
}

export const DEFAULT_FINANCING: Financing = {
  purchasePrice: PURCHASE_PRICE,
  downPaymentPct: 0.20,
  mortgageRatePct: 0.055,
  amortizationYears: 25,
  closingCostsPct: 0.025,
};

export interface FinancingDerived {
  loanAmount: number;
  downPayment: number;
  closingCosts: number;
  totalCashInvested: number;
  mortgageMonthly: number;
  debtServiceAnnual: number;
  yearOnePrincipal: number;
}

export function deriveFinancing(f: Financing): FinancingDerived {
  const loanAmount = f.purchasePrice * (1 - f.downPaymentPct);
  const downPayment = f.purchasePrice * f.downPaymentPct;
  const closingCosts = f.purchasePrice * f.closingCostsPct;
  const totalCashInvested = downPayment + closingCosts;
  const mortgageMonthly = calcMortgageMonthly(loanAmount, f.mortgageRatePct, f.amortizationYears);
  const debtServiceAnnual = mortgageMonthly * 12;
  const yearOnePrincipal = calcYearOnePrincipal(
    f.purchasePrice, f.downPaymentPct, f.mortgageRatePct, f.amortizationYears,
  );
  return {
    loanAmount, downPayment, closingCosts, totalCashInvested,
    mortgageMonthly, debtServiceAnnual, yearOnePrincipal,
  };
}

/**
 * Remaining loan balance after `years` of level payments, plus cumulative
 * principal paid down over that span.
 */
export function calcPrincipalPaidOverYears(
  loanAmount: number,
  annualRate: number,
  amortYears: number,
  holdYears: number,
): { principalPaid: number; remainingBalance: number } {
  const payment = calcMortgageMonthly(loanAmount, annualRate, amortYears);
  const r = annualRate / 12;
  const months = Math.min(holdYears, amortYears) * 12;
  let balance = loanAmount;
  for (let i = 0; i < months; i++) {
    const interest = balance * r;
    balance -= payment - interest;
  }
  if (balance < 0) balance = 0;
  return { principalPaid: loanAmount - balance, remainingBalance: balance };
}

// ─── Calculator 1 — Family Estate (basement suite income) ──────────────────────

export interface FamilyEstateInputs {
  suiteRentMonthly: number;   // 3800
  vacancyPct: number;         // 0.05
  operatingExpensePct: number; // 0.08 of gross rent
}

export const DEFAULT_FAMILY_ESTATE: FamilyEstateInputs = {
  suiteRentMonthly: 3_800,
  vacancyPct: 0.05,
  operatingExpensePct: 0.08,
};

export interface FamilyEstateResult {
  grossAnnualRent: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  annualNOI: number;
  capRate: number;            // NOI / purchase price
  debtServiceAnnual: number;
  annualCashFlow: number;
  netMonthlyCashFlow: number;
  cashOnCash: number;         // annual cash flow / total cash invested
  totalCashInvested: number;
}

export function calcFamilyEstate(inp: FamilyEstateInputs, f: Financing): FamilyEstateResult {
  const d = deriveFinancing(f);
  const grossAnnualRent = inp.suiteRentMonthly * 12;
  const vacancyLoss = grossAnnualRent * inp.vacancyPct;
  const effectiveGrossIncome = grossAnnualRent - vacancyLoss;
  const operatingExpenses = grossAnnualRent * inp.operatingExpensePct;
  const annualNOI = effectiveGrossIncome - operatingExpenses;
  const capRate = annualNOI / f.purchasePrice;
  const annualCashFlow = annualNOI - d.debtServiceAnnual;
  const netMonthlyCashFlow = annualCashFlow / 12;
  const cashOnCash = annualCashFlow / d.totalCashInvested;
  return {
    grossAnnualRent, vacancyLoss, effectiveGrossIncome, operatingExpenses,
    annualNOI, capRate, debtServiceAnnual: d.debtServiceAnnual,
    annualCashFlow, netMonthlyCashFlow, cashOnCash,
    totalCashInvested: d.totalCashInvested,
  };
}

// ─── Calculator 2 — Cash Cow (multiple revenue streams) ────────────────────────

export interface RevenueStream {
  key: string;
  label: string;
  monthly: number;
  enabled: boolean;
}

export const DEFAULT_CASH_COW_STREAMS: RevenueStream[] = [
  { key: 'basement', label: 'Basement suite',            monthly: 3_800, enabled: true },
  { key: 'str',      label: 'STR — 2 spare bedrooms',    monthly: 2_500, enabled: true },
  { key: 'rv',       label: 'RV pad rental',             monthly: 400,   enabled: true },
  { key: 'detached', label: 'Detached / pool-house',     monthly: 900,   enabled: true },
];

export interface CashCowInputs {
  streams: RevenueStream[];
  vacancyPct: number;          // 0.05
  operatingExpensePct: number; // 0.08 of gross
}

export const DEFAULT_CASH_COW: CashCowInputs = {
  streams: DEFAULT_CASH_COW_STREAMS,
  vacancyPct: 0.05,
  operatingExpensePct: 0.08,
};

export interface CashCowResult {
  blendedGrossMonthly: number;
  totalAnnualRevenue: number;
  vacancyLoss: number;
  operatingExpenses: number;
  annualNOI: number;
  debtServiceAnnual: number;
  combinedAnnualCashFlow: number;
  combinedMonthlyCashFlow: number;
  effectiveRoi: number;        // cash-on-cash on invested capital
  totalCashInvested: number;
}

export function calcCashCow(inp: CashCowInputs, f: Financing): CashCowResult {
  const d = deriveFinancing(f);
  const blendedGrossMonthly = inp.streams
    .filter(s => s.enabled)
    .reduce((sum, s) => sum + s.monthly, 0);
  const totalAnnualRevenue = blendedGrossMonthly * 12;
  const vacancyLoss = totalAnnualRevenue * inp.vacancyPct;
  const operatingExpenses = totalAnnualRevenue * inp.operatingExpensePct;
  const annualNOI = totalAnnualRevenue - vacancyLoss - operatingExpenses;
  const combinedAnnualCashFlow = annualNOI - d.debtServiceAnnual;
  const combinedMonthlyCashFlow = combinedAnnualCashFlow / 12;
  const effectiveRoi = combinedAnnualCashFlow / d.totalCashInvested;
  return {
    blendedGrossMonthly, totalAnnualRevenue, vacancyLoss, operatingExpenses,
    annualNOI, debtServiceAnnual: d.debtServiceAnnual,
    combinedAnnualCashFlow, combinedMonthlyCashFlow, effectiveRoi,
    totalCashInvested: d.totalCashInvested,
  };
}

// ─── Calculator 3 — Appreciation & Equity (long-term ROI) ──────────────────────

export interface AppreciationInputs {
  annualAppreciationPct: number; // 0.04
  holdYears: number;             // 10
  annualRentGrowthPct: number;   // 0.03
  year1AnnualCashFlow: number;   // seeded from Cash Cow combined cash flow
}

export const DEFAULT_APPRECIATION: AppreciationInputs = {
  annualAppreciationPct: 0.04,
  holdYears: 10,
  annualRentGrowthPct: 0.03,
  year1AnnualCashFlow: 0, // set live from Cash Cow result
};

export interface AppreciationResult {
  projectedValue: number;
  appreciationGain: number;
  principalPaid: number;
  remainingBalance: number;
  equityBuilt: number;          // appreciation gain + principal paid down
  totalEquityAtSale: number;    // projected value - remaining balance
  cumulativeCashFlow: number;
  totalReturn: number;          // equity built + cumulative cash flow
  totalProceeds: number;        // total equity at sale + cumulative cash flow
  annualizedRoi: number;        // CAGR on invested capital
  totalCashInvested: number;
}

export function calcAppreciation(inp: AppreciationInputs, f: Financing): AppreciationResult {
  const d = deriveFinancing(f);
  const projectedValue = f.purchasePrice * Math.pow(1 + inp.annualAppreciationPct, inp.holdYears);
  const appreciationGain = projectedValue - f.purchasePrice;

  const { principalPaid, remainingBalance } = calcPrincipalPaidOverYears(
    d.loanAmount, f.mortgageRatePct, f.amortizationYears, inp.holdYears,
  );

  const equityBuilt = appreciationGain + principalPaid;
  const totalEquityAtSale = projectedValue - remainingBalance;

  // Cumulative cash flow with rent (income) growth compounding each year.
  let cumulativeCashFlow = 0;
  for (let yr = 0; yr < inp.holdYears; yr++) {
    cumulativeCashFlow += inp.year1AnnualCashFlow * Math.pow(1 + inp.annualRentGrowthPct, yr);
  }

  const totalReturn = equityBuilt + cumulativeCashFlow;
  const totalProceeds = totalEquityAtSale + cumulativeCashFlow;
  const annualizedRoi = d.totalCashInvested > 0
    ? Math.pow(totalProceeds / d.totalCashInvested, 1 / inp.holdYears) - 1
    : 0;

  return {
    projectedValue, appreciationGain, principalPaid, remainingBalance,
    equityBuilt, totalEquityAtSale, cumulativeCashFlow,
    totalReturn, totalProceeds, annualizedRoi,
    totalCashInvested: d.totalCashInvested,
  };
}
