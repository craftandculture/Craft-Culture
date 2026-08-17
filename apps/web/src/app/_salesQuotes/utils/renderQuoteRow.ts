import { INBOUND, MAGNUM_ICON, NOTE_ICON } from '../constants';
import type { PreparedLine, QuoteLabels } from '../types';
import escapeHtml from './escapeHtml';
import largeFormatLabel from './largeFormatLabel';

/**
 * Render one table row of a quote.
 *
 * Mirrors `row_html` in the Python builder. Two behaviours are load-bearing:
 *
 * - In `offered` mode the stepper always allows the full parcel, otherwise a
 *   zero-quantity open offer would be capped at 0 and could not be ordered at
 *   all. The cell reads "q of n" whenever more stock sits behind the line than
 *   was offered, so the client can see the upside.
 * - Every chip also flows into `data-note`, which is what the CSV export and
 *   WhatsApp message read, so a label never appears on screen only.
 *
 * @param line - A line already resolved by prepareQuoteLine
 * @param labels - Resolved label set for this quote
 * @returns The `<tr>` markup
 */
/** How many optional columns sit after Total. */
const trailingCols = (labels: QuoteLabels) =>
  (labels.extraCol ? 1 : 0) + (labels.gpScenarios?.length ? 2 : 0);

const renderQuoteRow = (line: PreparedLine, labels: QuoteLabels) => {
  const format = labels.bottlesOnly
    ? line.size
    : `${line.pack} &times; ${line.size}`;
  const magnumChip = line.mag
    ? ` <span class="lf">${MAGNUM_ICON}${largeFormatLabel(line.sizeCl)}</span>`
    : '';

  const isInbound = line.region === INBOUND;
  const stockLabel =
    line.loc || (isInbound ? labels.ibLabel : labels.whLabel);
  const stockChip = labels.stockStatus
    ? ` <span class="${isInbound ? 'ib' : 'wh'}">${escapeHtml(stockLabel)}</span>`
    : '';
  const promoChip = line.promo
    ? ' <span class="promo">Discount Promo</span>'
    : '';
  const pcChip = line.pc
    ? ` <span class="pc">${escapeHtml(labels.pcLabel)}</span>`
    : '';
  const repackChip = line.repack ? ' <span class="rp">Repack</span>' : '';
  const noteLine = line.note
    ? `<span class="repl">${NOTE_ICON}${escapeHtml(line.note)}</span>`
    : '';

  const note = [
    ...(labels.stockStatus ? [stockLabel] : []),
    ...(line.promo ? ['Discount Promo'] : []),
    ...(line.pc ? [labels.pcLabel] : []),
    ...(line.repack ? ['Repack'] : []),
    ...(line.note ? [`Note: ${line.note}`] : []),
  ].join(' | ');

  // separate columns in the CSV export beat one blended string
  const flags = [
    ...(line.promo ? ['Discount Promo'] : []),
    ...(line.pc ? [labels.pcLabel] : []),
    ...(line.repack ? ['Repack'] : []),
  ].join('; ');

  const exportAttrs =
    ` data-sect="${escapeHtml(line.region)}" data-loc="${escapeHtml(labels.stockStatus ? stockLabel : '')}"` +
    ` data-flags="${escapeHtml(flags)}" data-pack="${line.pack}" data-size="${escapeHtml(line.size)}"` +
    ` data-note2="${escapeHtml(line.note)}"`;

  const formatText =
    (labels.bottlesOnly ? line.size : `${line.pack} x ${line.size}`) +
    (line.mag ? ` ${largeFormatLabel(line.sizeCl)}` : '');

  const search = escapeHtml(
    [
      line.wine,
      line.vintage,
      line.region,
      line.promo ? 'promo discount' : '',
      line.pc ? labels.pcLabel : '',
      line.repack ? 'repack' : '',
      labels.stockStatus ? stockLabel : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  );

  if (line.oos) {
    return (
      `<tr class="oosrow" data-reg="${escapeHtml(line.region)}" data-s="${search}"><td class="cb"></td>` +
      `<td class="w" data-label="Wine"><s>${escapeHtml(line.wine)}</s>${noteLine}</td>` +
      `<td class="c" data-label="Vintage">${escapeHtml(line.vintage)}</td><td class="c" data-label="Format">${format}${magnumChip}</td>` +
      `<td class="c" data-label="Avail">0</td><td class="status" colspan="${3 + trailingCols(labels)}"><span class="oos-badge"><span class="oos-dot"></span>Out of Stock</span></td></tr>\n`
    );
  }

  let units: number;
  let availCell: string;

  if (labels.offered) {
    units = line.maxUnits || line.qty;
    const word = `${line.unit}${units === 1 ? '' : 's'}`;
    const shown =
      line.qty && units > line.qty
        ? `${line.qty} of ${units} ${word}`
        : `${line.qty || units} ${word}`;
    availCell = units
      ? `<span class="offered">${shown}</span>`
      : '<span class="offered">Offered</span>';
  } else {
    units = line.maxUnits;
    const word = `${line.unit}${units === 1 ? '' : 's'}`;
    const text = `${units} ${word}`;
    availCell = line.low
      ? `<span class="low">${text}</span>`
      : units
        ? text
        : '';
  }

  const bottlePriced = line.bottleMode || line.single;
  const unitAed = bottlePriced ? line.bottleAed : line.caseAed;
  const unitUsd = bottlePriced ? line.bottleUsd : line.caseUsd;

  let bottleCell: string;
  let caseCell: string;

  if (line.bottleMode) {
    // ordering per bottle: bottle price leads, case price shown as reference
    bottleCell = `<td class="p" data-label="Bottle" data-aed="${line.bottleAed}" data-usd="${line.bottleUsd}"></td>`;
    caseCell = `<td class="p pb" data-label="Case" data-aed="${line.caseAed}" data-usd="${line.caseUsd}"></td>`;
  } else if (line.single) {
    bottleCell = `<td class="p" data-label="Bottle" data-aed="${line.bottleAed}" data-usd="${line.bottleUsd}"></td>`;
    caseCell = '<td class="p" data-label="Case" data-aed="" data-usd=""></td>';
  } else {
    bottleCell = `<td class="p pb" data-label="Bottle" data-aed="${line.bottleAed}" data-usd="${line.bottleUsd}"></td>`;
    caseCell = `<td class="p" data-label="Case" data-aed="${line.caseAed}" data-usd="${line.caseUsd}"></td>`;
  }

  // derived reference price on the ordering unit, so it tracks the same figure
  // the Total column multiplies
  let extraCell = '';
  let extraAttrs = '';
  if (labels.extraCol) {
    const extraAed = Math.round(unitAed * labels.extraCol.multiplier);
    const extraUsd = Math.round(unitUsd * labels.extraCol.multiplier);
    extraAttrs = ` data-xaed="${extraAed}" data-xusd="${extraUsd}"`;
    extraCell =
      `<td class="p xc" data-label="${escapeHtml(labels.extraCol.label)}" ` +
      `data-aed="${extraAed}" data-usd="${extraUsd}"></td>`;
  }

  let scenarioCells = '';
  if (labels.gpScenarios?.length) {
    const multiplier = labels.extraCol?.multiplier ?? 1;
    const baseAed = Math.round(unitAed * multiplier);
    const baseUsd = Math.round(unitUsd * multiplier);
    extraAttrs += ` data-saed="${baseAed}" data-susd="${baseUsd}"`;
    scenarioCells =
      '<td class="sc sell first" data-label="Sell"></td>' +
      '<td class="sc prof" data-label="Profit"></td>';
  }

  return (
    `<tr class="item" data-reg="${escapeHtml(line.region)}" data-s="${search}" data-maxc="${units}" data-unit="${line.unit}" ` +
    `data-wine="${escapeHtml(line.wine)}" data-vtg="${escapeHtml(line.vintage)}" data-fmt="${escapeHtml(formatText)}" data-note="${escapeHtml(note)}" data-avail="${units}" ` +
    `data-baed="${line.bottleAed}" data-busd="${line.bottleUsd}" data-caed="${unitAed}" data-cusd="${unitUsd}"${extraAttrs}${exportAttrs} onclick="rowClick(event,this)">` +
    `<td class="cb"><div class="qty"><button class="qb" onclick="event.stopPropagation();chg(event,-1)">&minus;</button>` +
    `<input class="qi" type="number" min="0" max="${units}" value="${line.qty}" onclick="event.stopPropagation()" oninput="clampQ(this);upd()">` +
    `<button class="qb" onclick="event.stopPropagation();chg(event,1)">+</button></div></td>` +
    `<td class="w" data-label="Wine">${escapeHtml(line.wine)}${stockChip}${promoChip}${pcChip}${repackChip}${noteLine}</td>` +
    `<td class="c" data-label="Vintage">${escapeHtml(line.vintage)}</td><td class="c" data-label="Format">${format}${magnumChip}</td>` +
    `<td class="c" data-label="Avail">${availCell}</td>${bottleCell}${caseCell}<td class="tp r" data-label="Total"></td>${extraCell}${scenarioCells}</tr>\n`
  );
};

export default renderQuoteRow;
