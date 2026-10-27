import { describe, expect, it } from 'vitest';

import parseInBondMarket from './parseInBondMarket';

const order = (bidAsk: string, price: number, extra: Record<string, unknown> = {}) => ({
  vintage: '2010',
  format: '750',
  duty_code: 'IB',
  bid_ask: bidAsk,
  adjusted_price: price,
  source: 'bordeaux_index',
  ...extra,
});

const trade = (price: number, at: string, extra: Record<string, unknown> = {}) => ({
  vintage: '2010',
  format: '750',
  duty_code: 'IB',
  adjusted_price: price,
  traded_at: at,
  source: 'bbx',
  ...extra,
});

describe('parseInBondMarket', () => {
  it('takes the highest bid, the lowest ask and the latest trade', () => {
    const market = parseInBondMarket(
      { results: [order('BID', 356), order('BID', 612), order('ASK', 700), order('ASK', 655)] },
      { results: [trade(640, '2026-09-24T07:28:13'), trade(657, '2026-10-12T11:41:23')] },
      '2010',
    );
    expect(market).toMatchObject({ bidUsd: 612, askUsd: 655, lastUsd: 657, bids: 2, asks: 2, trades: 2 });
    expect(market.lastTradedAt?.toISOString().slice(0, 10)).toBe('2026-10-12');
    expect(market.venues).toEqual(['bordeaux_index', 'bbx']);
  });

  it('ignores other vintages, magnums and duty-paid rows', () => {
    const market = parseInBondMarket(
      {
        results: [
          order('ASK', 100, { vintage: '2011' }),
          order('ASK', 200, { format: '1500' }),
          order('ASK', 300, { duty_code: 'DP' }),
          order('ASK', 400),
        ],
      },
      null,
      '2010',
    );
    expect(market.askUsd).toBe(400);
    expect(market.asks).toBe(1);
  });

  it('is empty, not an error, when the exchanges have nothing', () => {
    expect(parseInBondMarket({ results: [] }, { results: [] }, '2010')).toEqual({
      bidUsd: null,
      askUsd: null,
      lastUsd: null,
      lastTradedAt: null,
      bids: 0,
      asks: 0,
      trades: 0,
      venues: [],
    });
    expect(parseInBondMarket(null, null, '2010').askUsd).toBeNull();
  });

  it('skips rows without a usable price', () => {
    expect(parseInBondMarket({ results: [order('BID', 0), order('BID', Number.NaN)] }, null, '2010').bids).toBe(0);
  });
});
