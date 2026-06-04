// Pure ROI domain logic. No React dependencies.

// ─── Constants ────────────────────────────────────────────────────────────────

export const PURCHASE_PRICE = 1_295_000;
export const PEAK_DAYS = 92;      // Jun (30) + Jul (31) + Aug (31)
export const OFFPEAK_DAYS = 273;  // remaining days

// ─── Input types ──────────────────────────────────────────────────────────────

export interface RoiInputs {
  purchasePrice: number;
  downPaymentPct: number;      // 0.20 = 20%
  mortgageRatePct: number;     // 0.055 = 5.5%
  amortizationYears: number;
  closingCostsPct: number;     // 0.025

  // STR (Suite 3 — upstairs + pool)
  peakNightlyRate: number;
  offPeakNightlyRate: number;
  peakOccupancy: number;       // 0.70
  offPeakOccupancy: number;    // 0.55
  platformFeePct: number;      // 0.05
  cleaningFeePerTurnover: number;
  avgStayNights: number;       // 2.5
  variableCostPerNight: number; // 40
  strUtilityMonthly: number;   // 350

  // LTR suites
  suite1Monthly: number;         // 2-bed basement
  suite2Monthly: number;         // 1-bed basement
  suite3LtrMonthly: number;      // upstairs (Option A only)
  ltrVacancyRate: number;        // 0.05 — no management fee

  // Fixed holding costs
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  maintenanceAnnual: number;
  managementFeePercent?: number;  // % of collected LTR rent; default 0
}

export const DEFAULT_INPUTS: RoiInputs = {
  purchasePrice: PURCHASE_PRICE,
  downPaymentPct: 0.20,
  mortgageRatePct: 0.055,
  amortizationYears: 25,
  closingCostsPct: 0.025,

  peakNightlyRate: 550,
  offPeakNightlyRate: 350,
  peakOccupancy: 0.70,
  offPeakOccupancy: 0.50,
  platformFeePct: 0.15,
  cleaningFeePerTurnover: 250,
  avgStayNights: 2.5,
  variableCostPerNight: 40,
  strUtilityMonthly: 350,

  suite1Monthly: 1_600,
  suite2Monthly: 1_400,
  suite3LtrMonthly: 3_200,
  ltrVacancyRate: 0.05,

  propertyTaxAnnual: 9_500,
  insuranceAnnual: 3_600,
  maintenanceAnnual: 5_500,
  managementFeePercent: 0,
};

// ─── Output types ─────────────────────────────────────────────────────────────

export interface LineItem {
  label: string;
  annual: number;
  isIncome: boolean;
  isSubtotal?: boolean;
}

export interface OptionResult {
  id: 'ltr' | 'hybrid';
  label: string;
  tagline: string;
  badge?: string;
  grossAnnual: number;
  vacancyLoss: number;
  strOpex: number;
  fixedOpex: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  cashOnCash: number;
  yearOnePrincipal: number;
  totalReturn: number;
  totalReturnPct: number;
  totalCashInvested: number;
  lines: LineItem[];
}

// ─── Core calculations ────────────────────────────────────────────────────────

export function calcMortgageMonthly(
  principal: number,
  annualRate: number,
  years: number,
): number {
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calcYearOnePrincipal(
  purchasePrice: number,
  downPaymentPct: number,
  annualRate: number,
  years: number,
): number {
  const loan = purchasePrice * (1 - downPaymentPct);
  const r = annualRate / 12;
  const payment = calcMortgageMonthly(loan, annualRate, years);
  let balance = loan;
  let principal = 0;
  for (let i = 0; i < 12; i++) {
    const interest = balance * r;
    const p = payment - interest;
    principal += p;
    balance -= p;
  }
  return principal;
}

function buildCommon(inp: RoiInputs) {
  const loanAmount = inp.purchasePrice * (1 - inp.downPaymentPct);
  const downPayment = inp.purchasePrice * inp.downPaymentPct;
  const closingCosts = inp.purchasePrice * inp.closingCostsPct;
  const totalCashInvested = downPayment + closingCosts;
  const mortgageMonthly = calcMortgageMonthly(loanAmount, inp.mortgageRatePct, inp.amortizationYears);
  const debtService = mortgageMonthly * 12;
  const fixedOpex = inp.propertyTaxAnnual + inp.insuranceAnnual + inp.maintenanceAnnual;
  const yearOnePrincipal = calcYearOnePrincipal(
    inp.purchasePrice, inp.downPaymentPct, inp.mortgageRatePct, inp.amortizationYears,
  );
  return { loanAmount, downPayment, closingCosts, totalCashInvested, debtService, fixedOpex, yearOnePrincipal };
}

function calcStrRevenue(inp: RoiInputs) {
  const peakOccupied = PEAK_DAYS * inp.peakOccupancy;
  const offPeakOccupied = OFFPEAK_DAYS * inp.offPeakOccupancy;
  const totalOccupied = peakOccupied + offPeakOccupied;
  const gross = peakOccupied * inp.peakNightlyRate + offPeakOccupied * inp.offPeakNightlyRate;
  const platformFees = gross * inp.platformFeePct;
  // Cleaning fee is charged to the guest at booking — net zero to owner, excluded from opex
  const variableCosts = totalOccupied * inp.variableCostPerNight;
  const utilities = inp.strUtilityMonthly * 12;
  const opex = platformFees + variableCosts + utilities;
  return { gross, platformFees, variableCosts, utilities, opex };
}

// ─── Option A — All Long-Term ─────────────────────────────────────────────────

export function calcLtrOption(inp: RoiInputs): OptionResult {
  const { totalCashInvested, debtService, fixedOpex, yearOnePrincipal } = buildCommon(inp);

  const grossAnnual = (inp.suite1Monthly + inp.suite2Monthly + inp.suite3LtrMonthly) * 12;
  const vacancyLoss = grossAnnual * inp.ltrVacancyRate;
  const collectedRent = grossAnnual - vacancyLoss;
  const mgmtFee = collectedRent * (inp.managementFeePercent ?? 0);
  const noi = collectedRent - mgmtFee - fixedOpex;
  const cashFlow = noi - debtService;
  const cashOnCash = cashFlow / totalCashInvested;
  const totalReturn = cashFlow + yearOnePrincipal;
  const totalReturnPct = totalReturn / totalCashInvested;

  const lines: LineItem[] = [
    { label: 'Suite 3 — upstairs + pool', annual: inp.suite3LtrMonthly * 12, isIncome: true },
    { label: 'Suite 1 — 2-bed basement', annual: inp.suite1Monthly * 12, isIncome: true },
    { label: 'Suite 2 — 1-bed basement', annual: inp.suite2Monthly * 12, isIncome: true },
    { label: `Vacancy (${(inp.ltrVacancyRate * 100).toFixed(0)}%)`, annual: -vacancyLoss, isIncome: false },
    ...(mgmtFee > 0 ? [{ label: `Management fee (${((inp.managementFeePercent ?? 0) * 100).toFixed(0)}% of collected)`, annual: -mgmtFee, isIncome: false }] : []),
    { label: 'Property tax', annual: -inp.propertyTaxAnnual, isIncome: false },
    { label: 'Insurance', annual: -inp.insuranceAnnual, isIncome: false },
    { label: 'Maintenance reserve', annual: -inp.maintenanceAnnual, isIncome: false },
    { label: 'Net Operating Income', annual: noi, isIncome: noi >= 0, isSubtotal: true },
    { label: 'Annual mortgage payments', annual: -debtService, isIncome: false },
    { label: 'Cash Flow', annual: cashFlow, isIncome: cashFlow >= 0, isSubtotal: true },
    { label: 'Year 1 principal paydown', annual: yearOnePrincipal, isIncome: true },
    { label: 'Total Return (incl. equity)', annual: totalReturn, isIncome: totalReturn >= 0, isSubtotal: true },
  ];

  return {
    id: 'ltr',
    label: 'Option A',
    tagline: 'All Long-Term (3 Suites)',
    grossAnnual,
    vacancyLoss,
    strOpex: 0,
    fixedOpex,
    noi,
    debtService,
    cashFlow,
    cashOnCash,
    yearOnePrincipal,
    totalReturn,
    totalReturnPct,
    totalCashInvested,
    lines,
  };
}

// ─── Option B — Hybrid ────────────────────────────────────────────────────────

export function calcHybridOption(inp: RoiInputs): OptionResult {
  const { totalCashInvested, debtService, fixedOpex, yearOnePrincipal } = buildCommon(inp);

  const ltrGross = (inp.suite1Monthly + inp.suite2Monthly) * 12;
  const ltrVacancyLoss = ltrGross * inp.ltrVacancyRate;
  const ltrCollected = ltrGross - ltrVacancyLoss;
  const mgmtFee = ltrCollected * (inp.managementFeePercent ?? 0);

  const str = calcStrRevenue(inp);

  const grossAnnual = ltrGross + str.gross;
  const vacancyLoss = ltrVacancyLoss;
  const strOpex = str.opex;
  const noi = grossAnnual - ltrVacancyLoss - mgmtFee - strOpex - fixedOpex;
  const cashFlow = noi - debtService;
  const cashOnCash = cashFlow / totalCashInvested;
  const totalReturn = cashFlow + yearOnePrincipal;
  const totalReturnPct = totalReturn / totalCashInvested;

  const lines: LineItem[] = [
    { label: 'Suite 3 — STR (Airbnb, upstairs + pool)', annual: str.gross, isIncome: true },
    { label: 'Suite 1 — 2-bed basement (guaranteed)', annual: inp.suite1Monthly * 12, isIncome: true },
    { label: 'Suite 2 — 1-bed basement (guaranteed)', annual: inp.suite2Monthly * 12, isIncome: true },
    { label: `LTR vacancy (${(inp.ltrVacancyRate * 100).toFixed(0)}%)`, annual: -ltrVacancyLoss, isIncome: false },
    ...(mgmtFee > 0 ? [{ label: `LTR management fee (${((inp.managementFeePercent ?? 0) * 100).toFixed(0)}% of collected)`, annual: -mgmtFee, isIncome: false }] : []),
    { label: `STR platform fee (${(inp.platformFeePct * 100).toFixed(0)}%)`, annual: -str.platformFees, isIncome: false },
    { label: 'Cleaning fee (guest-paid — net $0 to owner)', annual: 0, isIncome: false },
    { label: 'Variable costs', annual: -str.variableCosts, isIncome: false },
    { label: 'STR utilities', annual: -str.utilities, isIncome: false },
    { label: 'Property tax', annual: -inp.propertyTaxAnnual, isIncome: false },
    { label: 'Insurance', annual: -inp.insuranceAnnual, isIncome: false },
    { label: 'Maintenance reserve', annual: -inp.maintenanceAnnual, isIncome: false },
    { label: 'Net Operating Income', annual: noi, isIncome: noi >= 0, isSubtotal: true },
    { label: 'Annual mortgage payments', annual: -debtService, isIncome: false },
    { label: 'Cash Flow', annual: cashFlow, isIncome: cashFlow >= 0, isSubtotal: true },
    { label: 'Year 1 principal paydown', annual: yearOnePrincipal, isIncome: true },
    { label: 'Total Return (incl. equity)', annual: totalReturn, isIncome: totalReturn >= 0, isSubtotal: true },
  ];

  return {
    id: 'hybrid',
    label: 'Option B',
    tagline: 'Hybrid (Basements LTR + Upstairs STR)',
    badge: 'Recommended',
    grossAnnual,
    vacancyLoss,
    strOpex,
    fixedOpex,
    noi,
    debtService,
    cashFlow,
    cashOnCash,
    yearOnePrincipal,
    totalReturn,
    totalReturnPct,
    totalCashInvested,
    lines,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function fmtCAD(n: number, decimals = 0): string {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  return n < 0 ? `(${formatted})` : formatted;
}

export function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}
