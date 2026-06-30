import { useMemo, useState } from 'react';
import {
  DEFAULT_FINANCING, deriveFinancing,
  DEFAULT_FAMILY_ESTATE, calcFamilyEstate,
  DEFAULT_CASH_COW_STREAMS, calcCashCow,
  DEFAULT_APPRECIATION, calcAppreciation,
  fmtCAD, fmtPct,
  type Financing, type RevenueStream,
} from '../../domain/roiCalculators';

// ─── VALORA theme tokens (dark palette + lime accent) ──────────────────────────
const T = {
  page:     '#0F0E0C',
  surface:  '#1F2024',
  elevated: '#262A2E',
  ink:      '#EDE6D6', // cream
  body:     '#A29A8B',
  muted:    '#7A7266',
  label:    '#5C544A',
  border:   'rgba(92,84,74,0.35)',
  lime:     '#C0FF00',
  limeSoft: 'rgba(192,255,0,0.10)',
  limeBdr:  'rgba(192,255,0,0.35)',
  green:    '#9BE65B',
  red:      '#f0857a',
  silver:   '#C9CDD3',
};
const FF = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const glass: React.CSSProperties = {
  background: 'rgba(38,42,46,0.55)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: `1px solid ${T.border}`,
  borderRadius: 14,
};

// ─── Primitives ────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function NumInput({
  value, onChange, min, max, step = 1, prefix, suffix, width = 96, ariaLabel,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  prefix?: string; suffix?: string; width?: number; ariaLabel: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {prefix && <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>{prefix}</span>}
      <input
        type="number" value={value} min={min} max={max} step={step}
        aria-label={ariaLabel}
        onChange={e => { const v = parseFloat(e.target.value); onChange(isNaN(v) ? 0 : v); }}
        style={{
          width, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 7,
          fontSize: 14, fontWeight: 600, color: T.ink, background: 'rgba(15,14,12,0.6)',
          fontFamily: FF, outline: 'none', colorScheme: 'dark',
        }}
      />
      {suffix && <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>{suffix}</span>}
    </div>
  );
}

function Pills({
  options, value, onChange, ariaLabel,
}: { options: { label: string; value: number }[]; value: number; onChange: (v: number) => void; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} type="button" aria-pressed={active} onClick={() => onChange(o.value)} style={{
            padding: '7px 16px', borderRadius: 7,
            border: active ? `1.5px solid ${T.lime}` : `1px solid ${T.border}`,
            background: active ? T.limeSoft : 'transparent',
            color: active ? T.lime : T.body,
            fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer', fontFamily: FF,
            transition: 'all 0.15s ease',
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Big headline metric — the lime hero figure for each calculator. */
function HeroMetric({ label, value, sub, tone = 'lime' }: {
  label: string; value: string; sub?: string; tone?: 'lime' | 'pos' | 'neg';
}) {
  const color = tone === 'neg' ? T.red : tone === 'pos' ? T.green : T.lime;
  return (
    <div style={{ ...glass, padding: '20px 22px', borderColor: tone === 'neg' ? 'rgba(240,133,122,0.3)' : T.limeBdr }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 38, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

/** Secondary output stat. */
function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div style={{ ...glass, padding: '16px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? T.lime : T.ink, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

type TabKey = 'family' | 'cashcow' | 'appreciation';

const TABS: { key: TabKey; title: string; sub: string }[] = [
  { key: 'family',       title: 'Family Estate',        sub: 'Basement suite income' },
  { key: 'cashcow',      title: 'Cash Cow',             sub: 'Multiple revenue streams' },
  { key: 'appreciation', title: 'Appreciation & Equity', sub: 'Long-term wealth' },
];

export default function RoiCalculators() {
  const [tab, setTab] = useState<TabKey>('family');

  // ── Shared financing (single source of truth) ────────────────────────────────
  const [downPct, setDownPct]   = useState(20);
  const [rate, setRate]         = useState(5.5);
  const [amort, setAmort]       = useState(25);

  const financing: Financing = useMemo(() => ({
    ...DEFAULT_FINANCING,
    downPaymentPct: downPct / 100,
    mortgageRatePct: rate / 100,
    amortizationYears: amort,
  }), [downPct, rate, amort]);

  const fin = useMemo(() => deriveFinancing(financing), [financing]);

  // ── Calculator 1 — Family Estate ──────────────────────────────────────────────
  const [feRent, setFeRent]     = useState(DEFAULT_FAMILY_ESTATE.suiteRentMonthly);
  const [feVac, setFeVac]       = useState(DEFAULT_FAMILY_ESTATE.vacancyPct * 100);
  const [feOpex, setFeOpex]     = useState(DEFAULT_FAMILY_ESTATE.operatingExpensePct * 100);

  const fe = useMemo(() => calcFamilyEstate(
    { suiteRentMonthly: feRent, vacancyPct: feVac / 100, operatingExpensePct: feOpex / 100 },
    financing,
  ), [feRent, feVac, feOpex, financing]);

  // ── Calculator 2 — Cash Cow ───────────────────────────────────────────────────
  const [streams, setStreams]   = useState<RevenueStream[]>(DEFAULT_CASH_COW_STREAMS);
  const [ccVac, setCcVac]       = useState(5);
  const [ccOpex, setCcOpex]     = useState(8);

  const cc = useMemo(() => calcCashCow(
    { streams, vacancyPct: ccVac / 100, operatingExpensePct: ccOpex / 100 },
    financing,
  ), [streams, ccVac, ccOpex, financing]);

  function updateStream(key: string, patch: Partial<RevenueStream>) {
    setStreams(prev => prev.map(s => s.key === key ? { ...s, ...patch } : s));
  }

  // ── Calculator 3 — Appreciation & Equity ──────────────────────────────────────
  const [appr, setAppr]         = useState(DEFAULT_APPRECIATION.annualAppreciationPct * 100);
  const [hold, setHold]         = useState(DEFAULT_APPRECIATION.holdYears);
  const [rentGrowth, setRentGrowth] = useState(DEFAULT_APPRECIATION.annualRentGrowthPct * 100);

  const ap = useMemo(() => calcAppreciation(
    {
      annualAppreciationPct: appr / 100,
      holdYears: hold,
      annualRentGrowthPct: rentGrowth / 100,
      year1AnnualCashFlow: cc.combinedAnnualCashFlow,
    },
    financing,
  ), [appr, hold, rentGrowth, cc.combinedAnnualCashFlow, financing]);

  return (
    <div style={{ background: T.page, fontFamily: FF }}>
      <style>{`
        .roi-panel-grid { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(18px,3vw,32px); align-items: start; }
        @media (max-width: 768px) { .roi-panel-grid { grid-template-columns: 1fr; } }
        .roi-island input:focus-visible, .roi-island button:focus-visible { outline: 2px solid ${T.lime}; outline-offset: 2px; }
      `}</style>
      <div className="roi-island" style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: '36px clamp(1rem,4vw,2.5rem) 90px' }}>

        {/* ── Chrome-silver brand watermark (decorative) ─────────────────────── */}
        <svg
          aria-hidden="true"
          viewBox="0 0 60 60"
          style={{
            position: 'absolute', top: '46%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(620px, 90%)', height: 'auto',
            opacity: 0.05, pointerEvents: 'none', zIndex: 0,
          }}
        >
          <defs>
            <linearGradient id="roi-chrome" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6B7079" />
              <stop offset="32%" stopColor="#9AA0A8" />
              <stop offset="55%" stopColor="#FFFFFF" />
              <stop offset="74%" stopColor="#CFD4DA" />
              <stop offset="100%" stopColor="#767B83" />
            </linearGradient>
          </defs>
          <g stroke="url(#roi-chrome)" fill="none">
            <circle cx="30" cy="30" r="28" strokeWidth="0.7" />
            <g strokeWidth="1.3" strokeLinecap="round">
              <line x1="30" y1="0.5" x2="30" y2="3.5" /><line x1="30" y1="56.5" x2="30" y2="59.5" />
              <line x1="0.5" y1="30" x2="3.5" y2="30" /><line x1="56.5" y1="30" x2="59.5" y2="30" />
            </g>
            <circle cx="30" cy="30" r="22" strokeWidth="0.6" />
            <g strokeWidth="1.7" strokeLinecap="round">
              <line x1="30" y1="9" x2="30" y2="13" /><line x1="30" y1="47" x2="30" y2="51" />
              <line x1="9" y1="30" x2="13" y2="30" /><line x1="47" y1="30" x2="51" y2="30" />
            </g>
            <g strokeWidth="0.9" strokeLinecap="round">
              <line x1="40.6" y1="11.84" x2="42.5" y2="14.5" /><line x1="48.16" y1="19.4" x2="45.5" y2="21.3" />
              <line x1="48.16" y1="40.6" x2="45.5" y2="38.7" /><line x1="40.6" y1="48.16" x2="42.5" y2="45.5" />
              <line x1="19.4" y1="48.16" x2="17.5" y2="45.5" /><line x1="11.84" y1="40.6" x2="14.5" y2="38.7" />
              <line x1="11.84" y1="19.4" x2="14.5" y2="21.3" /><line x1="19.4" y1="11.84" x2="17.5" y2="14.5" />
            </g>
            <path d="M27.5 13.5 L30 10.5 L32.5 13.5" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          <circle cx="30" cy="30" r="2.4" fill="url(#roi-chrome)" />
        </svg>

        {/* All content sits above the watermark */}
        <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Shared financing panel ─────────────────────────────────────────── */}
        <section style={{ ...glass, padding: 'clamp(20px,3vw,28px)', marginBottom: 26 }} aria-label="Shared financing assumptions">
          <div style={{ fontSize: 11, fontWeight: 700, color: T.lime, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 18 }}>
            Financing &amp; Property &middot; Applies to all three calculators
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'clamp(18px,3vw,32px)', alignItems: 'start' }}>
            <div>
              <Label>Purchase Price</Label>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: '-0.04em' }}>{fmtCAD(financing.purchasePrice)}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>3341 Broadview Rd &middot; West Kelowna</div>
            </div>
            <div>
              <Label>Down Payment</Label>
              <Pills ariaLabel="Down payment percent" options={[{label:'20%',value:20},{label:'25%',value:25},{label:'30%',value:30}]} value={downPct} onChange={setDownPct} />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
                {fmtCAD(fin.downPayment)} down &middot; {fmtCAD(fin.closingCosts)} closing
              </div>
            </div>
            <div>
              <Label>Mortgage Rate</Label>
              <NumInput ariaLabel="Mortgage interest rate percent" value={rate} onChange={setRate} min={1} max={12} step={0.05} suffix="%" />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
                {fmtCAD(fin.mortgageMonthly)}/mo &middot; {fmtCAD(fin.debtServiceAnnual)}/yr
              </div>
            </div>
            <div>
              <Label>Amortization</Label>
              <Pills ariaLabel="Amortization years" options={[{label:'25 yr',value:25},{label:'30 yr',value:30}]} value={amort} onChange={setAmort} />
              <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
                Loan {fmtCAD(fin.loanAmount)}
              </div>
            </div>
            <div>
              <Label>Total Cash Invested</Label>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.lime, letterSpacing: '-0.04em' }}>{fmtCAD(fin.totalCashInvested)}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Down payment + closing costs</div>
            </div>
          </div>
        </section>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div role="tablist" aria-label="ROI calculators" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key} role="tab" aria-selected={active} id={`tab-${t.key}`} aria-controls={`panel-${t.key}`}
                onClick={() => setTab(t.key)}
                style={{
                  flex: '1 1 200px', minWidth: 160, textAlign: 'left', cursor: 'pointer',
                  padding: '14px 18px', borderRadius: 12, fontFamily: FF,
                  border: active ? `1.5px solid ${T.lime}` : `1px solid ${T.border}`,
                  background: active ? T.limeSoft : 'rgba(38,42,46,0.4)',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: active ? T.lime : T.ink, letterSpacing: '-0.01em' }}>{t.title}</div>
                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{t.sub}</div>
              </button>
            );
          })}
        </div>

        {/* ── Panel: Family Estate ───────────────────────────────────────────── */}
        {tab === 'family' && (
          <div role="tabpanel" id="panel-family" aria-labelledby="tab-family" className="roi-panel-grid">
            <section style={inputCol} aria-label="Family Estate inputs">
              <h2 style={h2}>Family Estate</h2>
              <p style={lede}>
                Model the income from the legal basement suite against the home&apos;s full financing &mdash;
                a mortgage offset of {fmtCAD(feRent)}/mo from the basement alone.
              </p>
              <Row label="Suite Rent (monthly)">
                <NumInput ariaLabel="Basement suite monthly rent" value={feRent} onChange={setFeRent} min={0} step={50} prefix="$" width={110} />
              </Row>
              <Row label="Vacancy Rate">
                <NumInput ariaLabel="Vacancy rate percent" value={feVac} onChange={setFeVac} min={0} max={30} step={0.5} suffix="%" />
              </Row>
              <Row label="Operating Expenses (% of rent)">
                <NumInput ariaLabel="Operating expenses percent of rent" value={feOpex} onChange={setFeOpex} min={0} max={40} step={0.5} suffix="%" />
              </Row>
            </section>

            <section style={outputCol} aria-label="Family Estate results">
              <HeroMetric
                label="Net Monthly Cash Flow"
                value={`${fmtCAD(fe.netMonthlyCashFlow)}/mo`}
                sub={`${fmtCAD(fe.annualCashFlow)}/yr after mortgage & expenses`}
                tone={fe.netMonthlyCashFlow >= 0 ? 'pos' : 'neg'}
              />
              <div style={statGrid}>
                <Stat label="Annual NOI" value={fmtCAD(fe.annualNOI)} hint="Net operating income" accent />
                <Stat label="Cap Rate" value={fmtPct(fe.capRate)} hint="NOI ÷ purchase price" />
                <Stat label="Cash-on-Cash" value={fmtPct(fe.cashOnCash)} hint={`On ${fmtCAD(fe.totalCashInvested)} invested`} />
              </div>
              <p style={note}>
                Gross rent {fmtCAD(fe.grossAnnualRent)}/yr &minus; {fmtPct(feVac / 100, 0)} vacancy &minus; {fmtCAD(fe.operatingExpenses)} operating costs = {fmtCAD(fe.annualNOI)} NOI.
                The basement alone offsets {fmtPct(fe.annualNOI / fe.debtServiceAnnual, 0)} of the {fmtCAD(fe.debtServiceAnnual)}/yr mortgage.
              </p>
            </section>
          </div>
        )}

        {/* ── Panel: Cash Cow ────────────────────────────────────────────────── */}
        {tab === 'cashcow' && (
          <div role="tabpanel" id="panel-cashcow" aria-labelledby="tab-cashcow" className="roi-panel-grid">
            <section style={inputCol} aria-label="Cash Cow inputs">
              <h2 style={h2}>Cash Cow</h2>
              <p style={lede}>
                Stack every income stream this 7-bed estate can produce. Toggle each one on or off and tune the monthly figures.
              </p>
              {streams.map(s => (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '12px 0', borderTop: `1px solid ${T.border}`,
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                    <input
                      type="checkbox" checked={s.enabled}
                      aria-label={`Include ${s.label}`}
                      onChange={e => updateStream(s.key, { enabled: e.target.checked })}
                      style={{ width: 17, height: 17, accentColor: T.lime, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13.5, color: s.enabled ? T.ink : T.muted, fontWeight: 500 }}>{s.label}</span>
                  </label>
                  <div style={{ opacity: s.enabled ? 1 : 0.4 }}>
                    <NumInput
                      ariaLabel={`${s.label} monthly income`}
                      value={s.monthly} onChange={v => updateStream(s.key, { monthly: v })}
                      min={0} step={50} prefix="$" suffix="/mo" width={92}
                    />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
                <div>
                  <Label>Vacancy</Label>
                  <NumInput ariaLabel="Cash Cow vacancy percent" value={ccVac} onChange={setCcVac} min={0} max={30} step={0.5} suffix="%" />
                </div>
                <div>
                  <Label>Operating Exp.</Label>
                  <NumInput ariaLabel="Cash Cow operating expenses percent" value={ccOpex} onChange={setCcOpex} min={0} max={40} step={0.5} suffix="%" />
                </div>
              </div>
            </section>

            <section style={outputCol} aria-label="Cash Cow results">
              <HeroMetric
                label="Blended Gross Monthly Income"
                value={`${fmtCAD(cc.blendedGrossMonthly)}/mo`}
                sub={`${fmtCAD(cc.totalAnnualRevenue)} total annual revenue`}
              />
              <div style={statGrid}>
                <Stat label="Combined Cash Flow" value={`${fmtCAD(cc.combinedMonthlyCashFlow)}/mo`} hint={`${fmtCAD(cc.combinedAnnualCashFlow)}/yr after mortgage`} accent={cc.combinedAnnualCashFlow >= 0} />
                <Stat label="Annual NOI" value={fmtCAD(cc.annualNOI)} hint="After vacancy & expenses" />
                <Stat label="Effective ROI" value={fmtPct(cc.effectiveRoi)} hint="Cash-on-cash return" />
              </div>
              <p style={note}>
                {fmtCAD(cc.totalAnnualRevenue)} revenue &minus; {fmtPct(ccVac / 100, 0)} vacancy &minus; {fmtPct(ccOpex / 100, 0)} operating costs &minus; {fmtCAD(cc.debtServiceAnnual)} mortgage = {fmtCAD(cc.combinedAnnualCashFlow)}/yr.
              </p>
            </section>
          </div>
        )}

        {/* ── Panel: Appreciation & Equity ───────────────────────────────────── */}
        {tab === 'appreciation' && (
          <div role="tabpanel" id="panel-appreciation" aria-labelledby="tab-appreciation" className="roi-panel-grid">
            <section style={inputCol} aria-label="Appreciation and Equity inputs">
              <h2 style={h2}>Appreciation &amp; Equity</h2>
              <p style={lede}>
                Project long-term wealth: appreciation, mortgage principal paydown, and accumulated cash flow over your hold period.
              </p>
              <Row label="Annual Appreciation">
                <NumInput ariaLabel="Annual appreciation percent" value={appr} onChange={setAppr} min={0} max={15} step={0.5} suffix="%" />
              </Row>
              <Row label="Hold Period">
                <NumInput ariaLabel="Hold period years" value={hold} onChange={setHold} min={1} max={30} step={1} suffix="yr" />
              </Row>
              <Row label="Annual Rent Growth">
                <NumInput ariaLabel="Annual rent growth percent" value={rentGrowth} onChange={setRentGrowth} min={0} max={10} step={0.5} suffix="%" />
              </Row>
              <p style={note}>
                Cash flow is seeded from the <strong style={{ color: T.ink }}>Cash Cow</strong> scenario
                ({fmtCAD(cc.combinedAnnualCashFlow)}/yr in year one), then grown at the rent-growth rate.
              </p>
            </section>

            <section style={outputCol} aria-label="Appreciation and Equity results">
              <HeroMetric
                label={`Annualized ROI · ${hold}-Year Hold`}
                value={fmtPct(ap.annualizedRoi)}
                sub={`${fmtCAD(ap.totalProceeds)} total proceeds on ${fmtCAD(ap.totalCashInvested)} invested`}
              />
              <div style={statGrid}>
                <Stat label="Projected Value" value={fmtCAD(ap.projectedValue)} hint={`+${fmtCAD(ap.appreciationGain)} appreciation`} />
                <Stat label="Equity Built" value={fmtCAD(ap.equityBuilt)} hint="Appreciation + principal paydown" accent />
                <Stat label="Total Return" value={fmtCAD(ap.totalReturn)} hint="Equity + cumulative cash flow" />
              </div>
              <div style={statGrid}>
                <Stat label="Principal Paid Down" value={fmtCAD(ap.principalPaid)} hint={`Loan now ${fmtCAD(ap.remainingBalance)}`} />
                <Stat label="Cumulative Cash Flow" value={fmtCAD(ap.cumulativeCashFlow)} hint={`Over ${hold} years`} />
                <Stat label="Equity at Sale" value={fmtCAD(ap.totalEquityAtSale)} hint="Value − remaining loan" />
              </div>
              <div style={milestoneRow} aria-label="Principal paydown milestones">
                <span style={milestoneTitle}>Principal Paydown</span>
                <div style={milestoneCells}>
                  <div style={milestoneCell}>
                    <span style={milestoneYr}>After 5 Years</span>
                    <span style={milestoneVal}>{fmtCAD(ap.principalPaidYear5)}</span>
                  </div>
                  <div style={milestoneDivider} aria-hidden="true" />
                  <div style={milestoneCell}>
                    <span style={milestoneYr}>After 10 Years</span>
                    <span style={milestoneVal}>{fmtCAD(ap.principalPaidYear10)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
        <p style={{ marginTop: 40, fontSize: 11.5, color: T.label, lineHeight: 1.7, maxWidth: 820 }}>
          <strong style={{ color: T.muted }}>Disclaimer:</strong> All figures are estimates provided for illustration only and
          do not constitute financial, tax, investment, or real-estate advice. Actual rents, occupancy, expenses, financing terms,
          appreciation, and returns will vary. Mortgage figures assume a fixed rate over the full amortization. Verify all numbers
          independently and consult licensed professionals before making any purchase or investment decision.
        </p>
        </div>
      </div>
    </div>
  );
}

// ─── Shared layout styles ────────────────────────────────────────────────────
const inputCol: React.CSSProperties = { ...glass, padding: 'clamp(20px,3vw,28px)' };
const outputCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 };
const statGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 };
const h2: React.CSSProperties = { margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#EDE6D6', letterSpacing: '-0.03em' };
const lede: React.CSSProperties = { margin: '0 0 22px', fontSize: 13.5, color: '#A29A8B', lineHeight: 1.65 };
const note: React.CSSProperties = { margin: '4px 0 0', fontSize: 12, color: '#7A7266', lineHeight: 1.65 };

// Principal-paydown milestone strip (5yr / 10yr)
const milestoneRow: React.CSSProperties = {
  ...glass, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
  background: 'rgba(38,42,46,0.4)',
};
const milestoneTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: T.label, textTransform: 'uppercase', letterSpacing: '0.08em',
};
const milestoneCells: React.CSSProperties = { display: 'flex', alignItems: 'stretch', gap: 0 };
const milestoneCell: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px',
};
const milestoneDivider: React.CSSProperties = { width: 1, background: T.border, margin: '2px 14px' };
const milestoneYr: React.CSSProperties = { fontSize: 11.5, color: T.muted, letterSpacing: '0.02em' };
const milestoneVal: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' };
