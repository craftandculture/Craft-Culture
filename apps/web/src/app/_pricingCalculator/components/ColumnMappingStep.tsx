'use client';

import { IconArrowRight, IconLoader2 } from '@tabler/icons-react';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';

interface ColumnMappingStepProps {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  onMappingComplete: (mapping: Record<string, string>, settings: SourceDataSettings) => void;
  isSubmitting?: boolean;
}

interface SourceDataSettings {
  sourcePriceType: 'bottle' | 'case';
  sourceCurrency: 'GBP' | 'EUR' | 'USD';
}

interface FieldMapping {
  id: string;
  label: string;
  required: boolean;
  description: string;
}

const FIELD_MAPPINGS: FieldMapping[] = [
  { id: 'productName', label: 'Product Name', required: true, description: 'Wine name or description' },
  { id: 'vintage', label: 'Vintage', required: false, description: 'Year of production' },
  { id: 'ukInBondPrice', label: 'Source Price', required: true, description: 'Price per case (in source currency)' },
  { id: 'currency', label: 'Currency', required: false, description: 'If sheet has currency column' },
  { id: 'caseConfig', label: 'Case Config', required: false, description: 'Bottles per case (e.g., 6, 12, 6x75cl)' },
  { id: 'bottleSize', label: 'Bottle Size', required: false, description: 'ml or cl (e.g., 750ml)' },
  { id: 'lwin', label: 'LWIN', required: false, description: 'Liv-ex Wine ID (optional)' },
  { id: 'producer', label: 'Producer', required: false, description: 'Winery or producer name' },
  { id: 'region', label: 'Region', required: false, description: 'Wine region' },
];

/**
 * Step 2 of the pricing calculator wizard
 *
 * Map detected columns to standard fields
 */
const ColumnMappingStep = ({
  headers,
  sampleRows,
  onMappingComplete,
  isSubmitting,
}: ColumnMappingStepProps) => {
  // Source data settings
  const [sourcePriceType, setSourcePriceType] = useState<'bottle' | 'case'>('case');
  const [sourceCurrency, setSourceCurrency] = useState<'GBP' | 'EUR' | 'USD'>('USD');

  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    // Auto-detect some common column names
    const autoMapping: Record<string, string> = {};
    const lowerHeaders = headers.map((h) => h.toLowerCase());

    // Try to auto-match
    headers.forEach((header, idx) => {
      const lower = lowerHeaders[idx];
      if (!lower) return;

      if (lower.includes('wine') || lower.includes('name') || lower.includes('product') || lower.includes('description')) {
        if (!autoMapping.productName) autoMapping.productName = header;
      }
      if (lower.includes('vintage') || lower.includes('year')) {
        if (!autoMapping.vintage) autoMapping.vintage = header;
      }
      if (lower.includes('price') || lower.includes('cost') || lower.includes('in-bond') || lower.includes('inbond')) {
        if (!autoMapping.ukInBondPrice) autoMapping.ukInBondPrice = header;
      }
      if (lower.includes('currency') || lower === 'ccy') {
        if (!autoMapping.currency) autoMapping.currency = header;
      }
      // Case config - match many common patterns
      if (
        (lower.includes('case') && (lower.includes('size') || lower.includes('qty') || lower.includes('config'))) ||
        lower.includes('pack') ||
        lower.includes('format') ||
        lower === 'qty' ||
        lower === 'quantity' ||
        lower.includes('btl') ||
        lower.includes('bottles')
      ) {
        if (!autoMapping.caseConfig) autoMapping.caseConfig = header;
      }
      if (lower.includes('bottle') && lower.includes('size')) {
        if (!autoMapping.bottleSize) autoMapping.bottleSize = header;
      }
      if (lower.includes('lwin')) {
        if (!autoMapping.lwin) autoMapping.lwin = header;
      }
      if (lower.includes('producer') || lower.includes('winery') || lower.includes('chateau')) {
        if (!autoMapping.producer) autoMapping.producer = header;
      }
      if (lower.includes('region') || lower.includes('appellation')) {
        if (!autoMapping.region) autoMapping.region = header;
      }
    });

    return autoMapping;
  });

  const handleFieldChange = (fieldId: string, columnName: string) => {
    setMapping((prev) => ({
      ...prev,
      [fieldId]: columnName === '__none__' ? '' : columnName,
    }));
  };

  const handleSubmit = () => {
    // Validate required fields
    const requiredFields = FIELD_MAPPINGS.filter((f) => f.required);
    const missingRequired = requiredFields.filter((f) => !mapping[f.id]);

    if (missingRequired.length > 0) {
      alert(`Please map required fields: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }

    onMappingComplete(mapping, { sourcePriceType, sourceCurrency });
  };

  // Check if currency column is mapped
  const hasCurrencyColumn = !!mapping.currency;

  const getSampleValue = (columnName: string) => {
    for (const row of sampleRows) {
      const value = row[columnName];
      if (value !== null && value !== undefined && value !== '') {
        return String(value).slice(0, 50);
      }
    }
    return '—';
  };

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="headingSm" className="mb-1">
          Map Columns
        </Typography>
        <Typography variant="bodySm" colorRole="muted">
          Match your spreadsheet columns to the pricing fields. Auto-detected where possible.
        </Typography>
      </div>

      {/* Source Data Settings */}
      <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-4">
        <Typography variant="bodySm" className="mb-3 font-medium">
          Source Data Settings
        </Typography>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Price Type */}
          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Source Price Type <span className="text-red-500">*</span>
            </Typography>
            <Select value={sourcePriceType} onValueChange={(v) => setSourcePriceType(v as 'bottle' | 'case')}>
              <SelectTrigger className="flex h-9 w-full items-center justify-between rounded-lg border border-b-2 border-border-primary bg-fill-primary px-2.5 text-sm font-medium text-text-primary hover:border-border-primary-hover focus:outline-none focus:ring-2 focus:ring-border-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="case">Per Case</SelectItem>
                <SelectItem value="bottle">Per Bottle</SelectItem>
              </SelectContent>
            </Select>
            <Typography variant="bodyXs" colorRole="muted" className="mt-1 italic">
              Is the source price per bottle or per case?
            </Typography>
          </div>
          {/* Currency */}
          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Source Currency <span className="text-red-500">*</span>
            </Typography>
            <Select
              value={sourceCurrency}
              onValueChange={(v) => setSourceCurrency(v as 'GBP' | 'EUR' | 'USD')}
              disabled={hasCurrencyColumn}
            >
              <SelectTrigger className="flex h-9 w-full items-center justify-between rounded-lg border border-b-2 border-border-primary bg-fill-primary px-2.5 text-sm font-medium text-text-primary hover:border-border-primary-hover focus:outline-none focus:ring-2 focus:ring-border-primary disabled:cursor-not-allowed disabled:opacity-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
            <Typography variant="bodyXs" colorRole="muted" className="mt-1 italic">
              {hasCurrencyColumn ? 'Using currency column from sheet' : 'Currency of source prices'}
            </Typography>
          </div>
        </div>
      </div>

      {/* Mapping Form */}
      <div className="space-y-4">
        {FIELD_MAPPINGS.map((field) => (
          <div key={field.id} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center sm:gap-4">
            <div>
              <Typography variant="bodySm" className="font-medium">
                {field.label}
                {field.required && <span className="ml-1 text-red-500">*</span>}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                {field.description}
              </Typography>
            </div>
            <Select
              value={mapping[field.id] || '__none__'}
              onValueChange={(value) => handleFieldChange(field.id, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Not mapped —</SelectItem>
                {headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Typography variant="bodyXs" colorRole="muted" className="truncate">
              {mapping[field.id] ? `Sample: ${getSampleValue(mapping[field.id]!)}` : ''}
            </Typography>
          </div>
        ))}
      </div>

      {/* Preview Table */}
      <div>
        <Typography variant="bodySm" className="mb-2 font-medium">
          Preview (first 5 rows)
        </Typography>
        <div className="overflow-x-auto rounded-lg border border-border-muted">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary">
              <tr>
                {headers.slice(0, 6).map((header, colIdx) => (
                  <th key={colIdx} className="px-3 py-2 text-left font-medium text-text-muted">
                    {header || `Column ${colIdx + 1}`}
                  </th>
                ))}
                {headers.length > 6 && (
                  <th className="px-3 py-2 text-left font-medium text-text-muted">
                    +{headers.length - 6} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted">
              {sampleRows.slice(0, 5).map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {headers.slice(0, 6).map((header, colIdx) => (
                    <td key={colIdx} className="px-3 py-2 text-text-primary">
                      {String(row[header] ?? '—').slice(0, 30)}
                    </td>
                  ))}
                  {headers.length > 6 && <td className="px-3 py-2 text-text-muted">...</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          variant="default"
          colorRole="brand"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          <ButtonContent iconRight={isSubmitting ? IconLoader2 : IconArrowRight}>
            {isSubmitting ? 'Creating...' : 'Create Session'}
          </ButtonContent>
        </Button>
      </div>
    </div>
  );
};

export default ColumnMappingStep;
