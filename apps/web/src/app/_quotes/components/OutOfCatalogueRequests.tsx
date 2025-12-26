'use client';

import { IconPlus, IconTrash, IconWine } from '@tabler/icons-react';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Input from '@/app/_ui/components/Input/Input';
import Typography from '@/app/_ui/components/Typography/Typography';

export interface OutOfCatalogueItem {
  id: string;
  productName: string;
  vintage?: string;
  quantity?: number;
  priceExpectation?: string;
  notes?: string;
}

interface OutOfCatalogueRequestsProps {
  items: OutOfCatalogueItem[];
  onItemsChange: (items: OutOfCatalogueItem[]) => void;
}

/**
 * Component for B2C users to request products not in the catalogue
 *
 * These requests don't affect the quote total but are visible to admins
 * for review and qualification during the quote approval process.
 */
const OutOfCatalogueRequests = ({
  items,
  onItemsChange,
}: OutOfCatalogueRequestsProps) => {
  const [isExpanded, setIsExpanded] = useState(items.length > 0);

  const handleAddItem = () => {
    const newItem: OutOfCatalogueItem = {
      id: crypto.randomUUID(),
      productName: '',
    };
    onItemsChange([...items, newItem]);
    setIsExpanded(true);
  };

  const handleRemoveItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<OutOfCatalogueItem>) => {
    onItemsChange(
      items.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  };

  return (
    <div className="rounded-xl border border-border-muted bg-surface-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fill-brand/10">
            <IconWine className="h-4 w-4 text-text-brand" />
          </div>
          <div>
            <Typography variant="bodySm" className="font-semibold">
              Can&apos;t find what you&apos;re looking for?
            </Typography>
            <Typography variant="bodyXs" colorRole="muted">
              Request products not in our catalogue
            </Typography>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
        >
          <ButtonContent iconLeft={IconPlus}>Add Request</ButtonContent>
        </Button>
      </div>

      {/* Collapsible content */}
      {isExpanded && items.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-border-brand/20 bg-fill-brand/5 p-3">
            <Typography variant="bodyXs" colorRole="muted">
              These requests will be reviewed by our team. They don&apos;t affect your
              quote total - we&apos;ll follow up with availability and pricing.
            </Typography>
          </div>

          {items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-border-muted bg-surface-primary p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <Typography variant="bodyXs" colorRole="muted" className="font-medium">
                  Request #{index + 1}
                </Typography>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  className="rounded-md p-1 text-text-muted hover:bg-fill-muted hover:text-text-danger transition-colors"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Product Name */}
                <div className="sm:col-span-2">
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </Typography>
                  <Input
                    type="text"
                    placeholder="e.g., Chateau Margaux 2015"
                    value={item.productName}
                    onChange={(e) =>
                      handleUpdateItem(item.id, { productName: e.target.value })
                    }
                    size="sm"
                  />
                </div>

                {/* Vintage */}
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Vintage (Year)
                  </Typography>
                  <Input
                    type="text"
                    placeholder="e.g., 2015"
                    value={item.vintage || ''}
                    onChange={(e) =>
                      handleUpdateItem(item.id, { vintage: e.target.value })
                    }
                    size="sm"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Quantity (Cases)
                  </Typography>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    min={1}
                    value={item.quantity || ''}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        quantity: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    size="sm"
                  />
                </div>

                {/* Price Expectation */}
                <div className="sm:col-span-2">
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Price Expectation (Optional)
                  </Typography>
                  <Input
                    type="text"
                    placeholder="e.g., ~$500 per case or market price"
                    value={item.priceExpectation || ''}
                    onChange={(e) =>
                      handleUpdateItem(item.id, { priceExpectation: e.target.value })
                    }
                    size="sm"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                    Additional Notes
                  </Typography>
                  <textarea
                    placeholder="Any specific requirements or details..."
                    value={item.notes || ''}
                    onChange={(e) =>
                      handleUpdateItem(item.id, { notes: e.target.value })
                    }
                    rows={2}
                    className="min-h-[60px] w-full resize-none rounded-lg border border-b-2 border-border-primary bg-fill-primary px-2.5 py-2 text-sm font-medium tracking-tight text-text-primary transition-all duration-200 placeholder:text-text-muted/60 hover:border-border-primary-hover focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-border-primary"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add another button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddItem}
            className="w-full"
          >
            <ButtonContent iconLeft={IconPlus}>Add Another Request</ButtonContent>
          </Button>
        </div>
      )}
    </div>
  );
};

export default OutOfCatalogueRequests;
