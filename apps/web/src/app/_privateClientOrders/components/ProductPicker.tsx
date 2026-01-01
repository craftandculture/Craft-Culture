'use client';

import { IconPackage, IconSearch, IconX } from '@tabler/icons-react';
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
  index: number;
}

/**
 * Compact product picker for private client orders.
 * Designed to fit many items on screen with inline layout.
 */
const ProductPicker = ({ value, onChange, omitProductIds = [], onRemove, index }: ProductPickerProps) => {
  const [mode, setMode] = useState<'search' | 'manual'>(value.productId ? 'search' : 'manual');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);

    const offer = product.productOffers?.[0];

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
      pricePerCaseUsd: offer?.inBondPriceUsd ? Math.round(offer.inBondPriceUsd * 100) / 100 : value.pricePerCaseUsd,
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
      {/* Header row with index, mode toggle, and remove */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-fill-muted text-xs font-medium text-text-muted">
            {index + 1}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={mode === 'search' ? 'default' : 'ghost'}
              size="xs"
              onClick={() => setMode('search')}
            >
              <Icon icon={IconSearch} size="xs" />
            </Button>
            <Button
              type="button"
              variant={mode === 'manual' ? 'default' : 'ghost'}
              size="xs"
              onClick={handleModeSwitch}
            >
              <Icon icon={IconPackage} size="xs" />
            </Button>
          </div>
        </div>
        {onRemove && (
          <Button type="button" variant="ghost" size="xs" onClick={onRemove}>
            <Icon icon={IconX} size="xs" colorRole="danger" />
          </Button>
        )}
      </div>

      {/* Product selection row */}
      {mode === 'search' ? (
        <div className="mb-2">
          <ProductsCombobox
            value={selectedProduct}
            onSelect={handleProductSelect}
            placeholder="Search wines..."
            omitProductIds={omitProductIds}
          />
        </div>
      ) : (
        <div className="mb-2 grid grid-cols-4 gap-2">
          <div className="col-span-2">
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

      {/* Quantity and pricing row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Select
            value={value.bottleSize || '750ml'}
            onValueChange={(size) => onChange({ ...value, bottleSize: size })}
          >
            <SelectTrigger className="h-8 w-[80px] text-xs">
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
            <SelectTrigger className="h-8 w-[70px] text-xs">
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

        <div className="flex items-center gap-1">
          <Typography variant="bodyXs" colorRole="muted">Qty:</Typography>
          <Input
            type="number"
            min={1}
            value={value.quantity}
            onChange={(e) => onChange({ ...value, quantity: parseInt(e.target.value) || 1 })}
            className="h-8 w-16 text-center text-xs"
          />
        </div>

        <div className="flex items-center gap-1">
          <Typography variant="bodyXs" colorRole="muted">$/case:</Typography>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={value.pricePerCaseUsd || ''}
            onChange={handlePriceChange}
            className="h-8 w-24 text-right text-xs"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Typography variant="bodyXs" colorRole="muted">Total:</Typography>
          <Typography variant="bodySm" className="font-semibold">
            {formattedTotal}
          </Typography>
        </div>
      </div>
    </div>
  );
};

export default ProductPicker;
