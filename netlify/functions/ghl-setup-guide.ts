import type { Handler } from '@netlify/functions';
import PDFDocument from 'pdfkit';

// ─── Brand colours (consistent with investor-summary.ts) ──────────────────────
const C = {
  headerBg:  '#0f2f2f',   // dark header bar (matches investor-summary)
  sectionBg: '#0D6E6E',   // dark teal section band
  stepTeal:  '#0F9494',   // step number headings
  teal:      '#5BC2C2',   // accent teal
  orange:    '#F97316',   // checkbox / action accent
  ink:       '#1A1A1A',   // body text
  body:      '#374151',   // secondary body
  muted:     '#6b7280',   // muted / hint text
  label:     '#9ca3af',   // small labels
  border:    '#e9e8e4',   // borders / dividers
  rowShade:  '#f5f5f2',   // alternating table row
  codeBg:    '#f4f3f0',   // code block background
  white:     '#ffffff',
  page:      '#F8F7F4',   // page background hint
};

// ─── Page geometry ─────────────────────────────────────────────────────────────
const PW  = 612;  // Letter width
const PH  = 792;  // Letter height
const L   = 45;   // left margin
const R   = 567;  // right edge
const W   = R - L; // content width = 522

const HDR1_H = 66;  // tall page-1 header height
const HDR_H  = 26;  // slim per-page header height
const FTR_Y  = 762; // footer top
const CBOT   = 745; // content must stay above this y

// ─── Page state ────────────────────────────────────────────────────────────────
interface PS { n: number; }

// ─── Draw footer band ──────────────────────────────────────────────────────────
function drawFooter(doc: PDFKit.PDFDocument, n: number): void {
  doc.rect(0, FTR_Y, PW, PH - FTR_Y).fill(C.page);
  doc.fontSize(7.5).fillColor(C.muted).font('Helvetica')
    .text('VALORA  ·  For internal use only', L, FTR_Y + 7, { lineBreak: false });
  doc.fontSize(7.5).fillColor(C.muted)
    .text('Kevin Mueller  ·  RE/MAX Kelowna', 0, FTR_Y + 7,
      { width: PW - L, align: 'right', lineBreak: false });
  doc.fontSize(7.5).fillColor(C.label)
    .text(`Page ${n}`, 0, FTR_Y + 7, { width: PW, align: 'center', lineBreak: false });
}

// ─── Page-1 tall branded header ───────────────────────────────────────────────
function drawHeader1(doc: PDFKit.PDFDocument): void {
  doc.rect(0, 0, PW, HDR1_H).fill(C.headerBg);
  doc.fontSize(16).fillColor(C.teal).font('Helvetica-Bold')
    .text('GHL Setup Guide', L, 10, { lineBreak: false });
  doc.fontSize(9).fillColor('#94a3b8').font('Helvetica')
    .text('VALORA Investor ROI Tool  ·  3341 Broadview Rd, West Kelowna, BC', L, 30)
    .text(
      'apex360marketing@gmail.com  ·  ' +
      new Date().toLocaleDateString('en-CA', { dateStyle: 'long' }),
      L, 44,
    );
  doc.fontSize(8).fillColor(C.teal)
    .text('Step-by-step · Check one box at a time · No skipping ahead', L, 55, { lineBreak: false });
}

// ─── Slim header for pages 2+ ─────────────────────────────────────────────────
function drawHeaderN(doc: PDFKit.PDFDocument, n: number): void {
  doc.rect(0, 0, PW, HDR_H).fill(C.headerBg);
  doc.fontSize(8).fillColor(C.teal).font('Helvetica-Bold')
    .text('GHL Setup Guide — VALORA Investor ROI Tool', L, 8, { lineBreak: false });
  doc.fontSize(8).fillColor(C.muted).font('Helvetica')
    .text(`Page ${n}`, 0, 8, { width: PW - L, align: 'right', lineBreak: false });
}

// ─── Start a brand-new page (header + footer pre-drawn) ───────────────────────
function startPage(doc: PDFKit.PDFDocument, ps: PS, first = false): number {
  if (!first) {
    doc.addPage({ size: 'LETTER', margin: 0 });
    ps.n++;
    drawHeaderN(doc, ps.n);
  } else {
    drawHeader1(doc);
  }
  drawFooter(doc, ps.n);
  return (first ? HDR1_H : HDR_H) + 14;
}

// ─── Ensure enough vertical space, adding a page if needed ────────────────────
function pb(doc: PDFKit.PDFDocument, y: number, need: number, ps: PS): number {
  return y + need > CBOT ? startPage(doc, ps) : y;
}

// ─── Section heading band ─────────────────────────────────────────────────────
function sectionHeader(doc: PDFKit.PDFDocument, title: string, y: number, ps: PS): number {
  y = pb(doc, y, 28, ps);
  doc.rect(L, y, W, 22).fill(C.sectionBg);
  doc.fontSize(12).fillColor(C.white).font('Helvetica-Bold')
    .text(title, L + 8, y + 5, { width: W - 16, lineBreak: false });
  doc.font('Helvetica');
  return y + 28;
}

// ─── Step number heading (medium teal, bold) ──────────────────────────────────
function stepHeading(doc: PDFKit.PDFDocument, title: string, y: number, ps: PS): number {
  y = pb(doc, y, 30, ps);
  doc.fontSize(11).fillColor(C.stepTeal).font('Helvetica-Bold')
    .text(title, L, y, { width: W });
  doc.font('Helvetica');
  y += 15;
  // Hand-written notes line
  doc.fontSize(7.5).fillColor(C.label)
    .text('Notes:', L, y, { lineBreak: false });
  doc.save();
  doc.moveTo(L + 30, y + 7).lineTo(L + 260, y + 7)
    .lineWidth(0.4).strokeColor(C.border).stroke();
  doc.restore();
  return y + 16;
}

// ─── Sub-step row with orange empty checkbox ───────────────────────────────────
//  Layout:  [□]  1.1   Text starts here and wraps within its column
const CB  = 11;   // checkbox size
const NW  = 30;   // fixed number column width
const TX  = L + CB + 6 + NW;   // text x
const TW  = R - TX;             // text width

function subStep(
  doc: PDFKit.PDFDocument,
  num: string,
  text: string,
  y: number,
  ps: PS,
): number {
  doc.font('Helvetica').fontSize(10);
  const th = doc.heightOfString(text, { width: TW });
  const rowH = Math.max(CB + 4, th) + 7;

  y = pb(doc, y, rowH, ps);

  // Orange-bordered empty checkbox (white fill = printable empty square)
  doc.save();
  doc.rect(L, y + 1, CB, CB).fillAndStroke(C.white, C.orange);
  doc.restore();

  // Step number in orange
  if (num.trim()) {
    doc.fontSize(8).fillColor(C.orange).font('Helvetica-Bold')
      .text(num, L + CB + 4, y + 2, { width: NW, lineBreak: false });
  }

  // Step text
  doc.fontSize(10).fillColor(C.ink).font('Helvetica')
    .text(text, TX, y, { width: TW });

  return y + rowH;
}

// ─── Indented note line (for option lists under a sub-step) ───────────────────
function indent(doc: PDFKit.PDFDocument, text: string, y: number, ps: PS): number {
  const ix = L + CB + 6 + NW + 6;
  const iw = R - ix;
  doc.font('Helvetica').fontSize(9);
  const h = doc.heightOfString(text, { width: iw });
  y = pb(doc, y, h + 4, ps);
  doc.fontSize(9).fillColor(C.body).font('Helvetica')
    .text(text, ix, y, { width: iw });
  return y + h + 4;
}

// ─── Code / template block (SMS/email copy) ────────────────────────────────────
function codeBlock(doc: PDFKit.PDFDocument, text: string, y: number, ps: PS): number {
  doc.font('Courier').fontSize(7.5);
  const bw = W - 24;
  const bh = doc.heightOfString(text, { width: bw }) + 14;

  y = pb(doc, y, bh + 6, ps);
  doc.save();
  doc.rect(L + 12, y, bw + 12, bh).fill(C.codeBg);
  doc.restore();
  doc.fontSize(7.5).fillColor(C.body).font('Courier')
    .text(text, L + 18, y + 7, { width: bw });
  doc.font('Helvetica');
  return y + bh + 8;
}

// ─── Dashed break-point divider ───────────────────────────────────────────────
function breakDiv(doc: PDFKit.PDFDocument, note: string, y: number, ps: PS): number {
  y = pb(doc, y, 28, ps);
  doc.save();
  doc.moveTo(L, y + 6).lineTo(R, y + 6)
    .lineWidth(0.8).dash(5, { space: 4 }).strokeColor(C.teal).stroke();
  doc.restore();
  doc.fontSize(8.5).fillColor(C.muted).font('Helvetica-Oblique')
    .text(note, L, y + 10, { width: W, align: 'center' });
  doc.font('Helvetica');
  return y + 30;
}

// ─── Table row (quick reference) ─────────────────────────────────────────────
const TC1 = 185; // col-1 width
const TC2 = W - TC1 - 12; // col-2 width

function tableRow(
  doc: PDFKit.PDFDocument,
  c1: string,
  c2: string,
  y: number,
  shade: boolean,
  ps: PS,
): number {
  doc.font('Helvetica-Bold').fontSize(9);
  const h1 = doc.heightOfString(c1, { width: TC1 });
  doc.font('Helvetica').fontSize(9);
  const h2 = doc.heightOfString(c2, { width: TC2 });
  const rh = Math.max(h1, h2) + 10;

  y = pb(doc, y, rh, ps);

  if (shade) {
    doc.save();
    doc.rect(L, y, W, rh).fill(C.rowShade);
    doc.restore();
  }

  doc.fontSize(9).fillColor(C.ink).font('Helvetica-Bold')
    .text(c1, L + 4, y + 5, { width: TC1 });
  doc.fontSize(9).fillColor(C.body).font('Helvetica')
    .text(c2, L + TC1 + 12, y + 5, { width: TC2 });

  return y + rh;
}

// ─── "If you get stuck" item ──────────────────────────────────────────────────
function stuckItem(
  doc: PDFKit.PDFDocument,
  problem: string,
  solution: string,
  y: number,
  ps: PS,
): number {
  doc.font('Helvetica-Bold').fontSize(10);
  const ph = doc.heightOfString(problem, { width: W - 14 });
  doc.font('Helvetica').fontSize(9);
  const sh = doc.heightOfString(solution, { width: W - 14 });
  const need = ph + sh + 14;

  y = pb(doc, y, need, ps);

  doc.save();
  doc.circle(L + 4, y + 5, 3).fill(C.stepTeal);
  doc.restore();

  doc.fontSize(10).fillColor(C.ink).font('Helvetica-Bold')
    .text(problem, L + 14, y, { width: W - 14 });
  y += ph + 3;
  doc.fontSize(9).fillColor(C.muted).font('Helvetica')
    .text(solution, L + 14, y, { width: W - 14 });
  return y + sh + 12;
}

// ─── Sub-section label (e.g. "Set the Trigger") ───────────────────────────────
function subLabel(doc: PDFKit.PDFDocument, text: string, y: number, ps: PS): number {
  y = pb(doc, y, 18, ps);
  doc.fontSize(9.5).fillColor(C.stepTeal).font('Helvetica-Bold')
    .text(text, L, y, { width: W, lineBreak: false });
  doc.font('Helvetica');
  return y + 15;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const doc = new PDFDocument({ size: 'LETTER', margin: 0, compress: false });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const ps: PS = { n: 1 };

  await new Promise<void>((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    // ════════════════════════════════════════════════════════════════════
    // PAGE 1 — header + footer pre-drawn
    // ════════════════════════════════════════════════════════════════════
    let y = startPage(doc, ps, true);

    // ── Before You Start ────────────────────────────────────────────────
    y = sectionHeader(doc, 'Before You Start', y, ps);

    doc.fontSize(10).fillColor(C.body)
      .text(
        'Check all three items below before opening GHL. Everything else in this guide ' +
        'depends on these being ready. There is a natural break point after Section A ' +
        'if you need to do this across two sittings.',
        L, y, { width: W },
      );
    y += doc.currentLineHeight(true) * 2 + 10;

    y = subStep(doc, '', 'Your GHL account is open and you are logged in.', y, ps);
    y = subStep(doc, '', 'The VALORA /roi page URL is copied and ready to paste.', y, ps);
    y = subStep(doc, '', 'You have 60–90 minutes available. There is a marked break after Section A.', y, ps);
    y += 10;

    // ════════════════════════════════════════════════════════════════════
    // SECTION A — Contacts & Pipeline Setup
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'Section A  —  Contacts & Pipeline Setup', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text('Do this first — it is the foundation everything else is built on.', L, y, { width: W });
    y += 18;

    // Step 1
    y = stepHeading(doc, 'Step 1 — Create the Investor Leads Pipeline', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'A pipeline is a visual board that shows you where each lead is in your sales ' +
        'process — like a Trello board for deals.',
        L, y, { width: W },
      );
    y += 22;

    y = subStep(doc, '1.1', 'In the left sidebar, click CRM.', y, ps);
    y = subStep(doc, '1.2', 'At the top of the page, click Pipelines.', y, ps);
    y = subStep(doc, '1.3', 'Click + Add Pipeline.', y, ps);
    y = subStep(doc, '1.4', 'Name it exactly: Investor Leads', y, ps);
    y = subStep(doc, '1.5', 'Click + Add Stage and create these five stages in this exact order:', y, ps);
    y = indent(doc, '→  New Inquiry', y, ps);
    y = indent(doc, '→  Contacted', y, ps);
    y = indent(doc, '→  Qualified', y, ps);
    y = indent(doc, '→  Showing Booked', y, ps);
    y = indent(doc, '→  Offer / Closed', y, ps);
    y = subStep(doc, '1.6', 'Click Save. You should now see a board with five columns.', y, ps);
    y += 8;

    // Step 2
    y = stepHeading(doc, 'Step 2 — Create the Custom Fields', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'Custom fields let you store specific details about each investor lead — ' +
        'like which income strategy they were looking at.',
        L, y, { width: W },
      );
    y += 22;

    y = subStep(doc, '2.1', 'In the left sidebar, click Settings (gear icon at the bottom).', y, ps);
    y = subStep(doc, '2.2', 'Click Custom Fields.', y, ps);
    y = subStep(doc, '2.3', 'Click + Add Field.', y, ps);
    y = subStep(doc, '2.4', 'Create Field 1 — "Preferred Strategy":', y, ps);
    y = indent(doc, 'Field Label: Preferred Strategy   |   Field Type: Dropdown', y, ps);
    y = indent(doc, 'Options: Option A — All Long-Term  /  Option B — Hybrid STR + LTR  /  Not sure yet', y, ps);
    y = indent(doc, 'Click Save.', y, ps);
    y = subStep(doc, '2.5', 'Click + Add Field again.', y, ps);
    y = subStep(doc, '2.6', 'Create Field 2 — "ROI Tool Source":', y, ps);
    y = indent(doc, 'Field Label: ROI Tool Source   |   Field Type: Text   |   Click Save.', y, ps);
    y = subStep(doc, '2.7', 'Click + Add Field again.', y, ps);
    y = subStep(doc, '2.8', 'Create Field 3 — "Down Payment Budget":', y, ps);
    y = indent(doc, 'Field Label: Down Payment Budget   |   Field Type: Dropdown', y, ps);
    y = indent(doc, 'Options: 20%  /  25%  /  30%  /  35% or more   |   Click Save.', y, ps);
    y += 8;

    // Step 3
    y = stepHeading(doc, 'Step 3 — Create the Tag', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'Tags let you group and filter contacts. This tag marks every lead that came ' +
        'from the ROI tool so you can segment them separately from regular listing inquiries.',
        L, y, { width: W },
      );
    y += 22;

    y = subStep(doc, '3.1', 'In the left sidebar, click Settings.', y, ps);
    y = subStep(doc, '3.2', 'Click Tags.', y, ps);
    y = subStep(doc, '3.3', 'Click + Add Tag.', y, ps);
    y = subStep(doc, '3.4', 'Type exactly: investor-roi', y, ps);
    y = subStep(doc, '3.5', 'Click Save.', y, ps);
    y += 12;

    y = breakDiv(
      doc,
      '☕  Natural break point — Section A is complete. Pipeline, custom fields, and tag are all saved. ' +
      'You can stop here and return later.',
      y, ps,
    );
    y += 6;

    // ════════════════════════════════════════════════════════════════════
    // SECTION B — Calendar Setup
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'Section B  —  Calendar Setup', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'Set this up before the automation so you have the booking link ready to paste in Section E.',
        L, y, { width: W },
      );
    y += 18;

    y = stepHeading(doc, 'Step 4 — Create the ROI Walkthrough Calendar', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text('This is the calendar investors use to book a free 30-minute call with you.', L, y, { width: W });
    y += 22;

    y = subStep(doc, '4.1', 'In the left sidebar, click Calendars.', y, ps);
    y = subStep(doc, '4.2', 'Click + Create Calendar.', y, ps);
    y = subStep(doc, '4.3', 'Choose Simple Calendar (not Round Robin or Class).', y, ps);
    y = subStep(doc, '4.4', 'Fill in the calendar details:', y, ps);
    y = indent(doc, 'Calendar Name: ROI Walkthrough Call', y, ps);
    y = indent(doc, 'Description: A free 30-minute call to walk through the ROI numbers on 3341 Broadview Rd, West Kelowna. Bring your mortgage assumptions and any questions.', y, ps);
    y = indent(doc, 'Duration: 30 minutes', y, ps);
    y = subStep(doc, '4.5', 'Set your available hours — the times you want investors to be able to book.', y, ps);
    y = subStep(doc, '4.6', 'Click Save.', y, ps);
    y = subStep(doc, '4.7', 'Click on the calendar you just created to open it.', y, ps);
    y = subStep(doc, '4.8', 'Find the Share / Embed button.', y, ps);
    y = subStep(doc, '4.9', 'Copy the calendar link and paste it somewhere safe (notes app, email draft). You will need this URL in Steps 8 and 7.', y, ps);
    y += 10;

    // ════════════════════════════════════════════════════════════════════
    // SECTION C — Form Setup
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'Section C  —  Form Setup', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'This form captures the investor\'s information. It connects to the pipeline, the tag, ' +
        'and every automation you build in Section E.',
        L, y, { width: W },
      );
    y += 18;

    // Step 5
    y = stepHeading(doc, 'Step 5 — Create the Investor Lead Capture Form', y, ps);
    y += 4;

    y = subStep(doc, '5.1', 'In the left sidebar, click Sites.', y, ps);
    y = subStep(doc, '5.2', 'Click Forms in the top tab row.', y, ps);
    y = subStep(doc, '5.3', 'Click + New Form.', y, ps);
    y = subStep(doc, '5.4', 'Name it exactly: VALORA Investor Inquiry', y, ps);
    y = subStep(doc, '5.5', 'Add these fields in order (drag from the left panel):', y, ps);
    y = indent(doc, 'First Name — mark as Required', y, ps);
    y = indent(doc, 'Last Name — optional', y, ps);
    y = indent(doc, 'Email — mark as Required', y, ps);
    y = indent(doc, 'Phone — mark as Required', y, ps);
    y = subStep(doc, '5.6', 'Add a Dropdown field for strategy:', y, ps);
    y = indent(doc, 'Label: Which strategy interests you most?', y, ps);
    y = indent(doc, 'Map to custom field: Preferred Strategy   |   Mark as Required', y, ps);
    y = subStep(doc, '5.7', 'Add another Dropdown field for down payment:', y, ps);
    y = indent(doc, 'Label: Approximate down payment budget?', y, ps);
    y = indent(doc, 'Map to custom field: Down Payment Budget   |   Not required', y, ps);
    y = subStep(doc, '5.8', 'Change the submit button text to: Send My Inquiry', y, ps);
    y = subStep(doc, '5.9', 'Click Save.', y, ps);
    y = subStep(doc, '5.10', 'Click Settings or Integrations inside the form builder.', y, ps);
    y = subStep(doc, '5.11',
      'Set the redirect after submission to your Thank-You page URL. ' +
      'You will build that page in Step 7.6 — come back here to fill this in after Step 7.6.',
      y, ps);
    y += 8;

    // Step 6
    y = stepHeading(doc, 'Step 6 — Get the Webhook URL for the VALORA Site', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'This connects the contact form on your live /roi site to GHL so real submissions flow in.',
        L, y, { width: W },
      );
    y += 22;

    y = subStep(doc, '6.1', 'In the left sidebar, click Settings.', y, ps);
    y = subStep(doc, '6.2', 'Click Integrations.', y, ps);
    y = subStep(doc, '6.3', 'Look for Webhooks or the section labeled API / Webhooks.', y, ps);
    y = subStep(doc, '6.4', 'Click + Add Webhook or find the inbound webhook option.', y, ps);
    y = subStep(doc, '6.5', 'Name it: VALORA ROI Inquiry', y, ps);
    y = subStep(doc, '6.6', 'Copy the webhook URL that GHL generates.', y, ps);
    y = subStep(doc, '6.7', 'Open your tokens.json file in the VALORA site project.', y, ps);
    y = subStep(doc, '6.8', 'Paste that URL as the value for INQUIRY_WEBHOOK_URL.', y, ps);
    y = subStep(doc, '6.9', 'Make sure the URL starts with https:// — the form will refuse to submit to a plain http address.', y, ps);
    y = subStep(doc, '6.10', 'Save tokens.json and redeploy the site to Netlify.', y, ps);
    y += 10;

    // ════════════════════════════════════════════════════════════════════
    // SECTION D — Funnel Pages
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'Section D  —  Funnel Pages', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text('Build the two pages investors land on after clicking your shared link.', L, y, { width: W });
    y += 18;

    y = stepHeading(doc, 'Step 7 — Build the Two-Page Funnel', y, ps);
    y += 4;

    y = subStep(doc, '7.1', 'In the left sidebar, click Sites.', y, ps);
    y = subStep(doc, '7.2', 'Click Funnels.', y, ps);
    y = subStep(doc, '7.3', 'Click + New Funnel.', y, ps);
    y = subStep(doc, '7.4', 'Name it: VALORA Investor ROI', y, ps);
    y = subStep(doc, '7.5', 'Click Add New Step — this is Step 1 (the entry point):', y, ps);
    y = indent(doc, 'Step Name: ROI Calculator   |   Path: /roi-calculator', y, ps);
    y = indent(doc, 'On this page: add a button that links to your live /roi URL. You do not need to rebuild the calculator inside GHL.', y, ps);
    y = subStep(doc, '7.6', 'Click Add New Step again — this is Step 2 (the thank-you page):', y, ps);
    y = indent(doc, 'Step Name: Thank You   |   Path: /thank-you', y, ps);
    y = indent(doc, 'Add headline: "Thanks — Kevin will follow up within 24 hours."', y, ps);
    y = indent(doc, 'Add line: "Book your free 30-minute ROI walkthrough call below."', y, ps);
    y = indent(doc, 'Embed your calendar: Add Element → Calendar → paste your calendar URL from Step 4.9', y, ps);
    y = indent(doc, 'Add a link back: "Run the numbers again →" linking to your /roi URL', y, ps);
    y = subStep(doc, '7.7', 'Click Save on both pages.', y, ps);
    y = subStep(doc, '7.8', 'Go back to the form you built in Step 5.', y, ps);
    y = subStep(doc, '7.9', 'Set the redirect URL (Step 5.11) to your Thank-You page URL from this funnel.', y, ps);
    y = subStep(doc, '7.10', 'Save the form again.', y, ps);
    y += 10;

    // ════════════════════════════════════════════════════════════════════
    // SECTION E — Automation Setup
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'Section E  —  Automation Setup', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'This is the engine. When a lead submits the form, these two workflows fire automatically. ' +
        'Read each step fully before clicking — GHL workflows are easier to build in one pass than to fix later.',
        L, y, { width: W },
      );
    y += 22;

    // Step 8
    y = stepHeading(doc, 'Step 8 — Build the New Lead Automation Workflow', y, ps);
    y += 4;

    y = subStep(doc, '8.1', 'In the left sidebar, click Automation.', y, ps);
    y = subStep(doc, '8.2', 'Click Workflows.', y, ps);
    y = subStep(doc, '8.3', 'Click + New Workflow.', y, ps);
    y = subStep(doc, '8.4', 'Choose Start from Scratch.', y, ps);
    y = subStep(doc, '8.5', 'Name it: VALORA ROI — New Lead', y, ps);
    y += 4;

    y = subLabel(doc, 'Set the Trigger', y, ps);
    y = subStep(doc, '8.6', 'Click Add Trigger.', y, ps);
    y = subStep(doc, '8.7', 'Choose Form Submitted.', y, ps);
    y = subStep(doc, '8.8', 'In the dropdown, select: VALORA Investor Inquiry (the form from Step 5).', y, ps);
    y = subStep(doc, '8.9', 'Click Save Trigger.', y, ps);
    y += 4;

    y = subLabel(doc, 'Action 1 — Apply the Tag', y, ps);
    y = subStep(doc, '8.10', 'Click the + button below the trigger.', y, ps);
    y = subStep(doc, '8.11', 'Choose Add Tag.', y, ps);
    y = subStep(doc, '8.12', 'Select: investor-roi', y, ps);
    y = subStep(doc, '8.13', 'Click Save Action.', y, ps);
    y += 4;

    y = subLabel(doc, 'Action 2 — Add to Pipeline', y, ps);
    y = subStep(doc, '8.14', 'Click + to add another action.', y, ps);
    y = subStep(doc, '8.15', 'Choose Create/Update Opportunity.', y, ps);
    y = subStep(doc, '8.16', 'Set the following values:', y, ps);
    y = indent(doc, 'Pipeline: Investor Leads', y, ps);
    y = indent(doc, 'Stage: New Inquiry', y, ps);
    y = indent(doc, 'Opportunity Name: {{contact.firstName}} — VALORA ROI', y, ps);
    y = indent(doc, '(Use GHL\'s {{ }} variable picker to insert the contact\'s first name.)', y, ps);
    y = subStep(doc, '8.17', 'Click Save Action.', y, ps);
    y += 4;

    y = subLabel(doc, 'Action 3 — Send Confirmation SMS', y, ps);
    y = subStep(doc, '8.18', 'Click + and choose Send SMS.', y, ps);
    y = subStep(doc, '8.19', 'Write the message below — use {{ }} to insert the first name and paste your calendar link where shown:', y, ps);
    y = codeBlock(doc,
      'Hi {{contact.firstName}}! Thanks for checking out the VALORA ROI tool.\n' +
      'Kevin will follow up within 24 hours.\n\n' +
      'Book your free 30-min ROI walkthrough here:\n' +
      '[PASTE YOUR CALENDAR LINK FROM STEP 4.9]\n\n' +
      '— Kevin, RE/MAX Kelowna',
      y, ps);
    y = subStep(doc, '8.20', 'Click Save Action.', y, ps);
    y += 4;

    y = subLabel(doc, 'Action 4 — Send Confirmation Email', y, ps);
    y = subStep(doc, '8.21', 'Click + and choose Send Email.', y, ps);
    y = subStep(doc, '8.22', 'Set Subject: Your VALORA Investor Inquiry — Kevin will be in touch', y, ps);
    y = subStep(doc, '8.23', 'Set From Name: Kevin Mueller — RE/MAX Kelowna', y, ps);
    y = subStep(doc, '8.24', 'Paste this email body — fill in the two bracketed links:', y, ps);
    y = codeBlock(doc,
      'Hi {{contact.firstName}},\n\n' +
      'Thanks for using the VALORA ROI tool for 3341 Broadview Rd, West Kelowna.\n\n' +
      'I\'ll follow up within 24 hours to answer any questions.\n\n' +
      'Book a free 30-minute ROI walkthrough here:\n' +
      '[PASTE YOUR CALENDAR LINK FROM STEP 4.9]\n\n' +
      'Or run the numbers again any time:\n' +
      '[PASTE YOUR /roi URL HERE]\n\n' +
      'Talk soon,\nKevin Mueller\nRE/MAX Kelowna\n[YOUR PHONE NUMBER]',
      y, ps);
    y = subStep(doc, '8.25', 'Click Save Action.', y, ps);
    y += 4;

    y = subLabel(doc, 'Action 5 — Internal Notification to Yourself', y, ps);
    y = subStep(doc, '8.26', 'Click + and choose Internal Notification (or Send Email to yourself).', y, ps);
    y = subStep(doc, '8.27', 'Subject: New Investor Lead — {{contact.firstName}} {{contact.lastName}}', y, ps);
    y = subStep(doc, '8.28', 'Paste this body:', y, ps);
    y = codeBlock(doc,
      'Name: {{contact.firstName}} {{contact.lastName}}\n' +
      'Email: {{contact.email}}\n' +
      'Phone: {{contact.phone}}\n' +
      'Strategy preference: {{contact.preferredStrategy}}\n' +
      'Down payment: {{contact.downPaymentBudget}}\n' +
      'Submitted: {{now}}',
      y, ps);
    y = subStep(doc, '8.29', 'Click Save Action.', y, ps);
    y += 4;

    y = subLabel(doc, 'Activate the Workflow', y, ps);
    y = subStep(doc, '8.30', 'Click Save on the whole workflow.', y, ps);
    y = subStep(doc, '8.31', 'Toggle the workflow from Draft to Published (top-right of the screen).', y, ps);
    y += 10;

    // Step 9
    y = stepHeading(doc, 'Step 9 — Build the Cold Lead Follow-Up Sequence', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'This fires automatically if a lead goes quiet for 3 days. It runs Day 3 email → ' +
        'Day 5 SMS → Day 10 final email, then stops.',
        L, y, { width: W },
      );
    y += 22;

    y = subStep(doc, '9.1', 'In Automation → Workflows, click + New Workflow.', y, ps);
    y = subStep(doc, '9.2', 'Name it: VALORA ROI — Cold Lead Follow-Up', y, ps);
    y += 4;

    y = subLabel(doc, 'Set the Trigger', y, ps);
    y = subStep(doc, '9.3', 'Trigger: Tag Added', y, ps);
    y = subStep(doc, '9.4', 'Tag: investor-roi', y, ps);
    y += 4;

    y = subLabel(doc, 'Day 3 — Email', y, ps);
    y = subStep(doc, '9.5', 'Click + → Wait → 3 days.', y, ps);
    y = subStep(doc, '9.6',
      'Add a condition: IF the contact\'s pipeline stage is still "New Inquiry" → continue. ' +
      'If it has moved forward → end the workflow. (This means Kevin already reached out.)',
      y, ps);
    y = subStep(doc, '9.7', 'Click + → Send Email. Subject: Did you get a chance to run the numbers?', y, ps);
    y = subStep(doc, '9.8', 'Body:', y, ps);
    y = codeBlock(doc,
      'Hi {{contact.firstName}},\n\n' +
      'I noticed you checked out the VALORA ROI model for 3341 Broadview Rd.\n' +
      'Have you had a chance to plug in your own numbers?\n\n' +
      'Happy to walk through the assumptions on a quick call — no pressure.\n\n' +
      'Book a free 30-minute slot: [PASTE CALENDAR LINK]\n' +
      'Or keep running scenarios: [PASTE /roi URL]\n\n' +
      'Talk soon, Kevin',
      y, ps);
    y += 4;

    y = subLabel(doc, 'Day 5 — SMS', y, ps);
    y = subStep(doc, '9.9', 'Click + → Wait → 2 more days (total = Day 5).', y, ps);
    y = subStep(doc, '9.10', 'Click + → Send SMS. Message:', y, ps);
    y = codeBlock(doc,
      'Hi {{contact.firstName}}, Kevin here from RE/MAX Kelowna.\n' +
      'Happy to hop on a 15-min call about 3341 Broadview Rd — just reply\n' +
      'or book here: [CALENDAR LINK]',
      y, ps);
    y += 4;

    y = subLabel(doc, 'Day 10 — Final Email', y, ps);
    y = subStep(doc, '9.11', 'Click + → Wait → 5 more days (total = Day 10).', y, ps);
    y = subStep(doc, '9.12', 'Click + → Send Email. Subject: Last check-in on VALORA', y, ps);
    y = subStep(doc, '9.13', 'Body:', y, ps);
    y = codeBlock(doc,
      'Hi {{contact.firstName}},\n\n' +
      'I won\'t keep filling your inbox. If the timing changes and you want\n' +
      'to revisit the numbers, the tool is always here:\n' +
      '[PASTE /roi URL]\n\n' +
      'Have a great week, Kevin',
      y, ps);
    y += 4;

    y = subLabel(doc, 'Wrap Up the Sequence', y, ps);
    y = subStep(doc, '9.14', 'Click + → Add Tag → roi-sequence-complete', y, ps);
    y = subStep(doc, '9.15', 'Click + → Remove Tag → investor-roi  (prevents re-entry into this sequence).', y, ps);
    y = subStep(doc, '9.16', 'Click Save.', y, ps);
    y = subStep(doc, '9.17', 'Toggle to Published.', y, ps);
    y += 12;

    // ════════════════════════════════════════════════════════════════════
    // SECTION F — Test Everything
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'Section F  —  Test Everything', y, ps);
    doc.fontSize(9).fillColor(C.muted)
      .text(
        'Do not skip this. A broken automation is worse than no automation — ' +
        'it creates the false impression that leads are being followed up when they are not.',
        L, y, { width: W },
      );
    y += 18;

    y = stepHeading(doc, 'Step 10 — Run a Full End-to-End Test', y, ps);
    y += 4;

    y = subStep(doc, '10.1',  'Open your live /roi page in a browser.', y, ps);
    y = subStep(doc, '10.2',  'Fill out the contact form using your own name, your real phone number, and a test email you can check.', y, ps);
    y = subStep(doc, '10.3',  'Submit the form.', y, ps);
    y = subStep(doc, '10.4',  'Within 2 minutes, check your phone — the confirmation SMS should arrive.', y, ps);
    y = subStep(doc, '10.5',  'Check your test email inbox — the confirmation email should arrive.', y, ps);
    y = subStep(doc, '10.6',  'Check your own email — the internal notification should arrive.', y, ps);
    y = subStep(doc, '10.7',  'Log into GHL → CRM → confirm a new contact was created with your test name.', y, ps);
    y = subStep(doc, '10.8',  'Go to CRM → Pipelines → Investor Leads — confirm the contact is in the "New Inquiry" column.', y, ps);
    y = subStep(doc, '10.9',  'Open the contact profile — confirm the investor-roi tag is applied.', y, ps);
    y = subStep(doc, '10.10', 'Click the calendar link in the SMS or email — confirm you can book a slot.', y, ps);
    y = subStep(doc, '10.11',
      'If anything did not work, go back to the step that covers that piece and look for typos in ' +
      'webhook URLs, form names in workflow triggers, or calendar visibility settings.',
      y, ps);
    y += 14;

    // ════════════════════════════════════════════════════════════════════
    // QUICK REFERENCE TABLE
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'Quick Reference  —  What Each Piece Does', y, ps);
    y += 4;

    // Table header row
    y = pb(doc, y, 22, ps);
    doc.rect(L, y, W, 18).fill(C.stepTeal);
    doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
      .text('What you built', L + 4, y + 4, { width: TC1, lineBreak: false })
      .text('What it does', L + TC1 + 12, y + 4, { width: TC2, lineBreak: false });
    doc.font('Helvetica');
    y += 18;

    const rows: [string, string][] = [
      ['Investor Leads Pipeline',
        'Shows you visually where every lead is — New Inquiry → Contacted → Qualified → Showing → Closed.'],
      ['Custom Fields (3)',
        'Stores strategy preference (Option A/B), down payment range, and ROI source for every contact.'],
      ['"investor-roi" Tag',
        'Marks every lead from the ROI tool so you can filter, report on, and target them separately.'],
      ['VALORA Investor Inquiry Form',
        'Captures name, email, phone, strategy preference, and down payment range from investors on your site.'],
      ['ROI Walkthrough Calendar',
        'Lets hot leads book a free 30-min call without waiting for a reply. Embedded on the thank-you page.'],
      ['New Lead Workflow (Step 8)',
        'Fires the instant a form is submitted: applies tag, adds to pipeline, sends confirmation SMS + email, notifies you.'],
      ['Cold Lead Follow-Up (Step 9)',
        'Follows up automatically on Day 3 (email), Day 5 (SMS), and Day 10 (final email) if the lead goes quiet.'],
    ];

    for (let i = 0; i < rows.length; i++) {
      y = tableRow(doc, rows[i][0], rows[i][1], y, i % 2 === 0, ps);
    }
    y += 14;

    // ════════════════════════════════════════════════════════════════════
    // IF YOU GET STUCK
    // ════════════════════════════════════════════════════════════════════
    y = sectionHeader(doc, 'If You Get Stuck', y, ps);
    y += 6;

    y = stuckItem(doc,
      'Automation is not firing',
      'Go to Automation → Workflows → click your workflow → check the History tab. GHL shows every ' +
      'contact that entered and whether each action succeeded or failed.',
      y, ps);

    y = stuckItem(doc,
      'SMS is not sending',
      'Check Settings → Phone Numbers. You need a GHL phone number assigned to your account before ' +
      'you can send outbound SMS messages.',
      y, ps);

    y = stuckItem(doc,
      'Form is not connecting to GHL',
      'Double-check that the webhook URL in tokens.json is the exact URL from GHL\'s Integrations page ' +
      'and that it starts with https:// — not http://.',
      y, ps);

    y = stuckItem(doc,
      'Calendar is not showing on the thank-you page',
      'Make sure the calendar is set to Published and that you have set available hours in Step 4.5. ' +
      'An unpublished or zero-availability calendar renders as blank.',
      y, ps);

    y = stuckItem(doc,
      'Contact created but not appearing in the pipeline',
      'Check the Create/Update Opportunity action (Step 8.16). Confirm the Pipeline name is exactly ' +
      '"Investor Leads" and the Stage is "New Inquiry" — spelling and capitalisation must match.',
      y, ps);

    y += 6;

    // Tip box
    y = pb(doc, y, 32, ps);
    doc.save();
    doc.rect(L, y, W, 28).fill('#e8f8f8');
    doc.restore();
    doc.fontSize(9).fillColor(C.stepTeal).font('Helvetica-Bold')
      .text('Tip: ', L + 8, y + 6, { continued: true })
      .font('Helvetica').fillColor(C.ink)
      .text(
        'If you get stuck on any GHL step, search YouTube for "GoHighLevel [step name]". ' +
        'There are free video walkthroughs for every feature in this guide.',
        { width: W - 16 },
      );

    doc.end();
  });

  const pdf = Buffer.concat(chunks);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="VALORA-GHL-Setup-Guide.pdf"',
      'Content-Length': String(pdf.length),
    },
    body: pdf.toString('base64'),
    isBase64Encoded: true,
  };
};
