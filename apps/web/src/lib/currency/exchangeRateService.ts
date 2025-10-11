// ECB supported currencies as string literal types
export type SupportedCurrency =
  | 'EUR' // Base currency
  | 'USD'
  | 'JPY'
  | 'BGN'
  | 'CZK'
  | 'DKK'
  | 'GBP'
  | 'HUF'
  | 'PLN'
  | 'RON'
  | 'SEK'
  | 'CHF'
  | 'ISK'
  | 'NOK'
  | 'TRY'
  | 'AUD'
  | 'BRL'
  | 'CAD'
  | 'CNY'
  | 'HKD'
  | 'IDR'
  | 'ILS'
  | 'INR'
  | 'KRW'
  | 'MXN'
  | 'MYR'
  | 'NZD'
  | 'PHP'
  | 'SGD'
  | 'THB'
  | 'ZAR';

interface ECBResponse {
  structure: {
    dimensions: {
      observation: Array<{
        values: Array<{
          id: string;
          name: string;
        }>;
      }>;
    };
  };
  dataSets: Array<{
    series: Record<
      string,
      {
        observations: Record<string, [number]>;
      }
    >;
  }>;
}

export interface ExchangeRateData {
  date: string;
  rate: number;
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
}

export interface MultiDayRateResult {
  rates: ExchangeRateData[];
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  startDate: string;
  endDate: string;
}

class ExchangeRateService {
  // ECB supported currencies (EUR is the base currency)
  private readonly ECB_SUPPORTED_CURRENCIES: SupportedCurrency[] = [
    'USD',
    'JPY',
    'BGN',
    'CZK',
    'DKK',
    'GBP',
    'HUF',
    'PLN',
    'RON',
    'SEK',
    'CHF',
    'ISK',
    'NOK',
    'TRY',
    'AUD',
    'BRL',
    'CAD',
    'CNY',
    'HKD',
    'IDR',
    'ILS',
    'INR',
    'KRW',
    'MXN',
    'MYR',
    'NZD',
    'PHP',
    'SGD',
    'THB',
    'ZAR',
  ];

  private validateCurrencySupport(
    from: SupportedCurrency,
    to: SupportedCurrency,
  ): void {
    // EUR is always supported as base currency
    if (from !== 'EUR' && !this.ECB_SUPPORTED_CURRENCIES.includes(from)) {
      throw new Error(`Currency ${from} is not supported by ECB`);
    }
    if (to !== 'EUR' && !this.ECB_SUPPORTED_CURRENCIES.includes(to)) {
      throw new Error(`Currency ${to} is not supported by ECB`);
    }
  }

  private async fetchECBRates(
    from: SupportedCurrency,
    to: SupportedCurrency,
    startDate: Date,
    endDate: Date,
  ): Promise<MultiDayRateResult> {
    this.validateCurrencySupport(from, to);

    const startDateStr = startDate.toISOString().split('T')[0] as string;
    const endDateStr = endDate.toISOString().split('T')[0] as string;

    // Determine the ECB API call strategy
    let ecbFromCurrency: SupportedCurrency = 'EUR';
    let ecbToCurrency: SupportedCurrency = 'EUR';
    let needsInversion = false;
    let needsCrossConversion = false;

    if (from === 'EUR') {
      // EUR -> Other currency (direct from ECB)
      ecbFromCurrency = to;
      ecbToCurrency = 'EUR';
      needsInversion = false;
    } else if (to === 'EUR') {
      // Other currency -> EUR (direct from ECB)
      ecbFromCurrency = from;
      ecbToCurrency = 'EUR';
      needsInversion = true;
    } else {
      // Non-EUR to Non-EUR (need cross conversion via EUR)
      needsCrossConversion = true;
    }

    if (needsCrossConversion) {
      // For non-EUR to non-EUR conversions, we need two API calls
      const fromToEurResult = await this.fetchECBRates(
        from,
        'EUR',
        startDate,
        endDate,
      );
      const eurToToResult = await this.fetchECBRates(
        'EUR',
        to,
        startDate,
        endDate,
      );

      // Combine the rates by date
      const combinedRates: ExchangeRateData[] = [];

      const fromToEurMap = new Map(
        fromToEurResult.rates.map((r) => [r.date, r.rate]),
      );

      for (const eurToToRate of eurToToResult.rates) {
        const fromToEurRate = fromToEurMap.get(eurToToRate.date);
        if (fromToEurRate) {
          combinedRates.push({
            date: eurToToRate.date,
            rate: fromToEurRate * eurToToRate.rate,
            fromCurrency: from,
            toCurrency: to,
          });
        }
      }

      return {
        rates: combinedRates,
        fromCurrency: from,
        toCurrency: to,
        startDate: startDateStr,
        endDate: endDateStr,
      };
    }

    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${ecbFromCurrency}.${ecbToCurrency}.SP00.A?startPeriod=${startDateStr}&endPeriod=${endDateStr}&format=jsondata`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `ECB API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const responseText = await response.text();

      if (!responseText) {
        throw new Error('ECB API returned empty response');
      }

      const data: ECBResponse = JSON.parse(responseText);

      // Find the correct series key (ECB response structure can vary)
      const seriesKeys = Object.keys(data.dataSets[0]?.series || {});
      const seriesKey = seriesKeys[0] as string; // Usually '0:0:0:0:0' but can vary

      if (!data.dataSets?.[0]?.series?.[seriesKey]?.observations) {
        throw new Error('Invalid ECB response structure or no data available');
      }

      const dateValues = data.structure.dimensions.observation[0]
        ?.values as Array<{
        id: string;
        name: string;
      }>;

      const observations = data.dataSets[0].series[seriesKey].observations;

      const rates: ExchangeRateData[] = [];

      dateValues.forEach((dateValue, index) => {
        const rawRate = observations[index.toString()]?.[0];
        if (rawRate && !isNaN(rawRate)) {
          const finalRate = needsInversion ? 1 / rawRate : rawRate;
          rates.push({
            date: dateValue.id,
            rate: finalRate,
            fromCurrency: from,
            toCurrency: to,
          });
        }
      });

      if (rates.length === 0) {
        throw new Error('No exchange rates found for the specified period');
      }

      return {
        rates: rates.sort((a, b) => a.date.localeCompare(b.date)),
        fromCurrency: from,
        toCurrency: to,
        startDate: startDateStr,
        endDate: endDateStr,
      };
    } catch (error) {
      throw error;
    }
  }

  async getExchangeRate(
    from: SupportedCurrency,
    to: SupportedCurrency,
    date: Date,
  ): Promise<number> {
    // Return 1 for same currency
    if (from === to) {
      return 1.0;
    }

    // Fetch rate directly without caching
    const startDate = new Date(date);
    const endDate = new Date(date);

    const multiDayResult = await this.fetchECBRates(
      from,
      to,
      startDate,
      endDate,
    );

    // Get the rate for the specific date or the closest available
    const targetDateStr = date.toISOString().split('T')[0] as string;

    const exactMatch = multiDayResult.rates.find(
      (r) => r.date === targetDateStr,
    );

    if (exactMatch) {
      return exactMatch.rate;
    }

    // Find closest previous date
    const sortedRates = multiDayResult.rates.sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const previousRates = sortedRates.filter((r) => r.date <= targetDateStr);

    if (previousRates.length > 0) {
      return previousRates[previousRates.length - 1]?.rate ?? 0;
    }

    // If no previous date found, use the earliest available date
    return sortedRates[0]?.rate ?? 0;
  }

  async convertAmount(
    amount: number,
    from: SupportedCurrency,
    to: SupportedCurrency,
    date: Date,
  ): Promise<{
    convertedAmount: number;
    originalAmount: number;
    exchangeRate: number;
    fromCurrency: SupportedCurrency;
    toCurrency: SupportedCurrency;
  }> {
    const rate = await this.getExchangeRate(from, to, date);
    const convertedAmount = amount * rate;

    return {
      convertedAmount,
      originalAmount: amount,
      exchangeRate: rate,
      fromCurrency: from,
      toCurrency: to,
    };
  }

  // Get exchange rates for multiple days
  async getExchangeRates(
    from: SupportedCurrency,
    to: SupportedCurrency,
    startDate: Date,
    endDate: Date,
  ): Promise<MultiDayRateResult> {
    // Return same rates for same currency
    if (from === to) {
      const rates: ExchangeRateData[] = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        rates.push({
          date: currentDate.toISOString().split('T')[0] as string,
          rate: 1.0,
          fromCurrency: from,
          toCurrency: to,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        rates,
        fromCurrency: from,
        toCurrency: to,
        startDate: startDate.toISOString().split('T')[0] as string,
        endDate: endDate.toISOString().split('T')[0] as string,
      };
    }

    // Fetch rates directly without caching
    return await this.fetchECBRates(from, to, startDate, endDate);
  }

  // Get supported currencies
  getSupportedCurrencies(): SupportedCurrency[] {
    return (
      ['EUR', ...this.ECB_SUPPORTED_CURRENCIES] as SupportedCurrency[]
    ).sort();
  }

  // Check if a currency pair is supported
  isCurrencyPairSupported(
    from: SupportedCurrency,
    to: SupportedCurrency,
  ): boolean {
    try {
      this.validateCurrencySupport(from, to);
      return true;
    } catch {
      return false;
    }
  }

  isSupportedCurrency(currency: string): currency is SupportedCurrency {
    return ['EUR', ...this.ECB_SUPPORTED_CURRENCIES].includes(
      currency as SupportedCurrency,
    );
  }

  // Method to find closest previous date with available rate (like in your N8N workflow)
  findClosestPreviousDate(
    targetDate: Date,
    rates: ExchangeRateData[],
  ): ExchangeRateData | null {
    const sortedRates = rates.sort((a, b) => a.date.localeCompare(b.date));

    // If exact date exists, use it
    const exactMatch = sortedRates.find(
      (r) => r.date === (targetDate.toISOString().split('T')[0] as string),
    );
    if (exactMatch) {
      return exactMatch;
    }

    // Find the closest previous date
    const previousRates = sortedRates.filter(
      (r) => r.date < (targetDate.toISOString().split('T')[0] as string),
    );
    if (previousRates.length > 0) {
      return previousRates[previousRates.length - 1] || null;
    }

    // If no previous date found, use the earliest available date
    return sortedRates[0] || null;
  }
}

// Export singleton instance
export const exchangeRateService = new ExchangeRateService();
export default exchangeRateService;
