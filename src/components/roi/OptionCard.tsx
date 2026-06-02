import type { OptionResult } from '../../domain/roi';
import { fmtCAD, fmtPct } from '../../domain/roi';

interface Props {
  result: OptionResult;
  expanded: boolean;
  onToggle: () => void;
}

export default function OptionCard({ result, expanded, onToggle }: Props) {
  const { label, description, badge, cashFlow, capRate, cashOnCash, grossAnnual, lines } = result;
  const isPositive = cashFlow >= 0;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: badge
          ? '0 0 0 2px #5BC2C2, 0 4px 24px rgba(0,0,0,0.08)'
          : '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ padding: '24px 28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111', letterSpacing: '-0.02em' }}>
              {label}
            </h3>
            {badge && (
              <span style={{
                background: '#5BC2C2',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 20,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {badge}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: isPositive ? '#16a34a' : '#dc2626',
              letterSpacing: '-0.03em',
              whiteSpace: 'nowrap',
            }}
          >
            {fmtCAD(cashFlow)}
            <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 3 }}>/yr</span>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{description}</p>
      </div>

      {/* KPI row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderTop: '1px solid #f1f1ef',
        borderBottom: '1px solid #f1f1ef',
      }}>
        {[
          { label: 'Gross Revenue', value: fmtCAD(grossAnnual) },
          { label: 'Cap Rate', value: fmtPct(capRate) },
          { label: 'Cash-on-Cash', value: fmtPct(cashOnCash) },
        ].map((kpi, i) => (
          <div
            key={kpi.label}
            style={{
              padding: '14px 20px',
              borderLeft: i > 0 ? '1px solid #f1f1ef' : undefined,
            }}
          >
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', letterSpacing: '-0.02em' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Expand toggle */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 28px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#5BC2C2',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
        aria-expanded={expanded}
      >
        <span>{expanded ? 'Hide detail' : 'Show full breakdown'}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
        >
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded detail table */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f1ef', padding: '0 28px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 0 8px', color: '#9ca3af', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Line Item
                </th>
                <th style={{ textAlign: 'right', padding: '12px 0 8px', color: '#9ca3af', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Monthly
                </th>
                <th style={{ textAlign: 'right', padding: '12px 0 8px', color: '#9ca3af', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Annual
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={i}
                  style={{
                    borderTop: line.isSubtotal ? '1px solid #e5e7eb' : '1px solid #f9f9f7',
                    background: line.isSubtotal ? '#fafaf9' : 'transparent',
                  }}
                >
                  <td style={{
                    padding: '8px 0',
                    color: line.isSubtotal ? '#111' : '#374151',
                    fontWeight: line.isSubtotal ? 600 : 400,
                  }}>
                    {line.label}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '8px 0',
                    color: line.isSubtotal
                      ? (line.annual >= 0 ? '#16a34a' : '#dc2626')
                      : (line.isIncome ? '#111' : '#6b7280'),
                    fontWeight: line.isSubtotal ? 600 : 400,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmtCAD(line.annual / 12)}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '8px 0',
                    color: line.isSubtotal
                      ? (line.annual >= 0 ? '#16a34a' : '#dc2626')
                      : (line.isIncome ? '#111' : '#6b7280'),
                    fontWeight: line.isSubtotal ? 600 : 400,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmtCAD(line.annual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '16px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
            * NOI does not include debt service. Cap rate = NOI ÷ purchase price. Cash-on-cash = annual cash flow ÷ total cash invested (down payment + 2.5% closing costs). All figures in CAD. Not financial advice — verify with your accountant.
          </p>
        </div>
      )}
    </div>
  );
}
