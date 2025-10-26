import { describe, expect, it } from 'vitest';

import { calculateQuote } from './calculateQuote';

describe('calculateQuote', () => {
  // Helper to create a simple product offer
  const createOffer = (overrides = {}) => ({
    id: 'offer-1',
    productId: 'product-1',
    externalId: 'ext-1',
    source: 'CultX',
    price: 100,
    currency: 'USD',
    unitCount: 12,
    unitSize: '750ml',
    availableQuantity: 100,
    product: {
      id: 'product-1',
      lwin18: '1234567890123456',
      name: 'Test Wine 2020',
      region: 'Bordeaux',
      producer: 'Test Producer',
      year: 2020,
    },
    ...overrides,
  });

  // Helper to create simple cell mappings
  const createCellMappings = () => ({
    name: 'A2:A11',
    lwin18: 'B2:B11',
    region: 'C2:C11',
    producer: 'D2:D11',
    vintage: 'E2:E11',
    quantity: 'F2:F11',
    unitCount: 'G2:G11',
    unitSize: 'H2:H11',
    source: 'I2:I11',
    price: 'J2:J11',
    currency: 'K2:K11',
    exchangeRateUsd: 'L2:L11',
    basePriceUsd: 'M2:M11',
    priceUsd: 'N2:N11',
    customerType: 'O1',
    finalPriceUsd: 'P1',
  });

  // Helper to create formula data with a simple calculation
  const createFormulaData = () => ({
    sheets: [
      {
        sheetName: 'Sheet1',
        formulas: [
          // Row 1: Headers + calculation cells
          [
            'Name',
            'LWIN18',
            'Region',
            'Producer',
            'Vintage',
            'Quantity',
            'UnitCount',
            'UnitSize',
            'Source',
            'Price',
            'Currency',
            'ExchangeRate',
            'BasePriceUSD',
            'PriceUSD',
            'CustomerType',
            '=SUM(N2:N11)', // P1: Total (finalPriceUsd)
          ],
          // Row 2: First line item with formula
          [
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '=J2*L2', // M2: BasePriceUSD = Price * ExchangeRate
            '=M2*F2', // N2: PriceUSD = BasePriceUSD * Quantity
            '',
            '',
          ],
          // Rows 3-11: Additional line items (same formula pattern)
          ...Array.from({ length: 9 }, (_, i) => {
            const row = i + 3;
            return [
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              `=J${row}*L${row}`, // BasePriceUSD
              `=M${row}*F${row}`, // PriceUSD
              '',
              '',
            ];
          }),
        ],
        values: [],
      },
    ],
    namedExpressions: [],
  });

  describe('basic calculations', () => {
    it('should calculate quote for single line item', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 2 }];
      const offers = [createOffer()];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result).toBeDefined();
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]?.productId).toBe('product-1');
      // Price: 100 * 1 (exchange rate) * 2 (quantity) = 200
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(200);
      expect(result.totalUsd).toBe(200);
    });

    it('should calculate quote for multiple line items', () => {
      const lineItems = [
        { offerId: 'offer-1', quantity: 2 },
        { offerId: 'offer-2', quantity: 3 },
      ];
      const offers = [
        createOffer({ id: 'offer-1', productId: 'product-1', price: 100 }),
        createOffer({ id: 'offer-2', productId: 'product-2', price: 50 }),
      ];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result.lineItems).toHaveLength(2);
      // First item: 100 * 1 * 2 = 200
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(200);
      // Second item: 50 * 1 * 3 = 150
      expect(result.lineItems[1]?.lineItemTotalUsd).toBe(150);
      // Total: 200 + 150 = 350
      expect(result.totalUsd).toBe(350);
    });

    it('should handle different customer types', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 1 }];
      const offers = [createOffer()];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const exchangeRates = new Map([['USD', 1]]);

      const b2bResult = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        'b2b',
        exchangeRates,
      );

      const b2cResult = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        'b2c',
        exchangeRates,
      );

      // Both should calculate (customer type affects formulas in real scenarios)
      expect(b2bResult).toBeDefined();
      expect(b2cResult).toBeDefined();
      expect(b2bResult.lineItems).toHaveLength(1);
      expect(b2cResult.lineItems).toHaveLength(1);
    });
  });

  describe('exchange rate handling', () => {
    it('should apply exchange rate for EUR currency', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 1 }];
      const offers = [
        createOffer({
          price: 100,
          currency: 'EUR',
        }),
      ];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['EUR', 1.1]]); // 1 EUR = 1.1 USD

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      // Price: 100 EUR * 1.1 (exchange rate) * 1 (quantity) = 110 USD
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(110);
      expect(result.totalUsd).toBe(110);
    });

    it('should default to exchange rate of 1 for unknown currency', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 1 }];
      const offers = [
        createOffer({
          price: 100,
          currency: 'XYZ', // Unknown currency
        }),
      ];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map(); // No exchange rate for XYZ

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      // Price: 100 * 1 (default) * 1 (quantity) = 100
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty line items', () => {
      const lineItems: Array<{ offerId: string; quantity: number }> = [];
      const offers = [createOffer()];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result.lineItems).toHaveLength(0);
      expect(result.totalUsd).toBe(0);
    });

    it('should handle line item with missing offer', () => {
      const lineItems = [
        { offerId: 'offer-1', quantity: 2 },
        { offerId: 'missing-offer', quantity: 3 }, // This offer doesn't exist
      ];
      const offers = [createOffer({ id: 'offer-1', price: 100 })];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(200);
      // Missing offer should result in empty product ID and 0 total
      expect(result.lineItems[1]?.productId).toBe('');
      expect(result.lineItems[1]?.lineItemTotalUsd).toBe(0);
    });

    it('should handle zero quantity', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 0 }];
      const offers = [createOffer({ price: 100 })];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(0);
      expect(result.totalUsd).toBe(0);
    });

    it('should handle zero price', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 5 }];
      const offers = [createOffer({ price: 0 })];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(0);
      expect(result.totalUsd).toBe(0);
    });

    it('should handle product with null region and producer', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 1 }];
      const offers = [
        createOffer({
          product: {
            id: 'product-1',
            lwin18: '1234567890123456',
            name: 'Test Wine',
            region: null,
            producer: null,
            year: null,
          },
        }),
      ];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      // Should still calculate despite null values
      expect(result).toBeDefined();
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(100);
    });
  });

  describe('decimal and precision', () => {
    it('should handle decimal prices correctly', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 3 }];
      const offers = [createOffer({ price: 99.99 })];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      // Price: 99.99 * 1 * 3 = 299.97
      expect(result.lineItems[0]?.lineItemTotalUsd).toBeCloseTo(299.97, 2);
      expect(result.totalUsd).toBeCloseTo(299.97, 2);
    });

    it('should handle decimal exchange rates correctly', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 1 }];
      const offers = [createOffer({ price: 100, currency: 'GBP' })];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['GBP', 1.27]]); // 1 GBP = 1.27 USD

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      // Price: 100 * 1.27 * 1 = 127
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(127);
      expect(result.totalUsd).toBe(127);
    });
  });

  describe('large quotes', () => {
    it('should handle maximum line items (10)', () => {
      const lineItems = Array.from({ length: 10 }, (_, i) => ({
        offerId: `offer-${i + 1}`,
        quantity: 1,
      }));
      const offers = Array.from({ length: 10 }, (_, i) =>
        createOffer({
          id: `offer-${i + 1}`,
          productId: `product-${i + 1}`,
          price: 100,
        }),
      );
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result.lineItems).toHaveLength(10);
      // Each item: 100 * 1 * 1 = 100, total = 1000
      expect(result.totalUsd).toBe(1000);
    });

    it('should handle large quantities', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 1000 }];
      const offers = [createOffer({ price: 50 })];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      // Price: 50 * 1 * 1000 = 50,000
      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(50000);
      expect(result.totalUsd).toBe(50000);
    });

    it('should handle large prices', () => {
      const lineItems = [{ offerId: 'offer-1', quantity: 1 }];
      const offers = [createOffer({ price: 999999 })];
      const cellMappings = createCellMappings();
      const formulaData = createFormulaData();
      const customerType = 'b2c';
      const exchangeRates = new Map([['USD', 1]]);

      const result = calculateQuote(
        lineItems,
        offers,
        cellMappings,
        formulaData,
        customerType,
        exchangeRates,
      );

      expect(result.lineItems[0]?.lineItemTotalUsd).toBe(999999);
      expect(result.totalUsd).toBe(999999);
    });
  });
});
