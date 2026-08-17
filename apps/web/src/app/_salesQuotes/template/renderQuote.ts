import type {
  SalesQuote,
  SalesQuoteLine,
  SalesQuoteOptions,
} from '@/database/schema';

import { DEFAULT_REGION_ORDER, INBOUND } from '../constants';
import type { QuoteLabels } from '../types';
import STANDARD_TEMPLATE from './standardTemplate';
import escapeHtml from '../utils/escapeHtml';
import formatQuoteDate from '../utils/formatQuoteDate';
import prepareQuoteLine from '../utils/prepareQuoteLine';
import renderQuoteRow from '../utils/renderQuoteRow';


/** The subset of a stored quote the renderer needs. */
export interface RenderableQuote
  extends Pick<
    SalesQuote,
    'slug' | 'quoteRef' | 'client' | 'eyebrow' | 'h1' | 'subtitle'
  > {
  lines: SalesQuoteLine[];
  options: SalesQuoteOptions;
  validUntil?: Date | string | null;
  promoUntil?: Date | string | null;
}

/**
 * Render a sales quote into the standard branded template.
 *
 * A TypeScript port of `build_quote.py` in the marketing-site repo, verified
 * to produce byte-identical output for the live TBS and City Drinks quotes.
 * The template itself is copied verbatim in `standardTemplate.ts`, so restyling
 * happens in one place and both builders stay in step.
 *
 * @param quote - The quote to render
 * @returns A complete HTML document
 */
const renderQuote = (quote: RenderableQuote) => {
  const options = quote.options ?? {};

  const labels: QuoteLabels = {
    bottlesOnly: !!options.bottlesOnly,
    offered: !!options.offered,
    stockStatus: !!options.stockStatus,
    pcLabel: options.pcLabel || 'Private Client',
    whLabel: options.whLabel || 'UAE Warehouse',
    ibLabel: options.ibLabel || 'Inbound',
    extraCol: options.extraCol,
  };

  const orderUnit = options.orderUnit === 'case' ? 'case' : 'bottle';
  const perBottle = orderUnit === 'bottle';

  const items = (quote.lines ?? []).map((line) =>
    prepareQuoteLine(line, orderUnit),
  );

  const order = options.regionOrder?.length
    ? options.regionOrder
    : DEFAULT_REGION_ORDER;
  const rank = (region: string) => {
    const index = order.indexOf(region);
    return index === -1 ? 99 : index;
  };

  const regions = [...new Set(items.map((item) => item.region))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );

  let rows = '';
  for (const region of regions) {
    rows += `<tr class="reg" data-reg="${escapeHtml(region)}"><td colspan="${labels.extraCol ? 9 : 8}">${escapeHtml(region)}</td></tr>\n`;
    const inRegion = items
      .filter((item) => item.region === region)
      .sort(
        (a, b) =>
          a.baseKey.localeCompare(b.baseKey) || a.vintageYear - b.vintageYear,
      );
    for (const item of inRegion) rows += renderQuoteRow(item, labels);
  }

  let chips = `<button class="chip on" data-reg="" onclick="setReg(this)">All (${items.length})</button>`;
  for (const region of regions) {
    const count = items.filter((item) => item.region === region).length;
    chips += `<button class="chip" data-reg="${escapeHtml(region)}" onclick="setReg(this)">${escapeHtml(region)} (${count})</button>`;
  }

  const total = items.length;
  const outOfStock = items.filter((item) => item.oos).length;
  const largeFormats = items.filter((item) => item.mag).length;
  const inbound = items.filter(
    (item) => item.region === INBOUND && !item.oos,
  ).length;
  const inStock = total - outOfStock - inbound;

  const stats =
    `<div class="stats"><span class="stat"><b>${total}</b> references</span>` +
    `<span class="stat"><b>${inStock}</b> ${inbound ? `in ${escapeHtml(labels.whLabel)}` : 'in stock'}</span>` +
    (inbound ? `<span class="stat"><b>${inbound}</b> inbound</span>` : '') +
    (outOfStock
      ? `<span class="stat oos"><b>${outOfStock}</b> out of stock</span>`
      : '') +
    `<span class="stat mag"><b>${largeFormats}</b> large formats</span></div>`;

  const validUntil = formatQuoteDate(quote.validUntil);
  const priceBasis = options.priceBasis || 'In Bond, UAE';
  const prefilled = items.some((item) => item.qty > 0);

  const leadNote =
    options.leadNote ||
    'Prices are <strong style="color:var(--teal2)">In Bond, UAE</strong> &mdash; exclusive of duty, tax &amp; delivery, and match the C&amp;C price sheet. ' +
      (perBottle
        ? '<strong style="color:var(--teal2)">Priced &amp; ordered per bottle.</strong> '
        : '<strong style="color:var(--teal2)">Sold by the case</strong> &mdash; single bottles where noted. ') +
      (prefilled
        ? 'Quantities are pre-filled to your request &mdash; adjust as needed, then export or send via WhatsApp.'
        : 'Set quantities, then export or send via WhatsApp.');

  const extraTerms =
    (items.some((item) => item.pc)
      ? `<li><b style="color:#b39dfb">${escapeHtml(labels.pcLabel)}</b> &mdash; these references are reserved private-client stock, offered subject to prior sale.</li>`
      : '') +
    (items.some((item) => item.repack)
      ? '<li><b style="color:#f2a2cd">Repack</b> &mdash; a part-case quantity, drawn from a sealed case and repacked into a new carton (original OWC broken).</li>'
      : '') +
    (inbound
      ? `<li><b>${escapeHtml(INBOUND)}</b> &mdash; purchased and in transit to our UAE bonded warehouse; reserve now against the incoming parcel.</li>`
      : '');

  const bodyClass = [
    perBottle ? 'bottle-mode' : '',
    labels.bottlesOnly ? 'bottles-only' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const subtitle = quote.subtitle || `Prepared for ${quote.client}`;

  const replacements: Record<string, string> = {
    '{{TITLE}}': options.title || `${quote.h1} — Craft & Culture`,
    '{{OG_DESC}}': `${subtitle} · ${inStock} fine wines, prices ${priceBasis}.`,
    '{{PRICE_BASIS}}': priceBasis,
    '{{PRICE_TERMS}}':
      'All prices are <b>In Bond, UAE</b> &mdash; exclusive of duty, tax &amp; delivery. ' +
      `Quotation valid until ${validUntil} and subject to availability.`,
    '{{SLUG}}': quote.slug,
    '{{EYEBROW}}': quote.eyebrow,
    '{{H1}}': quote.h1,
    '{{SUBTITLE}}': subtitle,
    '{{CLIENT}}': quote.client,
    '{{QUOTEREF}}': quote.quoteRef,
    '{{VALIDUNTIL}}': validUntil,
    '{{PROMOUNTIL}}': quote.promoUntil
      ? formatQuoteDate(quote.promoUntil)
      : validUntil,
    '{{STATS}}': stats,
    '{{CHIPS}}': chips,
    '{{ROWS}}': rows,
    '{{EXTRA_TERMS}}': extraTerms,
    '{{BODY_CLASS}}': bodyClass,
    '{{AVAIL_HEAD}}': labels.offered ? 'Offered' : 'Available',
    '{{LEAD_NOTE}}': leadNote,
    '{{UNIT_HEAD}}': perBottle ? 'Bottles' : 'Cases',
    '{{XCOL_TH}}': labels.extraCol
      ? `<th class="r xc" id="hX">${escapeHtml(labels.extraCol.label)}</th>`
      : '',
  };

  let html = STANDARD_TEMPLATE;
  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }

  // the template ships with a path relative to the marketing site's web root;
  // in this app the asset lives under /images
  return html.replace(
    /\.\/cc-logo-cropped\.png/g,
    '/images/cc-logo-cropped.png',
  );
};

export default renderQuote;
