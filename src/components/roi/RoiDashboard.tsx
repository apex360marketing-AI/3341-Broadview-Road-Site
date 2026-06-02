import { useState } from 'react';
import {
  PURCHASE_PRICE, PEAK_DAYS, OFFPEAK_DAYS, DEFAULT_INPUTS,
  calcLtrOption, calcHybridOption,
  calcMortgageMonthly, calcYearOnePrincipal,
  fmtCAD, fmtPct,
} from '../../domain/roi';
import type { OptionResult, LineItem } from '../../domain/roi';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  teal:    '#5BC2C2',
  tealFg:  '#1a8f8f',
  tealBg:  '#f0fbfb',
  green:   '#16a34a',
  greenBg: '#f0fdf4',
  red:     '#dc2626',
  blue:    '#2563eb',
  blueBg:  '#eff6ff',
  ink:     '#111111',
  body:    '#374151',
  muted:   '#6b7280',
  label:   '#9ca3af',
  border:  '#e9e8e4',
  surface: '#ffffff',
  page:    '#F8F7F4',
};

const FF = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Shared input primitives ──────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
      {children}
    </div>
  );
}

function NumInput({
  value, onChange, min, max, step = 1, prefix, suffix, wide,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  prefix?: string; suffix?: string; wide?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {prefix && <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>{prefix}</span>}
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
        style={{
          width: wide ? 120 : 82,
          padding: '7px 9px',
          border: `1px solid ${T.border}`,
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          color: T.ink,
          background: '#fafaf9',
          fontFamily: FF,
          outline: 'none',
        }}
      />
      {suffix && <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>{suffix}</span>}
    </div>
  );
}

function InlineField({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: T.body }}>{label}</span>
      {children}
    </div>
  );
}

function Pills({
  options, value, onChange,
}: { options: { label: string; value: number }[]; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: value === o.value ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
          background: value === o.value ? T.tealBg : T.surface,
          color: value === o.value ? T.tealFg : T.body,
          fontWeight: value === o.value ? 600 : 400,
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: FF,
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section containers ───────────────────────────────────────────────────────

function SectionBox({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: accent ?? T.label, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {title}
      </div>
      <div style={{
        background: '#fafaf9', border: `1px solid ${T.border}`,
        borderRadius: 8, padding: '12px 14px',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Result rows in the P&L breakdown ────────────────────────────────────────

function PLRow({ line }: { line: LineItem }) {
  const isEquity = line.label.includes('principal');
  const color = line.isSubtotal
    ? (line.annual >= 0 ? T.green : T.red)
    : isEquity ? T.blue
    : (line.isIncome ? T.ink : T.muted);

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: line.isSubtotal ? '9px 0' : '5px 0',
      borderTop: line.isSubtotal ? `1px solid ${T.border}` : undefined,
      marginTop: line.isSubtotal ? 4 : 0,
    }}>
      <span style={{
        fontSize: line.isSubtotal ? 13 : 12,
        fontWeight: line.isSubtotal ? 700 : 400,
        color: line.isSubtotal ? T.ink : T.body,
      }}>
        {line.label}
      </span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: line.isSubtotal ? 14 : 12, fontWeight: line.isSubtotal ? 700 : 400, color, fontVariantNumeric: 'tabular-nums' }}>
          {fmtCAD(line.annual)}
        </span>
        <span style={{ fontSize: 10, color: T.label, marginLeft: 4 }}>
          {fmtCAD(line.annual / 12)}/mo
        </span>
      </div>
    </div>
  );
}

// ─── Return summary at the bottom of each card ───────────────────────────────

function ReturnPanel({
  cashFlow, cashOnCash, yearOnePrincipal, totalReturn, totalReturnPct,
}: Pick<OptionResult, 'cashFlow' | 'cashOnCash' | 'yearOnePrincipal' | 'totalReturn' | 'totalReturnPct'>) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
      {/* Without equity */}
      <div style={{
        background: cashFlow >= 0 ? T.greenBg : '#fef2f2',
        border: `1px solid ${cashFlow >= 0 ? '#bbf7d0' : '#fecaca'}`,
        borderRadius: 8, padding: '14px 16px',
      }}>
        <div
          title="Annual pre-tax cash flow divided by total cash invested, excluding principal paydown."
          style={{ fontSize: 11, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, cursor: 'help' }}
        >
          Cash-on-Cash (Cash Flow Only)
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: cashFlow >= 0 ? T.green : T.red, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {fmtPct(cashOnCash)}
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
          {fmtCAD(cashFlow)}/yr &nbsp;·&nbsp; {fmtCAD(cashFlow / 12)}/mo
        </div>
      </div>

      {/* With equity */}
      <div style={{
        background: totalReturn >= 0 ? T.blueBg : '#fef2f2',
        border: `1px solid ${totalReturn >= 0 ? '#bfdbfe' : '#fecaca'}`,
        borderRadius: 8, padding: '14px 16px',
      }}>
        <div
          title="Annual pre-tax cash flow plus first-year principal reduction, divided by total cash invested."
          style={{ fontSize: 11, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, cursor: 'help' }}
        >
          Cash-on-Cash (Cash Flow + Year 1 Principal)
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: totalReturn >= 0 ? T.blue : T.red, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {fmtPct(totalReturnPct)}
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
          +{fmtCAD(yearOnePrincipal)}/yr equity built
        </div>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function RoiDashboard() {
  // ── Shared mortgage inputs ─────────────────────────────────────────────────
  const [downPct,    setDownPct]    = useState(20);
  const [mRate,      setMRate]      = useState(5.5);
  const [amortYrs,   setAmortYrs]   = useState(25);
  const [propTax,    setPropTax]    = useState(9_500);
  const [insurance,  setInsurance]  = useState(3_600);
  const [maint,      setMaint]      = useState(5_500);
  const [mgmtFee,    setMgmtFee]    = useState(0);

  // ── Option A: All LTR ─────────────────────────────────────────────────────
  const [aS1,      setAS1]      = useState(1_600);
  const [aS2,      setAS2]      = useState(1_400);
  const [aS3,      setAS3]      = useState(3_200);
  const [aVac,     setAVac]     = useState(5);

  // ── Option B: Hybrid ──────────────────────────────────────────────────────
  const [bS1,      setBS1]      = useState(1_600);
  const [bS2,      setBS2]      = useState(1_400);
  const [bPeak,    setBPeak]    = useState(575);
  const [bOff,     setBOff]     = useState(450);
  const [bPeakOcc, setBPeakOcc] = useState(70);
  const [bOffOcc,  setBOffOcc]  = useState(55);
  const [bVac,     setBVac]     = useState(5);
  const [bPlatform,setBPlatform]= useState(5);
  const [bCleaning,setBCleaning]= useState(225);

  const [showBreakdownA, setShowBreakdownA] = useState(false);
  const [showBreakdownB, setShowBreakdownB] = useState(false);

  // ── Derived shared values ─────────────────────────────────────────────────
  const loanAmount     = PURCHASE_PRICE * (1 - downPct / 100);
  const downPayment    = PURCHASE_PRICE * (downPct / 100);
  const closingCosts   = PURCHASE_PRICE * 0.025;
  const totalCash      = downPayment + closingCosts;
  const mortgageMonthly = calcMortgageMonthly(loanAmount, mRate / 100, amortYrs);
  const yr1Principal   = calcYearOnePrincipal(PURCHASE_PRICE, downPct / 100, mRate / 100, amortYrs);

  // ── Build option results ──────────────────────────────────────────────────
  const optA = calcLtrOption({
    ...DEFAULT_INPUTS,
    downPaymentPct: downPct / 100,
    mortgageRatePct: mRate / 100,
    amortizationYears: amortYrs,
    propertyTaxAnnual: propTax,
    insuranceAnnual: insurance,
    maintenanceAnnual: maint,
    managementFeePercent: mgmtFee / 100,
    suite1Monthly: aS1,
    suite2Monthly: aS2,
    suite3LtrMonthly: aS3,
    ltrVacancyRate: aVac / 100,
  });

  const optB = calcHybridOption({
    ...DEFAULT_INPUTS,
    downPaymentPct: downPct / 100,
    mortgageRatePct: mRate / 100,
    amortizationYears: amortYrs,
    propertyTaxAnnual: propTax,
    insuranceAnnual: insurance,
    maintenanceAnnual: maint,
    managementFeePercent: mgmtFee / 100,
    suite1Monthly: bS1,
    suite2Monthly: bS2,
    peakNightlyRate: bPeak,
    offPeakNightlyRate: bOff,
    peakOccupancy: bPeakOcc / 100,
    offPeakOccupancy: bOffOcc / 100,
    ltrVacancyRate: bVac / 100,
    platformFeePct: bPlatform / 100,
    cleaningFeePerTurnover: bCleaning,
  });

  // ── Estimated Suite 3 STR nights (for display) ────────────────────────────
  const bPeakNights  = Math.round(PEAK_DAYS    * (bPeakOcc / 100));
  const bOffNights   = Math.round(OFFPEAK_DAYS * (bOffOcc  / 100));

  return (
    <div style={{ fontFamily: FF, background: T.page }}>

      {/* ═══════════════════════════════════════════════════════════════════
          MORTGAGE & PROPERTY PANEL
      ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '28px clamp(1rem,4vw,2.5rem)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, alignItems: 'start' }}>

            {/* Purchase */}
            <div>
              <Label>Purchase Price</Label>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: '-0.04em' }}>$1,295,000</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>3341 Broadview Rd · West Kelowna</div>
            </div>

            {/* Down payment */}
            <div>
              <Label>Down Payment</Label>
              <Pills
                options={[{label:'20%',value:20},{label:'25%',value:25},{label:'30%',value:30}]}
                value={downPct} onChange={setDownPct}
              />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
                {fmtCAD(downPayment)} down · {fmtCAD(closingCosts)} closing · <strong>{fmtCAD(totalCash)} total</strong>
              </div>
            </div>

            {/* Mortgage rate */}
            <div>
              <Label>Mortgage Rate</Label>
              <NumInput value={mRate} onChange={setMRate} min={2} max={12} step={0.05} suffix="%" wide />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
                {fmtCAD(mortgageMonthly)}/mo · {fmtCAD(mortgageMonthly * 12)}/yr
              </div>
            </div>

            {/* Amortization */}
            <div>
              <Label>Amortization</Label>
              <Pills
                options={[{label:'25 yr',value:25},{label:'30 yr',value:30}]}
                value={amortYrs} onChange={setAmortYrs}
              />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
                Loan: {fmtCAD(loanAmount)} · Yr 1 equity: <strong style={{ color: T.blue }}>{fmtCAD(yr1Principal)}</strong>
              </div>
            </div>

            {/* Fixed costs */}
            <div>
              <Label>Annual Fixed Costs</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <InlineField label="Property tax">
                  <NumInput value={propTax} onChange={setPropTax} min={0} step={100} prefix="$" />
                </InlineField>
                <InlineField label="Insurance">
                  <NumInput value={insurance} onChange={setInsurance} min={0} step={100} prefix="$" />
                </InlineField>
                <InlineField label="Maintenance">
                  <NumInput value={maint} onChange={setMaint} min={0} step={100} prefix="$" />
                </InlineField>
              </div>
            </div>

            {/* Management fee — shared, defaults to 0 */}
            <div>
              <Label>Management Fee (% of collected rent)</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <NumInput
                  value={mgmtFee}
                  onChange={setMgmtFee}
                  min={0} max={20} step={0.5}
                  suffix="%"
                />
                <Pills
                  options={[{ label: '0%', value: 0 }, { label: '8%', value: 8 }, { label: '10%', value: 10 }]}
                  value={mgmtFee}
                  onChange={setMgmtFee}
                />
              </div>
              <div style={{ fontSize: 11, color: T.label, marginTop: 5, lineHeight: 1.5 }}>
                Applied to LTR collected rent only. Default 0 — set to e.g. 8–10% if using a property manager.
                STR suites use the platform fee above instead.
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          OPTION CARDS
      ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px clamp(1rem,4vw,2.5rem) 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24 }}>

          {/* ─── OPTION A ──────────────────────────────────────────────────── */}
          <OptionCard result={optA} showBreakdown={showBreakdownA} onToggleBreakdown={() => setShowBreakdownA(p => !p)}>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
              All three suites rented long-term with vacancy applied across each unit.
            </p>

            {/* Income inputs */}
            <SectionBox title="Monthly Rent — All 3 Suites (Guaranteed)">
              <InlineField label="Suite 3 — upstairs + pool (4BR + den)">
                <NumInput value={aS3} onChange={setAS3} min={500} max={8000} step={50} prefix="$" suffix="/mo" />
              </InlineField>
              <InlineField label="Suite 1 — 2-bed basement">
                <NumInput value={aS1} onChange={setAS1} min={500} max={5000} step={50} prefix="$" suffix="/mo" />
              </InlineField>
              <InlineField label="Suite 2 — 1-bed basement">
                <NumInput value={aS2} onChange={setAS2} min={500} max={4000} step={50} prefix="$" suffix="/mo" />
              </InlineField>
              <div style={{ marginTop: 8, padding: '8px 10px', background: T.greenBg, borderRadius: 6, fontSize: 12, color: T.green, fontWeight: 600 }}>
                ✓ Guaranteed {fmtCAD((aS1 + aS2 + aS3))}/mo · {fmtCAD((aS1 + aS2 + aS3) * 12)}/yr gross
              </div>
            </SectionBox>

            {/* Vacancy */}
            <SectionBox title="Vacancy Allowance">
              <InlineField label="Vacancy rate (applies to all suites)">
                <NumInput value={aVac} onChange={setAVac} min={0} max={20} step={0.5} suffix="%" />
              </InlineField>
              <div style={{ fontSize: 12, color: T.muted }}>
                Estimated loss: {fmtCAD((aS1 + aS2 + aS3) * 12 * (aVac / 100))}/yr
              </div>
            </SectionBox>

          </OptionCard>

          {/* ─── OPTION B ──────────────────────────────────────────────────── */}
          <OptionCard result={optB} showBreakdown={showBreakdownB} onToggleBreakdown={() => setShowBreakdownB(p => !p)}>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
              Suites 1 and 2 rented long-term with vacancy applied; Suite 3 (upstairs with pool) rented as a short-term rental with peak/off-peak pricing and occupancy.
            </p>

            {/* LTR portion */}
            <SectionBox title="Suites 1 & 2 — Long-Term (Guaranteed)" accent={T.green}>
              <InlineField label="Suite 1 — 2-bed basement">
                <NumInput value={bS1} onChange={setBS1} min={500} max={5000} step={50} prefix="$" suffix="/mo" />
              </InlineField>
              <InlineField label="Suite 2 — 1-bed basement">
                <NumInput value={bS2} onChange={setBS2} min={500} max={4000} step={50} prefix="$" suffix="/mo" />
              </InlineField>
              <div style={{ marginTop: 8, padding: '8px 10px', background: T.greenBg, borderRadius: 6, fontSize: 12, color: T.green, fontWeight: 600 }}>
                ✓ Guaranteed {fmtCAD(bS1 + bS2)}/mo · {fmtCAD((bS1 + bS2) * 12)}/yr
              </div>
              <div style={{ marginTop: 6 }}>
                <InlineField label="LTR vacancy">
                  <NumInput value={bVac} onChange={setBVac} min={0} max={20} step={0.5} suffix="%" />
                </InlineField>
              </div>
            </SectionBox>

            {/* STR portion */}
            <SectionBox title="Suite 3 — Airbnb / STR (Upstairs + Pool)" accent={T.tealFg}>
              <InlineField label="Peak rate (Jun – Aug)">
                <NumInput value={bPeak} onChange={setBPeak} min={200} max={1500} step={25} prefix="$" suffix="/night" />
              </InlineField>
              <InlineField label="Off-peak rate (Sep – May)">
                <NumInput value={bOff} onChange={setBOff} min={100} max={900} step={25} prefix="$" suffix="/night" />
              </InlineField>
              <InlineField label="Peak occupancy (Jun–Aug)">
                <NumInput value={bPeakOcc} onChange={setBPeakOcc} min={10} max={100} step={5} suffix="%" />
              </InlineField>
              <InlineField label="Off-peak occupancy (Sep–May)">
                <NumInput value={bOffOcc} onChange={setBOffOcc} min={10} max={100} step={5} suffix="%" />
              </InlineField>
              <div style={{ marginTop: 8, padding: '8px 10px', background: T.tealBg, borderRadius: 6, fontSize: 12, color: T.tealFg, fontWeight: 500 }}>
                ≈ {bPeakNights} peak nights + {bOffNights} off-peak nights = <strong>{bPeakNights + bOffNights} booked nights/yr</strong>
              </div>

              {/* STR costs accordion */}
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, color: T.teal, cursor: 'pointer', fontWeight: 600, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ▸ STR cost assumptions
                </summary>
                <div style={{ marginTop: 8 }}>
                  <InlineField label="Platform fee (Airbnb/VRBO)">
                    <NumInput value={bPlatform} onChange={setBPlatform} min={0} max={25} step={0.5} suffix="%" />
                  </InlineField>
                  <InlineField label="Cleaning fee / turnover">
                    <NumInput value={bCleaning} onChange={setBCleaning} min={0} max={600} step={25} prefix="$" />
                  </InlineField>
                  <div style={{ fontSize: 11, color: T.label, marginTop: 4 }}>
                    Variable costs ($40/night) and utilities ($350/mo) are fixed in the model.
                  </div>
                </div>
              </details>
            </SectionBox>

          </OptionCard>

        </div>

        {/* ─── Pre-qual CTA ──────────────────────────────────────────────────── */}
        <div style={{
          marginTop: 40,
          background: 'linear-gradient(135deg, #0f2f2f 0%, #0d3d3d 100%)',
          borderRadius: 16, padding: '36px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: T.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Next step
            </p>
            <h3 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
              Are you Pre-Qualified yet?
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.6, maxWidth: 420 }}>
              Knowing your borrowing power before you make an offer gives you real negotiating leverage.
              Get pre-qualified in under 10 minutes.
            </p>
          </div>
          <button
            onClick={() => (window as any).openInquiryModal?.()}
            aria-label="Open inquiry form — get pre-qualified"
            style={{
              padding: '14px 32px',
              background: T.teal, color: '#fff', fontWeight: 700, fontSize: 15,
              borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FF,
              letterSpacing: '-0.01em', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Get Pre-Qualified →
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: 11, color: T.label, lineHeight: 1.7 }}>
          All figures are estimates for illustrative purposes only and do not constitute financial, legal, or investment advice.
          Actual income, expenses, and returns will vary. Year 1 principal paydown is calculated from the standard amortization schedule.
          Consult a qualified accountant, mortgage professional, and real estate lawyer before making any investment decision.
        </p>
      </div>
    </div>
  );
}

// ─── Reusable card shell ──────────────────────────────────────────────────────

function OptionCard({
  result, showBreakdown, onToggleBreakdown, children,
}: {
  result: OptionResult;
  showBreakdown: boolean;
  onToggleBreakdown: () => void;
  children: React.ReactNode;
}) {
  const { label, tagline, badge, cashFlow, cashOnCash, yearOnePrincipal, totalReturn, totalReturnPct, noi, grossAnnual, debtService, lines } = result;
  return (
    <div style={{
      background: T.surface,
      borderRadius: 14,
      boxShadow: badge
        ? `0 0 0 2px ${T.teal}, 0 8px 32px rgba(0,0,0,0.08)`
        : '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {label}
            </span>
            {badge && (
              <span style={{
                background: T.teal, color: '#fff', fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {badge}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: T.label }}>
            {fmtCAD(result.totalCashInvested)} invested
          </span>
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>
          {label} – {tagline}
        </h3>
      </div>

      {/* Income inputs (slot) */}
      <div style={{ padding: '18px 22px 4px' }}>
        {children}
      </div>

      {/* Returns panel */}
      <div style={{ padding: '0 22px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.label, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Returns
        </div>
        <ReturnPanel
          cashFlow={cashFlow}
          cashOnCash={cashOnCash}
          yearOnePrincipal={yearOnePrincipal}
          totalReturn={totalReturn}
          totalReturnPct={totalReturnPct}
        />

        {/* Quick P&L summary line */}
        <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Gross Income', value: fmtCAD(grossAnnual) + '/yr' },
            { label: 'NOI', value: fmtCAD(noi) + '/yr' },
            { label: 'Debt Service', value: '(' + fmtCAD(debtService) + ')/yr' },
          ].map(kpi => (
            <div key={kpi.label} style={{ fontSize: 12 }}>
              <span style={{ color: T.label }}>{kpi.label}: </span>
              <span style={{ color: T.body, fontWeight: 600 }}>{kpi.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full P&L breakdown toggle */}
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        <button
          onClick={onToggleBreakdown}
          style={{
            width: '100%', padding: '11px 22px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: T.teal, fontSize: 13, fontWeight: 600, fontFamily: FF,
          }}
          aria-expanded={showBreakdown}
        >
          <span>{showBreakdown ? 'Hide full breakdown' : 'Show full P&L breakdown'}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{ transform: showBreakdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showBreakdown && (
          <div style={{ padding: '0 22px 20px', borderTop: `1px solid ${T.border}` }}>
            <div style={{ marginTop: 12 }}>
              {lines.map((line, i) => <PLRow key={i} line={line} />)}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 11, color: T.label, lineHeight: 1.6 }}>
              Cap rate = NOI ÷ purchase price ({fmtPct(noi / 1_295_000)}). Cash-on-cash and total return % use total cash invested including 2.5% closing costs. All CAD.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
