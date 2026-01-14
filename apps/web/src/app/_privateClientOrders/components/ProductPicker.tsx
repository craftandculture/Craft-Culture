'use client';

import { IconPencil, IconSearch, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import ProductsCombobox from '@/app/_products/components/ProductsCombobox';
import type { Product } from '@/app/_products/controller/productsGetMany';
import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';

type StockSource = 'partner_local' | 'partner_airfreight' | 'cc_inventory' | 'manual';

interface LineItemData {
  productId?: string;
  productOfferId?: string;
  productName: string;
  producer: string;
  vintage: string;
  region: string;
  lwin: string;
  bottleSize: string;
  caseConfig: number;
  source: StockSource;
  quantity: number;
  pricePerCaseUsd: number;
}

interface ProductPickerProps {
  value: LineItemData;
  onChange: (data: LineItemData) => void;
  omitProductIds?: string[];
  onRemove?: () => void;
  index?: number;
  /** Filter products by stock source (cultx or local_inventory) */
  source?: 'cultx' | 'local_inventory';
}

/**
 * Product picker for private client orders.
 * Defaults to catalog search mode with option for manual entry.
 */
const ProductPicker = ({ value, onChange, omitProductIds = [], onRemove, index, source }: ProductPickerProps) => {
  // Default to search mode - only show manual if explicitly toggled or has manual data without productId
  const hasManualDataOnly = !value.productId && value.productName.trim().length > 0;
  const [mode, setMode] = useState<'search' | 'manual'>(hasManualDataOnly ? 'manual' : 'search');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Check if we have a pre-populated product (from AI matching)
  const hasPrePopulatedProduct = value.productId && value.productName.trim().length > 0;

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);

    const offer = product.productOffers?.[0];

    // Use raw supplier price, converting to USD if needed
    // This avoids double markup from the B2B pricing model
    let rawPriceUsd = value.pricePerCaseUsd;
    if (offer?.price) {
      const exchangeRates: Record<string, number> = {
        USD: 1,
        GBP: 1.27,
        EUR: 1.08,
      };
      const rate = exchangeRates[offer.currency] ?? 1;
      rawPriceUsd = Math.round(offer.price * rate * 100) / 100;
    }

    onChange({
      ...value,
      productId: product.id,
      productOfferId: offer?.id,
      productName: product.name,
      producer: product.producer ?? '',
      vintage: product.year?.toString() ?? '',
      region: product.region ?? '',
      lwin: product.lwin18,
      bottleSize: offer?.unitSize ?? '750ml',
      caseConfig: offer?.unitCount ?? 12,
      pricePerCaseUsd: rawPriceUsd,
      source: offer?.source === 'local_inventory' ? 'cc_inventory' : value.source,
    });
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    onChange({
      ...value,
      productId: undefined,
      productOfferId: undefined,
    });
  };

  const handleModeSwitch = () => {
    if (mode === 'search') {
      setMode('manual');
      handleClearProduct();
    } else {
      setMode('search');
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFloat(e.target.value);
    const roundedValue = isNaN(rawValue) ? 0 : Math.round(rawValue * 100) / 100;
    onChange({ ...value, pricePerCaseUsd: roundedValue });
  };

  const lineTotal = (value.quantity || 0) * (value.pricePerCaseUsd || 0);
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(lineTotal);

  return (
    <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-3">
      {/* Header row with index and remove */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {index !== undefined && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fill-brand/10 text-xs font-semibold text-text-brand">
              {index + 1}
            </span>
          )}
          {mode === 'search' ? (
            <Typography variant="bodyXs" colorRole="muted">
              Search catalog
            </Typography>
          ) : (
            <Typography variant="bodyXs" colorRole="muted">
              Manual entry
            </Typography>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === 'search' ? (
            <button
              type="button"
              onClick={handleModeSwitch}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              <Icon icon={IconPencil} size="xs" />
              <span className="hidden sm:inline">Enter manually</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('search')}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              <Icon icon={IconSearch} size="xs" />
              <span className="hidden sm:inline">Search catalog</span>
            </button>
          )}
          {onRemove && (
            <Button type="button" variant="ghost" size="xs" onClick={onRemove}>
              <Icon icon={IconX} size="sm" colorRole="danger" />
            </Button>
          )}
        </div>
      </div>

      {/* Product selection */}
      {mode === 'search' ? (
        <div className="mb-3">
          {hasPrePopulatedProduct && !selectedProduct ? (
            // Show pre-populated product from AI matching
            <div className="flex items-center justify-between rounded-lg border border-border-brand bg-fill-brand-muted/50 px-3 py-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <Typography variant="bodySm" className="font-medium truncate">
                  {value.productName}
                </Typography>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {value.producer && <span>{value.producer}</span>}
                  {value.vintage && <span>{value.vintage}</span>}
                  {value.region && <span>{value.region}</span>}
                  {value.source === 'cc_inventory' && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">Local Stock</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="ghost" size="xs" onClick={handleClearProduct}>
                <Icon icon={IconX} size="sm" colorRole="muted" />
              </Button>
            </div>
          ) : (
            <ProductsCombobox
              value={selectedProduct}
              onSelect={handleProductSelect}
              placeholder="Search wines by name, producer, region..."
              omitProductIds={omitProductIds}
              source={source}
            />
          )}
        </div>
      ) : (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Input
              placeholder="Product name *"
              value={value.productName}
              onChange={(e) => onChange({ ...value, productName: e.target.value })}
              size="sm"
            />
          </div>
          <Input
            placeholder="Producer"
            value={value.producer}
            onChange={(e) => onChange({ ...value, producer: e.target.value })}
            size="sm"
          />
          <Input
            placeholder="Vintage"
            value={value.vintage}
            onChange={(e) => onChange({ ...value, vintage: e.target.value })}
            size="sm"
          />
        </div>
      )}

      {/* Quantity and pricing - responsive grid */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
        {/* Bottle config */}
        <div className="flex items-center gap-1">
          <Select
            value={value.bottleSize || '750ml'}
            onValueChange={(size) => onChange({ ...value, bottleSize: size })}
          >
            <SelectTrigger className="h-8 w-full text-xs sm:w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="375ml">375ml</SelectItem>
              <SelectItem value="750ml">750ml</SelectItem>
              <SelectItem value="1500ml">1.5L</SelectItem>
              <SelectItem value="3000ml">3L</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={value.caseConfig?.toString() || '12'}
            onValueChange={(config) => onChange({ ...value, caseConfig: parseInt(config) })}
          >
            <SelectTrigger className="h-8 w-full text-xs sm:w-[65px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">×1</SelectItem>
              <SelectItem value="3">×3</SelectItem>
              <SelectItem value="6">×6</SelectItem>
              <SelectItem value="12">×12</SelectItem>
              <SelectItem value="24">×24</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="flex items-center gap-1.5">
          <Typography variant="bodyXs" colorRole="muted" className="whitespace-nowrap">Cases:</Typography>
          <Input
            type="number"
            min={1}
            value={value.quantity}
            onChange={(e) => onChange({ ...value, quantity: parseInt(e.target.value) || 1 })}
            className="h-8 w-full text-center text-xs sm:w-16"
          />
        </div>

        {/* Price per case */}
        <div className="flex items-center gap-1.5">
          <Typography variant="bodyXs" colorRole="muted" className="whitespace-nowrap">$/case:</Typography>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={value.pricePerCaseUsd || ''}
            onChange={handlePriceChange}
            className="h-8 w-full text-right text-xs sm:w-24"
          />
        </div>

        {/* Line total */}
        <div className="col-span-2 flex items-center justify-end gap-1.5 border-t border-border-muted pt-2 sm:ml-auto sm:border-t-0 sm:pt-0">
          <Typography variant="bodyXs" colorRole="muted">Line Total:</Typography>
          <Typography variant="bodySm" className="font-semibold text-text-brand">
            {formattedTotal}
          </Typography>
        </div>
      </div>
    </div>
  );
};

export default ProductPicker;
