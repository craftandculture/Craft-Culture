'use client';

import { IconChevronDown, IconChevronRight, IconPlus, IconX } from '@tabler/icons-react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Input from '@/app/_ui/components/Input/Input';
import TextArea from '@/app/_ui/components/TextArea/TextArea';
import Typography from '@/app/_ui/components/Typography/Typography';
import convertUsdToAed from '@/utils/convertUsdToAed';
import formatPrice from '@/utils/formatPrice';

interface LineItemAdjustment {
  adjustedPricePerCase?: number;
  confirmedQuantity?: number;
  available: boolean;
  notes?: string;
  adminAlternatives?: Array<{
    productName: string;
    pricePerCase: number;
    bottlesPerCase: number;
    bottleSize: string;
    quantityAvailable: number;
  }>;
}

interface Product {
  id: string;
  name: string;
  producer?: string | null;
  year?: number | null;
  lwin18?: string | null;
}

interface LineItem {
  productId: string;
  offerId: string;
  quantity: number;
  vintage?: string;
  alternativeVintages?: string[];
}

interface ReviewLineItemRowProps {
  lineItem: LineItem;
  product: Product | undefined;
  pricePerCase: number;
  adjustment: LineItemAdjustment | undefined;
  isExpanded: boolean;
  displayCurrency: 'USD' | 'AED';
  onToggle: () => void;
  onAdjustmentChange: (adjustment: LineItemAdjustment) => void;
}

/**
 * Simplified alternatives section with inline add form
 */
const AlternativesSection = ({
  adjustment,
  pricePerCase,
  lineItem,
  onAdjustmentChange,
}: {
  adjustment: LineItemAdjustment | undefined;
  pricePerCase: number;
  lineItem: LineItem;
  onAdjustmentChange: (adjustment: LineItemAdjustment) => void;
}) => {
  const alternatives = adjustment?.adminAlternatives || [];

  const handleAddAlternative = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const productName = formData.get('productName') as string;
    const price = parseFloat(formData.get('price') as string);
    const qty = parseInt(formData.get('qty') as string);

    if (!productName?.trim() || !price || !qty) return;

    onAdjustmentChange({
      adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
      confirmedQuantity: adjustment?.confirmedQuantity ?? lineItem.quantity,
      available: adjustment?.available ?? true,
      notes: adjustment?.notes,
      adminAlternatives: [
        ...alternatives,
        {
          productName: productName.trim(),
          pricePerCase: price,
          bottlesPerCase: 6,
          bottleSize: '750ml',
          quantityAvailable: qty,
        },
      ],
    });

    form.reset();
  };

  const handleRemoveAlternative = (index: number) => {
    onAdjustmentChange({
      adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
      confirmedQuantity: adjustment?.confirmedQuantity ?? lineItem.quantity,
      available: adjustment?.available ?? true,
      notes: adjustment?.notes,
      adminAlternatives: alternatives.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="rounded-lg border border-border-muted bg-white p-3">
      <Typography variant="bodyXs" className="font-semibold mb-2 flex items-center gap-1">
        <span>💡</span> Suggest Alternatives
        {alternatives.length > 0 && (
          <span className="text-text-brand">({alternatives.length})</span>
        )}
      </Typography>

      {/* Added Alternatives */}
      {alternatives.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {alternatives.map((alt, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-2 rounded-lg bg-fill-success/10 border border-border-success px-2.5 py-1.5"
            >
              <div className="text-xs">
                <span className="font-semibold text-text-success">{alt.productName}</span>
                <span className="text-text-muted ml-1.5">${alt.pricePerCase}/case · {alt.quantityAvailable} avail</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAlternative(idx)}
                className="text-text-danger hover:text-text-danger/80 transition-colors"
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      <form onSubmit={handleAddAlternative} className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <Input
            name="productName"
            type="text"
            placeholder="Product name..."
            className="text-sm h-8"
          />
        </div>
        <div className="w-20">
          <Input
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="$/case"
            className="text-sm h-8"
          />
        </div>
        <div className="w-16">
          <Input
            name="qty"
            type="number"
            min="1"
            placeholder="Qty"
            className="text-sm h-8"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-8 px-2"
        >
          <ButtonContent iconLeft={IconPlus}>Add</ButtonContent>
        </Button>
      </form>
    </div>
  );
};

/**
 * Compact line item row with expandable details for the quote approval dialog
 */
const ReviewLineItemRow = ({
  lineItem,
  product,
  pricePerCase,
  adjustment,
  isExpanded,
  displayCurrency,
  onToggle,
  onAdjustmentChange,
}: ReviewLineItemRowProps) => {
  const finalPricePerCase = adjustment?.adjustedPricePerCase ?? pricePerCase;
  const finalQuantity = adjustment?.confirmedQuantity ?? lineItem.quantity;
  const lineTotal = finalPricePerCase * finalQuantity;
  const isAvailable = adjustment?.available ?? true;

  const displayLineTotal =
    displayCurrency === 'USD' ? lineTotal : convertUsdToAed(lineTotal);

  // Determine status icon
  const getStatusIcon = () => {
    if (!isAvailable) return { icon: '✗', color: 'text-text-danger', bg: 'bg-fill-danger/10' };
    if (adjustment?.notes || (adjustment?.adminAlternatives && adjustment.adminAlternatives.length > 0)) {
      return { icon: '⚠', color: 'text-text-warning', bg: 'bg-fill-warning/10' };
    }
    if (adjustment?.confirmedQuantity !== undefined) {
      return { icon: '✓', color: 'text-text-success', bg: 'bg-fill-success/10' };
    }
    return { icon: '○', color: 'text-text-muted', bg: 'bg-fill-muted/50' };
  };

  const status = getStatusIcon();

  if (!product) {
    return (
      <div className="rounded-lg border border-border-danger bg-fill-danger/5 px-4 py-3">
        <Typography variant="bodySm" colorRole="danger">
          Product unavailable: {lineItem.productId}
        </Typography>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-2 transition-all duration-200 ${
      isExpanded
        ? 'border-border-brand bg-white shadow-md'
        : 'border-border-muted bg-white hover:border-border-brand/50 hover:shadow-sm'
    }`}>
      {/* Compact Row */}
      <div
        className="grid grid-cols-12 gap-2 px-4 py-3 cursor-pointer items-center"
        onClick={onToggle}
      >
        {/* Expand Icon + Product Name */}
        <div className="col-span-5 flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 text-text-muted">
            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <Typography variant="bodySm" className="font-semibold truncate">
              {product.name}
            </Typography>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              {product.producer && <span className="truncate max-w-[120px]">{product.producer}</span>}
              {product.year && <span>• {product.year}</span>}
              {lineItem.vintage && <span>• V{lineItem.vintage}</span>}
            </div>
          </div>
        </div>

        {/* Requested Quantity */}
        <div className="col-span-1 text-center">
          <Typography variant="bodySm" colorRole="muted">
            {lineItem.quantity}
          </Typography>
        </div>

        {/* Confirmed Quantity + Stock */}
        <div className="col-span-2 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            min="0"
            value={adjustment?.confirmedQuantity ?? lineItem.quantity}
            onChange={(e) => {
              const value = parseInt(e.target.value) || 0;
              onAdjustmentChange({
                adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
                confirmedQuantity: value,
                available: value > 0,
                notes: adjustment?.notes,
                adminAlternatives: adjustment?.adminAlternatives,
              });
            }}
            className="w-16 text-center text-sm py-1 h-8"
          />
          <label className="flex items-center cursor-pointer" title="In Stock">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => {
                onAdjustmentChange({
                  adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
                  confirmedQuantity: e.target.checked ? (adjustment?.confirmedQuantity ?? lineItem.quantity) : 0,
                  available: e.target.checked,
                  notes: adjustment?.notes,
                  adminAlternatives: adjustment?.adminAlternatives,
                });
              }}
              className="h-4 w-4 rounded border-2 cursor-pointer"
            />
          </label>
        </div>

        {/* Price per Case */}
        <div className="col-span-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={adjustment?.adjustedPricePerCase ?? pricePerCase}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                onAdjustmentChange({
                  adjustedPricePerCase: value,
                  confirmedQuantity: adjustment?.confirmedQuantity ?? lineItem.quantity,
                  available: adjustment?.available ?? true,
                  notes: adjustment?.notes,
                  adminAlternatives: adjustment?.adminAlternatives,
                });
              }}
              className="w-24 pl-5 text-right text-sm py-1 h-8"
            />
          </div>
        </div>

        {/* Line Total */}
        <div className="col-span-1 text-right">
          <Typography variant="bodySm" className="font-semibold">
            {formatPrice(displayLineTotal, displayCurrency)}
          </Typography>
        </div>

        {/* Status */}
        <div className="col-span-1 flex justify-center">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm ${status.bg} ${status.color}`}>
            {status.icon}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border-muted px-4 py-4 bg-fill-muted/20 space-y-4">
          {/* Alternative Vintages (if customer requested) */}
          {lineItem.alternativeVintages && lineItem.alternativeVintages.length > 0 && (
            <div className="rounded-lg bg-fill-brand/5 border border-border-brand/30 p-3">
              <Typography variant="bodyXs" className="font-semibold mb-2 flex items-center gap-1">
                <span>📅</span> Customer requested alternatives:
              </Typography>
              <div className="flex flex-wrap gap-1.5">
                {lineItem.alternativeVintages.map((vintage, idx) => (
                  <span
                    key={idx}
                    className="inline-flex px-2 py-0.5 rounded bg-fill-brand/10 text-text-brand text-xs font-medium"
                  >
                    {vintage}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Typography variant="bodyXs" className="font-semibold mb-1.5">
              Notes <span className="text-text-muted font-normal">(optional)</span>
            </Typography>
            <TextArea
              value={adjustment?.notes || ''}
              onChange={(e) => {
                onAdjustmentChange({
                  adjustedPricePerCase: adjustment?.adjustedPricePerCase ?? pricePerCase,
                  confirmedQuantity: adjustment?.confirmedQuantity ?? lineItem.quantity,
                  available: adjustment?.available ?? true,
                  notes: e.target.value,
                  adminAlternatives: adjustment?.adminAlternatives,
                });
              }}
              placeholder="e.g., Substituted with 2019 vintage, Price adjusted due to supplier discount"
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Alternatives Section */}
          <AlternativesSection
            adjustment={adjustment}
            pricePerCase={pricePerCase}
            lineItem={lineItem}
            onAdjustmentChange={onAdjustmentChange}
          />
        </div>
      )}
    </div>
  );
};

export default ReviewLineItemRow;
