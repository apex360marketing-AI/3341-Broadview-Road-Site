import { useState } from 'react';
import { DEFAULT_INPUTS, calcAllOptions, calcHybridOption, fmtCAD, fmtPct } from '../../domain/roi';
import type { RoiInputs } from '../../domain/roi';
import OptionCard from './OptionCard';

const TEAL = '#5BC2C2';
const LABEL_STYLE = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  marginBottom: 6,
};
const INPUT_STYLE = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 14,
  color: '#111',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
};

export default function RoiDashboard() {
  const [peakRate, setPeakRate] = useState(DEFAULT_INPUTS.peakNightlyRate);
  const [offPeakRate, setOffPeakRate] = useState(DEFAULT_INPUTS.offPeakNightlyRate);
  const [downPct, setDownPct] = useState(20);
  const [mortgageRate, setMortgageRate] = useState(5.5);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const inputs: RoiInputs = {
    ...DEFAULT_INPUTS,
    peakNightlyRate: peakRate,
    offPeakNightlyRate: offPeakRate,
    downPaymentPct: downPct / 100,
    mortgageRatePct: mortgageRate / 100,
  };

  const results = calcAllOptions(inputs);
  const hybrid = calcHybridOption(inputs);
  const { totalCashInvested } = (() => {
    const down = inputs.purchasePrice * inputs.downPaymentPct;
    const closing = inputs.purchasePrice * inputs.closingCostsPct;
    return { totalCashInvested: down + closing };
  })();

  function toggleExpanded(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {/* ── Executive summary strip ───────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e9e8e4',
        padding: '28px clamp(1rem, 4vw, 2.5rem)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>
            Best-case scenario · Option B (Hybrid)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 0 }}>
            {[
              { label: 'Annual Cash Flow', value: fmtCAD(hybrid.cashFlow), positive: hybrid.cashFlow >= 0 },
              { label: 'Monthly Cash Flow', value: fmtCAD(hybrid.cashFlow / 12), positive: hybrid.cashFlow >= 0 },
              { label: 'Cap Rate', value: fmtPct(hybrid.capRate), positive: true },
              { label: 'Cash-on-Cash', value: fmtPct(hybrid.cashOnCash), positive: hybrid.cashOnCash >= 0 },
              { label: 'Total Cash Required', value: fmtCAD(totalCashInvested), positive: null },
            ].map((kpi, i) => (
              <div
                key={kpi.label}
                style={{
                  padding: '16px 24px 16px 0',
                  borderRight: i < 4 ? '1px solid #f1f1ef' : undefined,
                  paddingRight: i < 4 ? 24 : 0,
                  marginRight: i < 4 ? 24 : 0,
                }}
              >
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  {kpi.label}
                </div>
                <div style={{
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: kpi.positive === null ? '#111' : (kpi.positive ? '#16a34a' : '#dc2626'),
                }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main body ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px clamp(1rem, 4vw, 2.5rem) 80px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 40, alignItems: 'start' }}>

          {/* ── Assumptions sidebar ────────────────────────────────────────── */}
          <aside>
            <div style={{
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
              padding: '24px 20px',
              position: 'sticky',
              top: 100,
            }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>
                Adjust Assumptions
              </h2>

              {/* Peak rate slider */}
              <div style={{ marginBottom: 20 }}>
                <label style={LABEL_STYLE}>
                  Peak rate (Jun–Aug)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
                    ${peakRate}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>/night</span>
                </div>
                <input
                  type="range"
                  min={350} max={800} step={25}
                  value={peakRate}
                  onChange={e => setPeakRate(Number(e.target.value))}
                  style={{ width: '100%', accentColor: TEAL }}
                  aria-label="Peak nightly rate"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  <span>$350</span><span>$800</span>
                </div>
              </div>

              {/* Off-peak rate slider */}
              <div style={{ marginBottom: 20 }}>
                <label style={LABEL_STYLE}>
                  Off-peak rate (Sep–May)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
                    ${offPeakRate}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>/night</span>
                </div>
                <input
                  type="range"
                  min={250} max={650} step={25}
                  value={offPeakRate}
                  onChange={e => setOffPeakRate(Number(e.target.value))}
                  style={{ width: '100%', accentColor: TEAL }}
                  aria-label="Off-peak nightly rate"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  <span>$250</span><span>$650</span>
                </div>
              </div>

              {/* Down payment */}
              <div style={{ marginBottom: 20 }}>
                <label style={LABEL_STYLE}>Down payment</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[20, 25, 30].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setDownPct(pct)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 8,
                        border: downPct === pct ? `2px solid ${TEAL}` : '1px solid #e5e7eb',
                        background: downPct === pct ? '#f0fbfb' : '#fff',
                        color: downPct === pct ? '#1a8f8f' : '#374151',
                        fontSize: 13,
                        fontWeight: downPct === pct ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Mortgage rate */}
              <div style={{ marginBottom: 24 }}>
                <label style={LABEL_STYLE}>Mortgage rate</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min={2.5} max={10} step={0.05}
                    value={mortgageRate}
                    onChange={e => setMortgageRate(parseFloat(e.target.value) || 5.5)}
                    style={{ ...INPUT_STYLE, paddingRight: 28 }}
                    aria-label="Annual mortgage rate"
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af' }}>%</span>
                </div>
              </div>

              {/* STR assumptions summary */}
              <div style={{ borderTop: '1px solid #f1f1ef', paddingTop: 16 }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  STR Assumptions
                </p>
                {[
                  ['Peak occupancy', '70% (Jun–Aug)'],
                  ['Off-peak occupancy', '55% (Sep–May)'],
                  ['Platform fee', '5%'],
                  ['Cleaning fee', '$225/turnover'],
                  ['Avg stay', '2.5 nights'],
                  ['Variable costs', '$40/night'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>{k}</span>
                    <span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Fixed costs summary */}
              <div style={{ borderTop: '1px solid #f1f1ef', paddingTop: 16, marginTop: 4 }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Fixed Annual Costs
                </p>
                {[
                  ['Property tax', '$9,500'],
                  ['Insurance', '$3,600'],
                  ['Maintenance', '$5,500'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>{k}</span>
                    <span style={{ color: '#111', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Option cards ──────────────────────────────────────────────── */}
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#111', letterSpacing: '-0.03em' }}>
                Income Strategy Comparison
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
                Based on {inputs.purchasePrice.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })} purchase price · {(inputs.downPaymentPct * 100).toFixed(0)}% down · {inputs.mortgageRatePct * 100}% rate · 25-year amortization
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {results.map(result => (
                <OptionCard
                  key={result.id}
                  result={result}
                  expanded={!!expanded[result.id]}
                  onToggle={() => toggleExpanded(result.id)}
                />
              ))}
            </div>

            {/* ── Pre-qual CTA ─────────────────────────────────────────────── */}
            <div style={{
              marginTop: 40,
              background: 'linear-gradient(135deg, #0f2f2f 0%, #0d3d3d 100%)',
              borderRadius: 16,
              padding: '36px 40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
              flexWrap: 'wrap',
            }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#5BC2C2', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Next step
                </p>
                <h3 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                  Are you Pre-Qualified yet?
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.6, maxWidth: 420 }}>
                  Knowing your numbers before you make an offer gives you negotiating power. Get pre-qualified in under 10 minutes with our mortgage partner.
                </p>
              </div>
              <a
                href="#contact"
                style={{
                  display: 'inline-block',
                  padding: '14px 32px',
                  background: TEAL,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 15,
                  borderRadius: 8,
                  textDecoration: 'none',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#4aafaf')}
                onMouseLeave={e => (e.currentTarget.style.background = TEAL)}
              >
                Get Pre-Qualified →
              </a>
            </div>

            <p style={{ marginTop: 24, fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
              All figures are estimates for illustrative purposes only and do not constitute financial, legal, or investment advice.
              Actual income, expenses, and returns will vary. Consult a qualified accountant, mortgage professional, and real estate attorney before making any investment decision.
              Purchase price sourced from current listing data (MLS® 10383409).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
