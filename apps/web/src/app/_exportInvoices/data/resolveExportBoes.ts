import { and, inArray, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock, wmsStockReservations } from '@/database/schema';

import type { ExportBoeLookup, ExportInvoiceInput } from '../utils/buildExportLines';

/**
 * The part of an LWIN-18 that says which wine it is, ignoring the pack
 *
 * Code and vintage plus bottle size. Orders and
 * stock are matched on this because an order for a 6-pack is routinely filled
 * from a 12-pack or a bay that was repacked — the BOE is the same either way.
 *
 * @param lwin18 - A dashed LWIN-18
 * @returns The pack-agnostic key
 */
const wineKey = (lwin18: string) => {
  const [code, vintage, , size] = lwin18.split('-');
  return `${code}-${vintage}|${size}`;
};

/** Code and vintage, the part every pack of a wine shares */
const winePrefix = (lwin18: string) => lwin18.split('-').slice(0, 2).join('-');

/**
 * Whether a code has the LWIN-18 shape
 *
 * Numeric LWINs, internal 9000001+ codes and the alphanumeric codes Crurated
 * stock is held under (`WITEP3R20B-2020-06-00750`) all share it: code,
 * vintage, pack, size. Only the shape matters for matching stock.
 */
const hasLwinShape = (code: string) => /^[A-Z0-9]+-\d{4}-\d{2}-\d{5}$/i.test(code);

const digits = (boe: string | null) => boe?.replace(/\D/g, '') || null;

/**
 * Find the re-export BOE behind every invoice line
 *
 * The reservation an order line took is the only record of exactly which
 * stock row it was filled from, so that is used first. Without one, the
 * Stock Explorer lots of the same wine are read, zero-quantity included,
 * since a lot that has just been picked out still carries its BOE. One BOE
 * among them is taken; several are offered for the operator to choose, as
 * picking the larger lot by default has put the wrong BOE on a document.
 *
 * @param invoices - The invoices being exported
 * @returns Lookups keyed `${soNumber}|${lwin18}`
 */
const resolveExportBoes = async (invoices: ExportInvoiceInput[]) => {
  const result = new Map<string, ExportBoeLookup>();
  const wanted = invoices.flatMap((inv) =>
    inv.lines
      .filter((l) => l.lwin18 && hasLwinShape(l.lwin18))
      .map((l) => ({ order: inv.soNumber ?? inv.invoiceNumber, lwin18: l.lwin18 as string })),
  );
  if (wanted.length === 0) return result;

  const orders = [...new Set(wanted.map((w) => w.order))];
  const reserved = await db
    .select({
      orderNumber: wmsStockReservations.orderNumber,
      lwin18: wmsStockReservations.lwin18,
      boe: wmsStock.reExportBoeNumber,
      ownerName: wmsStock.ownerName,
    })
    .from(wmsStockReservations)
    .innerJoin(wmsStock, sql`${wmsStock.id} = ${wmsStockReservations.stockId}`)
    .where(
      and(
        inArray(wmsStockReservations.orderNumber, orders),
        ne(wmsStockReservations.status, 'released'),
      ),
    );

  const prefixes = [...new Set(wanted.map((w) => winePrefix(w.lwin18)))];
  const lots = await db
    .select({
      lwin18: wmsStock.lwin18,
      boe: wmsStock.reExportBoeNumber,
      ownerName: wmsStock.ownerName,
      quantityCases: wmsStock.quantityCases,
    })
    .from(wmsStock)
    .where(inArray(sql`split_part(${wmsStock.lwin18}, '-', 1) || '-' || split_part(${wmsStock.lwin18}, '-', 2)`, prefixes));

  for (const { order, lwin18 } of wanted) {
    const key = wineKey(lwin18);
    const fromReservation = reserved.filter(
      (r) => r.orderNumber === order && wineKey(r.lwin18) === key && digits(r.boe),
    );
    const reservedBoes = [...new Set(fromReservation.map((r) => digits(r.boe)))];
    if (reservedBoes.length === 1) {
      result.set(`${order}|${lwin18}`, {
        boe: reservedBoes[0] ?? null,
        ownerName: fromReservation[0]?.ownerName ?? null,
        candidates: [],
      });
      continue;
    }

    const byBoe = new Map<string, { ownerName: string | null; quantityCases: number }>();
    for (const lot of lots.filter((l) => wineKey(l.lwin18) === key)) {
      const boe = digits(lot.boe);
      if (!boe) continue;
      const prev = byBoe.get(boe);
      byBoe.set(boe, {
        ownerName: prev && prev.ownerName !== lot.ownerName ? null : lot.ownerName,
        quantityCases: (prev?.quantityCases ?? 0) + lot.quantityCases,
      });
    }
    const candidates = [...byBoe.entries()].map(([boe, v]) => ({ boe, ...v }));
    result.set(`${order}|${lwin18}`, {
      boe: candidates.length === 1 ? (candidates[0]?.boe ?? null) : null,
      ownerName: candidates.length === 1 ? (candidates[0]?.ownerName ?? null) : null,
      candidates: candidates.length > 1 ? candidates : [],
    });
  }

  return result;
};

export default resolveExportBoes;
