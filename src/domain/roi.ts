// Pure ROI domain logic. No React dependencies.

// ─── Constants ────────────────────────────────────────────────────────────────

export const PEAK_DAYS = 92;         // Jun (30) + Jul (31) + Aug (31)
export const OFFPEAK_DAYS = 273;     // remaining 273 days

// ─── Input types ──────────────────────────────────────────────────────────────

export interface RoiInputs {
  purchasePrice: number;
  downPaymentPct: number;      // 0.20 = 20%
  mortgageRatePct: number;     // 0.055 = 5.5%
  amortizationYears: number;

  // STR (main floor: 4BR + den)
  peakNightlyRate: number;
  offPeakNightlyRate: number;
  peakOccupancy: number;       // 0.70
  offPeakOccupancy: number;    // 0.55
  platformFeePct: number;      // 0.05
  cleaningFeePerTurnover: number;
  avgStayNights: number;
  variableCostPerNight: number;
  strUtilityMonthly: number;

  // LTR suites
  suite1Monthly: number;       // 2-bed legal suite
  suite2Monthly: number;       // 1-bed in-law suite
  mainFloorLtrMonthly: number; // 4BR + den if rented LTR
  ltrVacancyRate: number;      // 0.05
  ltrMgmtFeePct: number;       // 0.08

  // Fixed holding costs
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  maintenanceAnnual: number;
  closingCostsPct: number;     // 0.025
}

export const DEFAULT_INPUTS: RoiInputs = {
  purchasePrice: 1_295_000,
  downPaymentPct: 0.20,
  mortgageRatePct: 0.055,
  amortizationYears: 25,

  peakNightlyRate: 575,
  offPeakNightlyRate: 450,
  peakOccupancy: 0.70,
  offPeakOccupancy: 0.55,
  platformFeePct: 0.05,
  cleaningFeePerTurnover: 225,
  avgStayNights: 2.5,
  variableCostPerNight: 40,
  strUtilityMonthly: 350,

  suite1Monthly: 1_600,
  suite2Monthly: 1_400,
  mainFloorLtrMonthly: 3_200,
  ltrVacancyRate: 0.05,
  ltrMgmtFeePct: 0.08,

  propertyTaxAnnual: 9_500,
  insuranceAnnual: 3_600,
  maintenanceAnnual: 5_500,
  closingCostsPct: 0.025,
};

// ─── Output types ─────────────────────────────────────────────────────────────

export interface LineItem {
  label: string;
  annual: number;
  isIncome: boolean;
  isSubtotal?: boolean;
}

export interface OptionResult {
  id: 'str' | 'hybrid' | 'ltr';
  label: string;
  description: string;
  badge?: string;
  grossAnnual: number;
  opexAnnual: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  capRate: number;
  cashOnCash: number;
  totalCashInvested: number;
  lines: LineItem[];
}

// ─── Core calculations ────────────────────────────────────────────────────────

function mortgagePaymentMonthly(principal: number, annualRate: number, years: number): number {
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 12;
  const n = years * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

interface StrRevenue {
  gross: number;
  platformFees: number;
  cleaningCosts: number;
  variableCosts: number;
  utilities: number;
  opex: number;
  noi: number;
}

function calcStrRevenue(inp: RoiInputs): StrRevenue {
  const peakOccupied = PEAK_DAYS * inp.peakOccupancy;
  const offPeakOccupied = OFFPEAK_DAYS * inp.offPeakOccupancy;
  const totalOccupied = peakOccupied + offPeakOccupied;

  const gross =
    peakOccupied * inp.peakNightlyRate +
    offPeakOccupied * inp.offPeakNightlyRate;

  const platformFees = gross * inp.platformFeePct;
  const turnovers = totalOccupied / inp.avgStayNights;
  const cleaningCosts = turnovers * inp.cleaningFeePerTurnover;
  const variableCosts = totalOccupied * inp.variableCostPerNight;
  const utilities = inp.strUtilityMonthly * 12;
  const opex = platformFees + cleaningCosts + variableCosts + utilities;

  return { gross, platformFees, cleaningCosts, variableCosts, utilities, opex, noi: gross - opex };
}

interface LtrRevenue {
  gross: number;
  vacancyLoss: number;
  mgmtFees: number;
  opex: number;
  noi: number;
}

function calcLtrUnit(monthlyRent: number, inp: RoiInputs): LtrRevenue {
  const gross = monthlyRent * 12;
  const vacancyLoss = gross * inp.ltrVacancyRate;
  const effective = gross - vacancyLoss;
  const mgmtFees = effective * inp.ltrMgmtFeePct;
  const opex = vacancyLoss + mgmtFees;
  return { gross, vacancyLoss, mgmtFees, opex, noi: gross - opex };
}

// ─── Option builders ──────────────────────────────────────────────────────────

function buildCommon(inp: RoiInputs) {
  const loanAmount = inp.purchasePrice * (1 - inp.downPaymentPct);
  const downPayment = inp.purchasePrice * inp.downPaymentPct;
  const closingCosts = inp.purchasePrice * inp.closingCostsPct;
  const totalCashInvested = downPayment + closingCosts;
  const mortgageMonthly = mortgagePaymentMonthly(loanAmount, inp.mortgageRatePct, inp.amortizationYears);
  const debtService = mortgageMonthly * 12;
  const fixedOpex = inp.propertyTaxAnnual + inp.insuranceAnnual + inp.maintenanceAnnual;
  return { loanAmount, downPayment, closingCosts, totalCashInvested, debtService, fixedOpex };
}

export function calcStrOption(inp: RoiInputs): OptionResult {
  const { totalCashInvested, debtService, fixedOpex } = buildCommon(inp);
  const str = calcStrRevenue(inp);
  const totalOpex = str.opex + fixedOpex;
  const noi = str.gross - totalOpex;
  const cashFlow = noi - debtService;
  const capRate = noi / inp.purchasePrice;
  const cashOnCash = cashFlow / totalCashInvested;

  const lines: LineItem[] = [
    { label: 'STR gross revenue', annual: str.gross, isIncome: true },
    { label: 'Platform fees (5%)', annual: -str.platformFees, isIncome: false },
    { label: 'Cleaning fees', annual: -str.cleaningCosts, isIncome: false },
    { label: 'Variable costs ($40/night)', annual: -str.variableCosts, isIncome: false },
    { label: 'Utilities', annual: -str.utilities, isIncome: false },
    { label: 'Property tax', annual: -inp.propertyTaxAnnual, isIncome: false },
    { label: 'Insurance', annual: -inp.insuranceAnnual, isIncome: false },
    { label: 'Maintenance reserve', annual: -inp.maintenanceAnnual, isIncome: false },
    { label: 'Net Operating Income', annual: noi, isIncome: true, isSubtotal: true },
    { label: 'Mortgage payments', annual: -debtService, isIncome: false },
    { label: 'Annual cash flow', annual: cashFlow, isIncome: cashFlow >= 0, isSubtotal: true },
  ];

  return {
    id: 'str',
    label: 'Option C — STR Only (Upstairs)',
    description: 'Suite 3 (upstairs with pool, 4 BR + den) as STR. Suites 1 & 2 vacant.',
    grossAnnual: str.gross,
    opexAnnual: totalOpex,
    noi,
    debtService,
    cashFlow,
    capRate,
    cashOnCash,
    totalCashInvested,
    lines,
  };
}

export function calcHybridOption(inp: RoiInputs): OptionResult {
  const { totalCashInvested, debtService, fixedOpex } = buildCommon(inp);
  const str = calcStrRevenue(inp);
  const s1 = calcLtrUnit(inp.suite1Monthly, inp);
  const s2 = calcLtrUnit(inp.suite2Monthly, inp);

  const grossAnnual = str.gross + s1.gross + s2.gross;
  const totalOpex = str.opex + s1.opex + s2.opex + fixedOpex;
  const noi = grossAnnual - totalOpex;
  const cashFlow = noi - debtService;
  const capRate = noi / inp.purchasePrice;
  const cashOnCash = cashFlow / totalCashInvested;

  const lines: LineItem[] = [
    { label: 'Suite 3 STR revenue (upstairs + pool)', annual: str.gross, isIncome: true },
    { label: 'Suite 1 rent (2-bed, LTR)', annual: s1.gross, isIncome: true },
    { label: 'Suite 2 rent (1-bed, LTR)', annual: s2.gross, isIncome: true },
    { label: 'Platform fees (5%)', annual: -str.platformFees, isIncome: false },
    { label: 'Cleaning fees', annual: -str.cleaningCosts, isIncome: false },
    { label: 'Variable costs', annual: -str.variableCosts, isIncome: false },
    { label: 'STR utilities', annual: -str.utilities, isIncome: false },
    { label: 'LTR vacancy (5%)', annual: -(s1.vacancyLoss + s2.vacancyLoss), isIncome: false },
    { label: 'LTR management (8%)', annual: -(s1.mgmtFees + s2.mgmtFees), isIncome: false },
    { label: 'Property tax', annual: -inp.propertyTaxAnnual, isIncome: false },
    { label: 'Insurance', annual: -inp.insuranceAnnual, isIncome: false },
    { label: 'Maintenance reserve', annual: -inp.maintenanceAnnual, isIncome: false },
    { label: 'Net Operating Income', annual: noi, isIncome: true, isSubtotal: true },
    { label: 'Mortgage payments', annual: -debtService, isIncome: false },
    { label: 'Annual cash flow', annual: cashFlow, isIncome: cashFlow >= 0, isSubtotal: true },
  ];

  return {
    id: 'hybrid',
    label: 'Option B — Hybrid (Basements LTR + Upstairs STR)',
    description: 'Suite 1 + Suite 2 on long-term leases. Suite 3 (upstairs with pool) as STR.',
    badge: 'Recommended',
    grossAnnual,
    opexAnnual: totalOpex,
    noi,
    debtService,
    cashFlow,
    capRate,
    cashOnCash,
    totalCashInvested,
    lines,
  };
}

export function calcLtrOption(inp: RoiInputs): OptionResult {
  const { totalCashInvested, debtService, fixedOpex } = buildCommon(inp);
  const main = calcLtrUnit(inp.mainFloorLtrMonthly, inp);
  const s1 = calcLtrUnit(inp.suite1Monthly, inp);
  const s2 = calcLtrUnit(inp.suite2Monthly, inp);

  const grossAnnual = main.gross + s1.gross + s2.gross;
  const totalOpex = main.opex + s1.opex + s2.opex + fixedOpex;
  const noi = grossAnnual - totalOpex;
  const cashFlow = noi - debtService;
  const capRate = noi / inp.purchasePrice;
  const cashOnCash = cashFlow / totalCashInvested;

  const lines: LineItem[] = [
    { label: 'Suite 3 rent (upstairs + pool, LTR)', annual: main.gross, isIncome: true },
    { label: 'Suite 1 rent (2-bed, LTR)', annual: s1.gross, isIncome: true },
    { label: 'Suite 2 rent (1-bed, LTR)', annual: s2.gross, isIncome: true },
    { label: 'Vacancy (5% all units)', annual: -(main.vacancyLoss + s1.vacancyLoss + s2.vacancyLoss), isIncome: false },
    { label: 'Management fees (8%)', annual: -(main.mgmtFees + s1.mgmtFees + s2.mgmtFees), isIncome: false },
    { label: 'Property tax', annual: -inp.propertyTaxAnnual, isIncome: false },
    { label: 'Insurance', annual: -inp.insuranceAnnual, isIncome: false },
    { label: 'Maintenance reserve', annual: -inp.maintenanceAnnual, isIncome: false },
    { label: 'Net Operating Income', annual: noi, isIncome: true, isSubtotal: true },
    { label: 'Mortgage payments', annual: -debtService, isIncome: false },
    { label: 'Annual cash flow', annual: cashFlow, isIncome: cashFlow >= 0, isSubtotal: true },
  ];

  return {
    id: 'ltr',
    label: 'Option A — Full Long-Term',
    description: 'All 3 suites on long-term leases. Lowest effort, most predictable income.',
    grossAnnual,
    opexAnnual: totalOpex,
    noi,
    debtService,
    cashFlow,
    capRate,
    cashOnCash,
    totalCashInvested,
    lines,
  };
}

export function calcAllOptions(inp: RoiInputs): OptionResult[] {
  return [calcLtrOption(inp), calcHybridOption(inp), calcStrOption(inp)];
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
