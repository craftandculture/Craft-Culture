'use client';

import { IconBox, IconPencil, IconSearch, IconX } from '@tabler/icons-react';
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

import WmsStockCombobox from './WmsStockCombobox';
import type { WmsStockItem } from './WmsStockCombobox';

type StockSource = 'partner_local' | 'partner_airfreight' | 'cc_inventory' | 'manual';

export interface LineItemData {
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
  availableCases?: number;
}

export interface ProductPickerProps {
  value: LineItemData;
  onChange: (data: LineItemData) => void;
  omitProductIds?: string[];
  onRemove?: () => void;
  index?: number;
  /** Filter products by stock source (cultx or local_inventory) */
  source?: 'cultx' | 'local_inventory';
  /** Default mode for this picker */
  defaultMode?: 'wms' | 'search' | 'manual';
  /** Partner ID for admin WMS stock browsing */
  wmsOwnerId?: string;
}

/**
 * Product picker for private client orders.
 * Supports WMS stock, catalog search, and manual entry modes.
 */
const ProductPicker = ({
  value,
  onChange,
  omitProductIds = [],
  onRemove,
  index,
  source,
  defaultMode = 'search',
  wmsOwnerId,
}: ProductPickerProps) => {
  const hasManualDataOnly = !value.productId && value.productName.trim().length > 0 && !value.lwin;
  const hasWmsData = !value.productId && value.lwin && value.productName.trim().length > 0;
  const initialMode = hasManualDataOnly ? 'manual' : hasWmsData ? 'wms' : defaultMode;
  const [mode, setMode] = useState<'wms' | 'search' | 'manual'>(initialMode);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedWmsItem, setSelectedWmsItem] = useState<WmsStockItem | null>(null);

  // Check if we have a pre-populated product (from AI matching)
  const hasPrePopulatedProduct = value.productId && value.productName.trim().length > 0;
  const hasPrePopulatedWms = !value.productId && value.lwin && value.productName.trim().length > 0 && value.source === 'cc_inventory';

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);

    const offer = product.productOffers?.[0];

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

  const handleWmsStockSelect = (item: WmsStockItem) => {
    setSelectedWmsItem(item);

    onChange({
      ...value,
      productId: undefined,
      productOfferId: undefined,
      productName: item.productName,
      producer: item.producer ?? '',
      vintage: item.vintage?.toString() ?? '',
      region: '',
      lwin: item.lwin18,
      bottleSize: item.bottleSize ?? '750ml',
      caseConfig: item.caseConfig ?? 12,
      pricePerCaseUsd: 0,
      source: 'cc_inventory',
      availableCases: item.availableCases,
    });
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSelectedWmsItem(null);
    onChange({
      ...value,
      productId: undefined,
      productOfferId: undefined,
      productName: '',
      producer: '',
      vintage: '',
      region: '',
      lwin: '',
      availableCases: undefined,
    });
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

  const modeLabel = mode === 'wms' ? 'Warehouse stock' : mode === 'search' ? 'Search catalog' : 'Manual entry';

  return (
    <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-3">
      {/* Header row with index and mode switcher */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {index !== undefined && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fill-brand/10 text-xs font-semibold text-text-brand">
              {index + 1}
            </span>
          )}
          <Typography variant="bodyXs" colorRole="muted">
            {modeLabel}
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          {mode !== 'wms' && (
            <button
              type="button"
              onClick={() => { handleClearProduct(); setMode('wms'); }}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              <Icon icon={IconBox} size="xs" />
              <span className="hidden sm:inline">WMS stock</span>
            </button>
          )}
          {mode !== 'search' && (
            <button
              type="button"
              onClick={() => { handleClearProduct(); setMode('search'); }}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              <Icon icon={IconSearch} size="xs" />
              <span className="hidden sm:inline">Catalog</span>
            </button>
          )}
          {mode !== 'manual' && (
            <button
              type="button"
              onClick={() => { handleClearProduct(); setMode('manual'); }}
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              <Icon icon={IconPencil} size="xs" />
              <span className="hidden sm:inline">Manual</span>
            </button>
          )}
          {onRemove && (
            <Button type="button" variant="ghost" size="xs" onClick={onRemove}>
              <Icon icon={IconX} size="sm" colorRole="danger" />
            </Button>
          )}
        </div>
      </div>

      {/* Product selection by mode */}
      {mode === 'wms' ? (
        <div className="mb-3">
          {hasPrePopulatedWms && !selectedWmsItem ? (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <Typography variant="bodySm" className="font-medium truncate">
                  {value.productName}
                </Typography>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {value.producer && <span>{value.producer}</span>}
                  {value.vintage && <span>{value.vintage}</span>}
                  {value.availableCases !== undefined && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                      {value.availableCases} cs available
                    </span>
                  )}
                </div>
              </div>
              <Button type="button" variant="ghost" size="xs" onClick={handleClearProduct}>
                <Icon icon={IconX} size="sm" colorRole="muted" />
              </Button>
            </div>
          ) : selectedWmsItem ? (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <Typography variant="bodySm" className="font-medium truncate">
                  {selectedWmsItem.productName}
                  {selectedWmsItem.vintage ? ` ${selectedWmsItem.vintage}` : ''}
                </Typography>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {selectedWmsItem.producer && <span>{selectedWmsItem.producer}</span>}
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                    {selectedWmsItem.availableCases} cs available
                  </span>
                  <span className="text-text-muted/60">{selectedWmsItem.lwin18}</span>
                </div>
              </div>
              <Button type="button" variant="ghost" size="xs" onClick={handleClearProduct}>
                <Icon icon={IconX} size="sm" colorRole="muted" />
              </Button>
            </div>
          ) : (
            <WmsStockCombobox
              onSelect={handleWmsStockSelect}
              ownerId={wmsOwnerId}
            />
          )}
        </div>
      ) : mode === 'search' ? (
        <div className="mb-3">
          {hasPrePopulatedProduct && !selectedProduct ? (
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
