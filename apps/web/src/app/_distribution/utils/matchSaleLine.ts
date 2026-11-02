import type { SaleLayer } from './allocateSale';
import scoreWineMatch from './scoreWineMatch';
import wineKey from './wineKey';

export interface RegisterCode {
  outletCode: string | null;
  docRef: string | null;
  wineName: string;
  ownerId: string | null;
  ownerName: string | null;
}

export interface SaleLineInput {
  outletCode: string;
  productName: string;
}

export interface MatchContext {
  /** Outlet code (squashed) → our code, from links and every snapshot */
  bridge: Map<string, string>;
  /** Every invoice line at this outlet, any owner, any type */
  layers: SaleLayer[];
  register: RegisterCode[];
  /** Arrangement of each owner at this outlet */
  arrangementByOwner: Map<string, string>;
  ownerOfArrangement: Map<string, string>;
}

export type SaleMatch =
  | {
      matched: true;
      layers: SaleLayer[];
      /** Where bottles past every line go, when the register says */
      shortTo: string | null;
      via: string;
    }
  | {
      matched: false;
      reason: string;
      suggestion: {
        ownerId: string | null;
        lwin18: string | null;
        productName: string | null;
        why: string;
      } | null;
    };

/** A name match this strong is worth offering, never worth applying */
const SUGGEST = 0.6;
const ON_INVOICE = 0.5;

const squash = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Find the invoice lines an outlet's sales line drew down
 *
 * Three roads, in order, each tried until one reaches a line we invoiced:
 *
 * 1. **The code.** A person's link, or the code City Drinks publish beside
 *    ours in their feed — from any day's feed, not just today's. A wine they
 *    sold out of drops off the feed, and reading only the latest snapshot is
 *    how San Polo (26 bottles) came to be "nobody's".
 * 2. **The Codes tab.** The register names the invoices each CDR code came in
 *    on; the line on that invoice with the same wine is the one.
 * 3. **The name.** Only ever a suggestion, for a person to confirm with one
 *    click — a guess applied silently is how wine ends up on the wrong
 *    statement.
 *
 * Matching is pack-agnostic throughout: a wine invoiced in sixes and sold
 * under a 3-pack code is one wine.
 *
 * @param line - The outlet's sales line
 * @param context - Everything known at this outlet
 * @returns The lines it drew down, or why there are none and a suggestion
 */
const matchSaleLine = (
  line: SaleLineInput,
  context: MatchContext,
): SaleMatch => {
  const code = squash(line.outletCode);
  const listed = context.register.filter((row) => row.outletCode === code);
  const listedOwner = listed.find((row) => row.ownerId)?.ownerId ?? null;
  const shortTo = listedOwner
    ? (context.arrangementByOwner.get(listedOwner) ?? null)
    : null;

  const ofKey = (key: string) =>
    context.layers.filter(
      (layer) => wineKey(layer.lwin18 ?? layer.productName) === key,
    );

  const ours = context.bridge.get(code);

  if (ours) {
    const layers = ofKey(wineKey(ours));

    if (layers.length > 0) {
      return { matched: true, layers, shortTo, via: 'code' };
    }
  }

  for (const row of listed) {
    if (!row.docRef) continue;

    const onInvoice = context.layers
      .filter((layer) => layer.docRef === row.docRef)
      .map((layer) => ({
        layer,
        score: scoreWineMatch(layer.productName, row.wineName).score,
      }))
      .filter((hit) => hit.score >= ON_INVOICE)
      .sort((a, b) => b.score - a.score);

    const hit = onInvoice[0]?.layer;

    if (hit) {
      return {
        matched: true,
        layers: ofKey(wineKey(hit.lwin18 ?? hit.productName)),
        shortTo,
        via: `Codes tab (${row.docRef})`,
      };
    }
  }

  /* Nothing reached a line: say why, and offer the likeliest */
  const named = listed[0]?.wineName ?? line.productName;
  let best: { layer: SaleLayer; score: number } | null = null;

  for (const layer of context.layers) {
    const { score } = scoreWineMatch(layer.productName, named);

    if (score >= SUGGEST && (!best || score > best.score)) {
      best = { layer, score };
    }
  }

  const bestOwner = best
    ? (context.ownerOfArrangement.get(best.layer.arrangementId) ?? null)
    : null;

  const reason = listed.length
    ? `Codes tab names ${listed[0]?.ownerName ?? 'an owner'} on ${listed
        .map((row) => row.docRef)
        .filter(Boolean)
        .join(', ')}, but no line there matches by name`
    : ours
      ? 'Code resolves to a wine never invoiced to this outlet'
      : 'Code is in no City Drinks feed and not on the Codes tab';

  if (best) {
    return {
      matched: false,
      reason,
      suggestion: {
        ownerId: listedOwner ?? bestOwner,
        lwin18: best.layer.lwin18,
        productName: best.layer.productName,
        why: `Name matches ${best.layer.productName}${best.layer.docRef ? ` on ${best.layer.docRef}` : ''}`,
      },
    };
  }

  return {
    matched: false,
    reason,
    suggestion: listedOwner
      ? {
          ownerId: listedOwner,
          lwin18: null,
          productName: null,
          why: 'Owner from the Codes tab; the wine still needs choosing',
        }
      : null,
  };
};

export default matchSaleLine;
