import type { Handler } from '@netlify/functions';
import PDFDocument from 'pdfkit';
import {
  calcLtrOption,
  calcHybridOption,
  fmtCAD,
  fmtPct,
  PURCHASE_PRICE,
} from '../../src/domain/roi';
import type { RoiInputs } from '../../src/domain/roi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function row(doc: PDFKit.PDFDocument, label: string, a: string, b: string, y: number, shade: boolean) {
  const COL = [50, 220, 360];
  const ROW_H = 20;
  if (shade) {
    doc.rect(50, y, 495, ROW_H).fill('#f5f5f2');
    doc.fill('#374151');
  }
  doc.fontSize(9).fillColor('#374151')
    .text(label, COL[0], y + 5, { width: 165, lineBreak: false })
    .text(a,     COL[1], y + 5, { width: 135, align: 'right', lineBreak: false })
    .text(b,     COL[2], y + 5, { width: 135, align: 'right', lineBreak: false });
  return y + ROW_H;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.rect(50, y, 495, 18).fill('#1a3c3c');
  doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold')
    .text(title.toUpperCase(), 56, y + 4);
  doc.font('Helvetica');
  return y + 24;
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number) {
  doc.fontSize(8).fillColor('#9ca3af').text(label, x, y, { lineBreak: false });
  doc.fontSize(9).fillColor('#111111').text(value, x, y + 10, { lineBreak: false });
  return y + 22;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let inp: RoiInputs;
  let scenario: string;
  try {
    const body = JSON.parse(event.body ?? '{}');
    scenario = body.scenario ?? 'Custom';
    inp = body.inputs as RoiInputs;
    if (!inp || typeof inp.purchasePrice !== 'number') throw new Error('invalid payload');
  } catch {
    return { statusCode: 400, body: 'Invalid request body' };
  }

  const optA = calcLtrOption(inp);
  const optB = calcHybridOption(inp);

  const doc = new PDFDocument({ size: 'LETTER', margin: 0, compress: false });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    // ── Header bar ────────────────────────────────────────────────────────────
    doc.rect(0, 0, 612, 64).fill('#0f2f2f');
    doc.fontSize(15).fillColor('#5BC2C2').font('Helvetica-Bold')
      .text('Investor ROI Summary', 50, 14);
    doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
      .text('Three-Suite Home with Private Oasis-Style Pool & Yard', 50, 32)
      .text('3341 Broadview Rd, West Kelowna, BC  ·  ' + new Date().toLocaleDateString('en-CA', { dateStyle: 'long' }), 50, 44);

    let y = 80;

    // ── Section 1 – Key Inputs ─────────────────────────────────────────────
    y = sectionTitle(doc, 'Key Assumptions', y);

    const col1x = 50, col2x = 210, col3x = 370;
    const startY = y;
    kv(doc, 'Purchase price',    fmtCAD(inp.purchasePrice),                   col1x, y);
    kv(doc, 'Down payment',      `${(inp.downPaymentPct * 100).toFixed(0)}%`, col1x, y + 22);
    kv(doc, 'Mortgage rate',     `${(inp.mortgageRatePct * 100).toFixed(2)}%`, col1x, y + 44);
    kv(doc, 'Amortization',      `${inp.amortizationYears} years`,             col1x, y + 66);

    kv(doc, 'Scenario',          scenario,                                     col2x, startY);
    kv(doc, 'Mgmt fee (LTR)',    `${((inp.managementFeePercent ?? 0) * 100).toFixed(0)}%`, col2x, startY + 22);
    kv(doc, 'LTR vacancy (A)',   `${(inp.ltrVacancyRate * 100).toFixed(0)}%`, col2x, startY + 44);

    kv(doc, 'STR peak rate',     `${fmtCAD(inp.peakNightlyRate)} @ ${(inp.peakOccupancy * 100).toFixed(0)}% occ.`,    col3x, startY);
    kv(doc, 'STR off-peak rate', `${fmtCAD(inp.offPeakNightlyRate)} @ ${(inp.offPeakOccupancy * 100).toFixed(0)}% occ.`, col3x, startY + 22);
    kv(doc, 'STR platform fee',  `${(inp.platformFeePct * 100).toFixed(0)}%`, col3x, startY + 44);

    y = startY + 100;

    // ── Section 2 – Side-by-Side Results ──────────────────────────────────
    y = sectionTitle(doc, 'Option A vs Option B — Annual Results', y);

    // Table header
    doc.rect(50, y, 495, 20).fill('#e9e8e4');
    doc.fontSize(8).fillColor('#374151').font('Helvetica-Bold')
      .text('',                    56,  y + 6, { width: 160, lineBreak: false })
      .text('Option A — All LTR',  220, y + 6, { width: 135, align: 'right', lineBreak: false })
      .text('Option B — Hybrid',   360, y + 6, { width: 135, align: 'right', lineBreak: false });
    doc.font('Helvetica');
    y += 20;

    const tableRows: [string, (r: typeof optA) => string][] = [
      ['Gross annual revenue',          r => fmtCAD(r.grossAnnual)],
      ['Vacancy / STR opex loss',       r => fmtCAD(-(r.vacancyLoss + r.strOpex))],
      ['Fixed operating expenses',      r => fmtCAD(-r.fixedOpex)],
      ['Net Operating Income',          r => fmtCAD(r.noi)],
      ['Annual debt service',           r => fmtCAD(-r.debtService)],
      ['Annual cash flow',              r => fmtCAD(r.cashFlow)],
      ['Year 1 principal paydown',      r => fmtCAD(r.yearOnePrincipal)],
      ['Cash-on-cash (CF only)',         r => fmtPct(r.cashOnCash, 2)],
      ['Cash-on-cash (CF + equity)',     r => fmtPct(r.totalReturnPct, 2)],
      ['Total cash invested',           r => fmtCAD(r.totalCashInvested)],
    ];

    tableRows.forEach(([label, fmt], i) => {
      y = row(doc, label, fmt(optA), fmt(optB), y, i % 2 === 0);
    });

    y += 12;

    // ── Section 3 – Notes ─────────────────────────────────────────────────
    y = sectionTitle(doc, 'Notes & Disclaimer', y);
    doc.fontSize(7.5).fillColor('#6b7280').font('Helvetica')
      .text(
        'Figures shown are illustrative only and based on the assumptions listed above. ' +
        'Actual performance will vary with market conditions, pricing strategy, vacancy, and property management. ' +
        'This document is not financial, tax, legal, or investment advice. ' +
        'Consult your own licensed advisors before making any investment decision. ' +
        'Peak season defined as June–August (92 days); off-peak is the remaining 273 days. ' +
        'STR cleaning fees are guest-paid pass-throughs (net $0 to owner). ' +
        'Year 1 principal paydown calculated via exact amortization schedule.',
        50, y + 6, { width: 495, lineBreak: true }
      );

    // ── Footer ────────────────────────────────────────────────────────────
    doc.rect(0, 740, 612, 52).fill('#f8f7f4');
    doc.fontSize(7.5).fillColor('#9ca3af')
      .text('Generated by the VALORA Investor ROI Dashboard  ·  valorakelowna.com  ·  For private investor use only.', 50, 753, { width: 512, align: 'center' });

    doc.end();
  });

  const pdf = Buffer.concat(chunks);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="VALORA-Investor-Summary.pdf"',
      'Content-Length': String(pdf.length),
    },
    body: pdf.toString('base64'),
    isBase64Encoded: true,
  };
};
