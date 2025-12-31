'use client';

import { IconBuilding, IconPackage, IconPlane, IconSearch } from '@tabler/icons-react';
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
}

const sourceConfig: Record<StockSource, { label: string; icon: typeof IconPackage; description: string }> = {
  partner_local: {
    label: 'Local Stock',
    icon: IconPackage,
    description: 'From your local inventory',
  },
  partner_airfreight: {
    label: 'Air Freight',
    icon: IconPlane,
    description: 'Ship from overseas',
  },
  cc_inventory: {
    label: 'C&C Inventory',
    icon: IconBuilding,
    description: 'From Craft & Culture warehouse',
  },
  manual: {
    label: 'Manual Entry',
    icon: IconSearch,
    description: 'Enter product details manually',
  },
};

/**
 * Product picker component for private client orders.
 * Allows selecting from catalog or manual entry with stock source selection.
 */
const ProductPicker = ({ value, onChange, omitProductIds = [] }: ProductPickerProps) => {
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
      pricePerCaseUsd: offer?.inBondPriceUsd ?? value.pricePerCaseUsd,
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

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-muted p-4">
      {/* Mode Toggle & Source Selection */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={mode === 'search' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('search')}
        >
          <Icon icon={IconSearch} size="sm" className="mr-1.5" />
          Search Catalog
        </Button>
        <Button
          type="button"
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={handleModeSwitch}
        >
          <Icon icon={IconPackage} size="sm" className="mr-1.5" />
          Manual Entry
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Typography variant="bodyXs" colorRole="muted">
            Source:
          </Typography>
          <Select
            value={value.source}
            onValueChange={(source) => onChange({ ...value, source: source as StockSource })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(sourceConfig) as [StockSource, typeof sourceConfig.manual][]).map(
                ([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon icon={config.icon} size="sm" />
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Product Selection / Manual Entry */}
      {mode === 'search' ? (
        <div className="flex flex-col gap-3">
          <ProductsCombobox
            value={selectedProduct}
            onSelect={handleProductSelect}
            placeholder="Search wines by name, producer, region..."
            omitProductIds={omitProductIds}
          />

          {selectedProduct && (
            <div className="flex items-center justify-between rounded-md bg-fill-muted/50 px-3 py-2">
              <div className="flex flex-col">
                <Typography variant="bodySm" className="font-medium">
                  {selectedProduct.name}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {selectedProduct.producer}
                  {selectedProduct.region && ` · ${selectedProduct.region}`}
                  {selectedProduct.year && ` · ${selectedProduct.year}`}
                </Typography>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearProduct}>
                Clear
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Product Name *
            </Typography>
            <Input
              placeholder="e.g., Chateau Margaux 2015"
              value={value.productName}
              onChange={(e) => onChange({ ...value, productName: e.target.value })}
              size="sm"
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Producer
            </Typography>
            <Input
              placeholder="e.g., Chateau Margaux"
              value={value.producer}
              onChange={(e) => onChange({ ...value, producer: e.target.value })}
              size="sm"
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Region
            </Typography>
            <Input
              placeholder="e.g., Bordeaux"
              value={value.region}
              onChange={(e) => onChange({ ...value, region: e.target.value })}
              size="sm"
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              Vintage
            </Typography>
            <Input
              placeholder="e.g., 2015"
              value={value.vintage}
              onChange={(e) => onChange({ ...value, vintage: e.target.value })}
              size="sm"
            />
          </div>

          <div>
            <Typography variant="bodyXs" colorRole="muted" className="mb-1">
              LWIN
            </Typography>
            <Input
              placeholder="e.g., 1014033"
              value={value.lwin}
              onChange={(e) => onChange({ ...value, lwin: e.target.value })}
              size="sm"
            />
          </div>
        </div>
      )}

      {/* Quantity & Pricing */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Typography variant="bodyXs" colorRole="muted" className="mb-1">
            Bottle Size
          </Typography>
          <Select
            value={value.bottleSize || '750ml'}
            onValueChange={(size) => onChange({ ...value, bottleSize: size })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="375ml">375ml (Half)</SelectItem>
              <SelectItem value="750ml">750ml (Standard)</SelectItem>
              <SelectItem value="1500ml">1500ml (Magnum)</SelectItem>
              <SelectItem value="3000ml">3000ml (Double Mag)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Typography variant="bodyXs" colorRole="muted" className="mb-1">
            Case Config
          </Typography>
          <Select
            value={value.caseConfig?.toString() || '12'}
            onValueChange={(config) => onChange({ ...value, caseConfig: parseInt(config) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 bottle</SelectItem>
              <SelectItem value="3">3 bottles</SelectItem>
              <SelectItem value="6">6 bottles</SelectItem>
              <SelectItem value="12">12 bottles</SelectItem>
              <SelectItem value="24">24 bottles</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Typography variant="bodyXs" colorRole="muted" className="mb-1">
            Quantity (cases)
          </Typography>
          <Input
            type="number"
            min={1}
            value={value.quantity}
            onChange={(e) => onChange({ ...value, quantity: parseInt(e.target.value) || 1 })}
            size="sm"
          />
        </div>

        <div>
          <Typography variant="bodyXs" colorRole="muted" className="mb-1">
            Price/Case (USD)
          </Typography>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={value.pricePerCaseUsd || ''}
            onChange={(e) => onChange({ ...value, pricePerCaseUsd: parseFloat(e.target.value) || 0 })}
            size="sm"
          />
        </div>
      </div>

      {/* Line Total */}
      <div className="flex items-center justify-between border-t border-border-muted pt-3">
        <Typography variant="bodyXs" colorRole="muted">
          Line Total
        </Typography>
        <Typography variant="bodySm" className="font-semibold">
          ${((value.quantity || 0) * (value.pricePerCaseUsd || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Typography>
      </div>
    </div>
  );
};

export default ProductPicker;
