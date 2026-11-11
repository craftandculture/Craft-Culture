import { describe, expect, it } from 'vitest';

import inboundPricingInput from './inboundPricingInput';
import priceListPrice from './priceListPrice';
import pricePricingManagerRow from './pricePricingManagerRow';
import stockPricingInput from './stockPricingInput';
import type { StockPricingRaw } from './stockPricingInput';
import PRICE_LIST_RATES from '../constants/priceListRates';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A lot of one wine as wms_stock + lotShipmentCost return it */
interface Lot {
  receivedAt: Date;
  productCost: number | null;
  landedCost: number | null;
  ownLine: boolean;
}

/**
 * The `(wine, owner)` group stockPricingSelect builds: the newest lot's cost
 * (array_agg … ORDER BY received_at DESC)[1]), the owner's figures alongside.
 */
const group = (
  lots: Lot[],
  rest: Omit<StockPricingRaw, 'lotProductCost' | 'lotLandedCost' | 'lotOwnLine'>,
): StockPricingRaw => {
  const newest = [...lots].sort(
    (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime(),
  )[0];

  return {
    category: 'Wine',
    isCraftCulture: 0,
    isZeroTransferOwner: 0,
    ...rest,
    lotProductCost: newest?.productCost ?? null,
    lotLandedCost: newest?.landedCost ?? null,
    lotOwnLine: newest?.ownLine ?? null,
  };
};

/** What the Pricing Manager shows for a row when it opens on All owners */
const pmShows = (raw: StockPricingRaw) =>
  pricePricingManagerRow(stockPricingInput(raw), {
    ownerSelected: false,
    effInbondPct: 10,
    effPcPct: null,
    inBondMarkupPct: 10,
    pcMarginPct: 0,
  });

const lot = (
  productCost: number,
  landedCost: number,
  receivedAt: string,
  ownLine = true,
): Lot => ({
  productCost,
  landedCost,
  receivedAt: new Date(receivedAt),
  ownLine,
});

describe('priceListPrice', () => {
  it('opens the Pricing Manager on the rates the price lists use', () => {
    expect(PRICE_LIST_RATES).toMatchObject({
      ownerSelected: false,
      inBondMarkupPct: 10,
      pcMarginPct: 0,
    });
  });

  it('prices a single owner with a single lot as before', () => {
    const raw = group([lot(100, 120, '2026-05-01')], {});
    const { ibPerBottle, pcPerBottle } = priceListPrice([
      stockPricingInput(raw),
    ]);

    // 100 import + 20 freight + 2.50 transfer, at the 10% default
    expect(round2(ibPerBottle)).toBe(round2(122.5 / 0.9));
    expect(round2(ibPerBottle)).toBe(round2(pmShows(raw).inBond ?? 0));
    expect(pcPerBottle).toBe(0);
  });

  it('takes the newest lot, not the dearest one or the largest freight', () => {
    // Fourrier Chambolle 1er VV 2021: two lots, the newer one cheaper
    const raw = group(
      [lot(282.07, 330, '2026-03-01'), lot(170, 185, '2026-09-01')],
      { ownerInbondPct: 12 },
    );
    const { ibPerBottle } = priceListPrice([stockPricingInput(raw)]);

    expect(round2(ibPerBottle)).toBe(round2((170 + 15 + 2.5) / 0.88));
    expect(round2(ibPerBottle)).toBe(round2(pmShows(raw).inBond ?? 0));
  });

  it('prices each owner on their own figures and lists the higher price', () => {
    const ihab = group([lot(80, 95, '2026-06-01')], {
      costOverridePerBottle: 10,
      ownerInbondPct: 15,
    });
    const crurated = group([lot(90, 100, '2026-07-01')], {
      isZeroTransferOwner: 1,
      b2bMarginPct: 5,
    });
    const ihabIb = (80 + 15 + 2.5 + 10) / 0.85; // 126.47
    const cruratedIb = (90 + 10 + 0) / 0.95; // 105.26

    const { ibPerBottle } = priceListPrice([
      stockPricingInput(ihab),
      stockPricingInput(crurated),
    ]);

    expect(round2(ibPerBottle)).toBe(round2(Math.max(ihabIb, cruratedIb)));
    expect(round2(ibPerBottle)).toBe(
      round2(Math.max(pmShows(ihab).inBond ?? 0, pmShows(crurated).inBond ?? 0)),
    );

    // The old mix: Crurated's import and freight with Ihab's override and margin
    const mixed = (90 + 15 + 2.5 + 10) / 0.85;
    expect(round2(ibPerBottle)).not.toBe(round2(mixed));
  });

  it('applies the transfer and logistics rule of the owner, not of another', () => {
    const noFreight = (owner: Partial<StockPricingRaw>) =>
      group([{ ...lot(100, 100, '2026-06-01'), landedCost: null }], owner);

    const cc = priceListPrice([
      stockPricingInput(noFreight({ isCraftCulture: 1 })),
    ]);
    const crurated = priceListPrice([
      stockPricingInput(noFreight({ isZeroTransferOwner: 1 })),
    ]);
    const partner = priceListPrice([stockPricingInput(noFreight({}))]);

    // C&C wine: $22.50 logistics fallback + $2.50 transfer
    expect(round2(cc.ibPerBottle)).toBe(round2(125 / 0.9));
    // Crurated: no logistics fallback, $0 transfer
    expect(round2(crurated.ibPerBottle)).toBe(round2(100 / 0.9));
    // Any other partner: no logistics fallback, $2.50 transfer
    expect(round2(partner.ibPerBottle)).toBe(round2(102.5 / 0.9));

    // Two holders: each keeps their own rule; the list takes the higher
    const both = priceListPrice([
      stockPricingInput(noFreight({ isCraftCulture: 1 })),
      stockPricingInput(noFreight({ isZeroTransferOwner: 1 })),
    ]);
    expect(both.ibPerBottle).toBe(cc.ibPerBottle);
  });

  it('derives PC from the rounded In Bond price, as the Pricing Manager does', () => {
    const raw = group([lot(100, 120, '2026-05-01')], {
      ownerInbondPct: 10,
      ownerPcPct: 20,
      sellingPricePerBottle: 999,
    });
    const { ibPerBottle, pcPerBottle } = priceListPrice([
      stockPricingInput(raw),
    ]);

    expect(pcPerBottle).toBe(round2(ibPerBottle) / 0.8);
    expect(pcPerBottle).toBe(pmShows(raw).sellPrice);
  });

  it('falls back to the stored selling price where no PC margin is set', () => {
    const raw = group([lot(100, 120, '2026-05-01')], {
      sellingPricePerBottle: 210,
    });

    expect(priceListPrice([stockPricingInput(raw)]).pcPerBottle).toBe(210);
  });

  it('a line margin beats the owner rate; a spirit reads its old margin', () => {
    const wine = group([lot(100, 100, '2026-05-01')], {
      b2bMarginPct: 25,
      ownerInbondPct: 10,
    });
    const spirit = group([lot(100, 100, '2026-05-01')], {
      category: 'Spirits',
      sellMarginPct: 30,
    });
    const wineWithSellMargin = group([lot(100, 100, '2026-05-01')], {
      sellMarginPct: 30,
    });

    expect(round2(priceListPrice([stockPricingInput(wine)]).ibPerBottle)).toBe(
      round2(102.5 / 0.75),
    );
    expect(
      round2(priceListPrice([stockPricingInput(spirit)]).ibPerBottle),
    ).toBe(round2(102.5 / 0.7));
    // On a wine the old spirit margin is ignored, as on the Pricing Manager
    expect(
      round2(priceListPrice([stockPricingInput(wineWithSellMargin)]).ibPerBottle),
    ).toBe(round2(102.5 / 0.9));
  });

  it("raises both prices to a live mandate's ask grossed up by 5%", () => {
    const raw = group([lot(100, 100, '2026-05-01')], { ownerPcPct: 10 });
    const { ibPerBottle, pcPerBottle } = priceListPrice(
      [stockPricingInput(raw)],
      '400',
    );

    expect(ibPerBottle).toBe(400 / 0.95);
    expect(pcPerBottle).toBe(400 / 0.95);

    // Below the cost-model price the ask changes nothing
    const low = priceListPrice([stockPricingInput(raw)], 50);
    expect(low.ibPerBottle).toBe(pmShows(raw).inBond);
  });

  it('prices a repack from the base wine it was cut from', () => {
    // A 1-pack has no invoice line of its own: lotShipmentCost stands the
    // 6-pack's line in, so the per-bottle cost and price are the case's
    const base = group([lot(150, 170, '2026-05-01', true)], {});
    const repack = group([lot(150, 170, '2026-08-01', false)], {});

    expect(priceListPrice([stockPricingInput(repack)]).ibPerBottle).toBe(
      priceListPrice([stockPricingInput(base)]).ibPerBottle,
    );

    // On a stand-in line a typed import price wins; on an own line it does not
    const typed = { importPricePerBottle: 140 };
    expect(
      stockPricingInput({ ...repack, ...typed }).importPricePerBottle,
    ).toBe(140);
    expect(stockPricingInput({ ...base, ...typed }).importPricePerBottle).toBe(
      150,
    );
  });

  it('has no price where there is no cost, and never a negative freight', () => {
    expect(
      priceListPrice([stockPricingInput(group([], {}))]).ibPerBottle,
    ).toBe(0);
    expect(
      stockPricingInput(group([lot(100, 90, '2026-05-01')], {})).systemLogistics,
    ).toBe(0);
  });

  it('matches the Pricing Manager row for row across fixtures', () => {
    const fixtures: StockPricingRaw[] = [
      group([lot(55, 70, '2026-01-01')], { ownerInbondPct: 18, ownerPcPct: 25 }),
      group([lot(1213, 1260, '2026-02-01')], { importPricePerBottle: 700 }),
      group([lot(40, 40, '2026-03-01', false)], {
        importPricePerBottle: 48,
        lineLogistics: 6,
        transferPricePerBottle: 1,
        pcMarginPct: 30,
      }),
      group([], { costOverridePerBottle: 12, isCraftCulture: 1 }),
    ];

    for (const raw of fixtures) {
      const pm = pmShows(raw);
      const list = priceListPrice([stockPricingInput(raw)]);

      expect(list.ibPerBottle).toBe(pm.inBond ?? 0);
      expect(list.pcPerBottle).toBe(pm.sellPrice ?? 0);
    }
  });
});

describe('inboundPricingInput', () => {
  it('prices in-transit wine on the air-freight estimate until freight lands', () => {
    const line = inboundPricingInput({
      importPricePerBottle: 100,
      allocatedFreight: 0,
      category: 'Wine',
    });
    const { ibPerBottle } = priceListPrice([line]);

    // $20 estimate + $2.50 transfer at the 10% default — not 0%
    expect(round2(ibPerBottle)).toBe(round2(122.5 / 0.9));
  });

  it('prices each shipment separately and keeps the higher', () => {
    const early = inboundPricingInput({
      importPricePerBottle: 100,
      allocatedFreight: 12,
      isZeroTransferOwner: 1,
    });
    const late = inboundPricingInput({
      importPricePerBottle: 90,
      allocatedFreight: 30,
      ownerInbondPct: 20,
    });

    expect(priceListPrice([early, late]).ibPerBottle).toBe(
      Math.max(112 / 0.9, 122.5 / 0.8),
    );
  });
});
