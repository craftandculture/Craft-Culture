'use client';

import Typography from '@/app/_ui/components/Typography/Typography';

interface PricePreviewTableProps {
  items: Record<string, unknown>[];
  rawData: Record<string, unknown>[];
  columnMapping: Record<string, string> | null;
  priceType: 'b2b' | 'd2c';
}

/**
 * Preview table showing calculated prices
 *
 * Shows raw data when no calculations exist, or calculated prices when available
 */
const PricePreviewTable = ({ items, rawData, columnMapping, priceType }: PricePreviewTableProps) => {
  const hasCalculatedItems = items && items.length > 0;

  // Format price for display
  const formatPrice = (value: unknown) => {
    if (typeof value !== 'number' || isNaN(value)) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatAedPrice = (value: unknown) => {
    if (typeof value !== 'number' || isNaN(value)) return '—';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get display value from raw data using column mapping
  const getRawValue = (row: Record<string, unknown>, fieldId: string) => {
    if (!columnMapping) return '—';
    const columnName = columnMapping[fieldId];
    if (!columnName) return '—';
    const value = row[columnName];
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  if (!hasCalculatedItems) {
    // Show raw data preview when no calculations exist
    return (
      <div>
        <Typography variant="bodySm" colorRole="muted" className="mb-4">
          Configure variables and click &quot;Calculate Prices&quot; to see results.
        </Typography>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Product</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Vintage</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">UK In-Bond</th>
                <th className="px-3 py-2 text-center font-medium text-text-muted">Case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {rawData.slice(0, 20).map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-secondary/50">
                  <td className="px-3 py-2 text-text-primary">
                    {getRawValue(row, 'productName')}
                  </td>
                  <td className="px-3 py-2 text-text-muted">{getRawValue(row, 'vintage')}</td>
                  <td className="px-3 py-2 text-right text-text-primary">
                    {getRawValue(row, 'ukInBondPrice')}
                  </td>
                  <td className="px-3 py-2 text-center text-text-muted">
                    {getRawValue(row, 'caseConfig')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rawData.length > 20 && (
            <div className="mt-2 text-center">
              <Typography variant="bodyXs" colorRole="muted">
                Showing 20 of {rawData.length} products
              </Typography>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Format source price with currency
  const formatSourcePrice = (price: unknown, currency: unknown) => {
    if (typeof price !== 'number' || isNaN(price)) return '—';
    const currencyCode = String(currency || 'GBP');
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode === 'GBP' ? 'GBP' : currencyCode === 'EUR' ? 'EUR' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Show calculated prices
  if (priceType === 'b2b') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Product</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Vintage</th>
              <th className="px-3 py-2 text-center font-medium text-text-muted">Cfg</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Source</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">$/Case</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">$/Btl</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">AED/Case</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">AED/Btl</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted">
            {items.slice(0, 50).map((item, idx) => (
              <tr key={idx} className="hover:bg-surface-secondary/50">
                <td className="px-3 py-2 text-text-primary">
                  {String(item.productName ?? '—')}
                </td>
                <td className="px-3 py-2 text-text-muted">{String(item.vintage ?? '—')}</td>
                <td className="px-3 py-2 text-center text-text-muted">
                  {String(item.caseConfig ?? '—')}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-muted">
                  {formatSourcePrice(item.ukInBondPrice, item.inputCurrency)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">
                  {formatPrice(item.inBondCaseUsd)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-muted">
                  {formatPrice(item.inBondBottleUsd)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">
                  {formatAedPrice(item.inBondCaseAed)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-muted">
                  {formatAedPrice(item.inBondBottleAed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 50 && (
          <div className="mt-2 text-center">
            <Typography variant="bodyXs" colorRole="muted">
              Showing 50 of {items.length} products
            </Typography>
          </div>
        )}
      </div>
    );
  }

  // D2C prices
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-secondary">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Product</th>
            <th className="px-3 py-2 text-left font-medium text-text-muted">Vintage</th>
            <th className="px-3 py-2 text-center font-medium text-text-muted">Cfg</th>
            <th className="px-3 py-2 text-right font-medium text-text-muted">Source</th>
            <th className="px-3 py-2 text-right font-medium text-text-muted">$/Case</th>
            <th className="px-3 py-2 text-right font-medium text-text-muted">$/Btl</th>
            <th className="px-3 py-2 text-right font-medium text-text-muted">AED/Case</th>
            <th className="px-3 py-2 text-right font-medium text-text-muted">AED/Btl</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-muted">
          {items.slice(0, 50).map((item, idx) => (
            <tr key={idx} className="hover:bg-surface-secondary/50">
              <td className="px-3 py-2 text-text-primary">{String(item.productName ?? '—')}</td>
              <td className="px-3 py-2 text-text-muted">{String(item.vintage ?? '—')}</td>
              <td className="px-3 py-2 text-center text-text-muted">
                {String(item.caseConfig ?? '—')}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-muted">
                {formatSourcePrice(item.ukInBondPrice, item.inputCurrency)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-primary">
                {formatPrice(item.deliveredCaseUsd)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-muted">
                {formatPrice(item.deliveredBottleUsd)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-primary">
                {formatAedPrice(item.deliveredCaseAed)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-muted">
                {formatAedPrice(item.deliveredBottleAed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > 50 && (
        <div className="mt-2 text-center">
          <Typography variant="bodyXs" colorRole="muted">
            Showing 50 of {items.length} products
          </Typography>
        </div>
      )}
    </div>
  );
};

export default PricePreviewTable;
