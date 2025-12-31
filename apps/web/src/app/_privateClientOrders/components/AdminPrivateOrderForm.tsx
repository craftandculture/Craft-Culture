'use client';

import { IconArrowLeft, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Divider from '@/app/_ui/components/Divider/Divider';
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

interface LineItem {
  id: string;
  productName: string;
  producer: string;
  vintage: string;
  lwin: string;
  quantity: number;
  pricePerCaseUsd: number;
  source: 'partner_local' | 'partner_airfreight' | 'cc_inventory' | 'manual';
}

/**
 * Admin Private Order Creation Form
 *
 * Allows admins to create private client orders on behalf of partners.
 */
const AdminPrivateOrderForm = () => {
  const router = useRouter();
  const trpcClient = useTRPCClient();

  // Partner selection state
  const [partnerId, setPartnerId] = useState('');

  // Client info state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [partnerNotes, setPartnerNotes] = useState('');

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Fetch partners list (wine partners for creating orders)
  const partnersQuery = useQuery({
    queryKey: ['partners'],
    queryFn: () => trpcClient.partners.getMany.query({}),
  });

  // Create order mutation (admin endpoint)
  const createOrder = useMutation({
    mutationFn: async (data: {
      partnerId: string;
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      clientAddress?: string;
      deliveryNotes?: string;
      partnerNotes?: string;
    }) => {
      return trpcClient.privateClientOrders.adminCreate.mutate(data);
    },
    onSuccess: (order) => {
      toast.success('Order created successfully');
      if (order) {
        router.push(`/platform/admin/private-orders/${order.id}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create order');
    },
  });

  // Add line item mutation (admin endpoint)
  const addLineItem = useMutation({
    mutationFn: async (data: {
      orderId: string;
      productName: string;
      producer?: string;
      vintage?: string;
      lwin?: string;
      quantity: number;
      pricePerCaseUsd: number;
      source: 'partner_local' | 'partner_airfreight' | 'cc_inventory' | 'manual';
    }) => {
      return trpcClient.privateClientOrders.adminAddItem.mutate(data);
    },
  });

  const handleAddLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      productName: '',
      producer: '',
      vintage: '',
      lwin: '',
      quantity: 1,
      pricePerCaseUsd: 0,
      source: 'manual',
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleUpdateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    );
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const calculateSubtotal = () => {
    return lineItems.reduce(
      (sum, item) => sum + item.quantity * item.pricePerCaseUsd,
      0,
    );
  };

  const calculateTotalCases = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!partnerId) {
      toast.error('Please select a partner');
      return;
    }

    if (!clientName.trim()) {
      toast.error('Client name is required');
      return;
    }

    // Create the order first
    const order = await createOrder.mutateAsync({
      partnerId,
      clientName,
      clientEmail: clientEmail || undefined,
      clientPhone: clientPhone || undefined,
      clientAddress: clientAddress || undefined,
      deliveryNotes: deliveryNotes || undefined,
      partnerNotes: partnerNotes || undefined,
    });

    if (!order) {
      toast.error('Failed to create order');
      return;
    }

    // Then add all line items
    for (const item of lineItems) {
      if (item.productName.trim()) {
        await addLineItem.mutateAsync({
          orderId: order.id,
          productName: item.productName,
          producer: item.producer || undefined,
          vintage: item.vintage || undefined,
          lwin: item.lwin || undefined,
          quantity: item.quantity,
          pricePerCaseUsd: item.pricePerCaseUsd,
          source: item.source,
        });
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/platform/admin/private-orders">
            <Icon icon={IconArrowLeft} size="sm" />
          </Link>
        </Button>
        <Typography variant="headingLg">New Private Order (Admin)</Typography>
      </div>

      {/* Partner Selection */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Typography variant="headingSm">Partner</Typography>

          <div className="flex flex-col gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              Select Partner *
            </Typography>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a partner..." />
              </SelectTrigger>
              <SelectContent>
                {partnersQuery.data?.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Typography variant="bodyXs" colorRole="muted">
              This order will be created on behalf of the selected partner
            </Typography>
          </div>
        </CardContent>
      </Card>

      {/* Client Details Section */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Typography variant="headingSm">Client Details</Typography>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Client Name *
              </Typography>
              <Input
                placeholder="Enter client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Email
              </Typography>
              <Input
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Phone
              </Typography>
              <Input
                type="tel"
                placeholder="+971 50 123 4567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Typography variant="bodySm" className="font-medium">
                Delivery Address
              </Typography>
              <Input
                placeholder="Dubai Marina, Tower 5, Apt 2301"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              Delivery Notes
            </Typography>
            <Input
              placeholder="Special delivery instructions..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items Section */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Typography variant="headingSm">Products</Typography>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLineItem}
            >
              <ButtonContent iconLeft={IconPlus}>Add Product</ButtonContent>
            </Button>
          </div>

          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-muted py-8">
              <Typography variant="bodySm" colorRole="muted">
                No products added yet
              </Typography>
              <Button
                type="button"
                variant="default"
                colorRole="brand"
                size="sm"
                onClick={handleAddLineItem}
              >
                <ButtonContent iconLeft={IconPlus}>
                  Add First Product
                </ButtonContent>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Table Header */}
              <div className="hidden gap-2 border-b border-border-muted pb-2 md:grid md:grid-cols-12">
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="col-span-4 font-medium uppercase"
                >
                  Product
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="col-span-2 font-medium uppercase"
                >
                  Producer
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="col-span-1 font-medium uppercase"
                >
                  Vintage
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="col-span-1 text-center font-medium uppercase"
                >
                  Qty
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="col-span-2 text-right font-medium uppercase"
                >
                  Price/Case
                </Typography>
                <Typography
                  variant="bodyXs"
                  colorRole="muted"
                  className="col-span-1 text-right font-medium uppercase"
                >
                  Total
                </Typography>
                <div className="col-span-1" />
              </div>

              {/* Line Items */}
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-lg border border-border-muted p-3 md:grid-cols-12 md:items-center md:border-0 md:p-0"
                >
                  <div className="col-span-4">
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mb-1 md:hidden"
                    >
                      Product Name
                    </Typography>
                    <Input
                      placeholder="Wine name"
                      value={item.productName}
                      onChange={(e) =>
                        handleUpdateLineItem(item.id, {
                          productName: e.target.value,
                        })
                      }
                      size="sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mb-1 md:hidden"
                    >
                      Producer
                    </Typography>
                    <Input
                      placeholder="Producer"
                      value={item.producer}
                      onChange={(e) =>
                        handleUpdateLineItem(item.id, {
                          producer: e.target.value,
                        })
                      }
                      size="sm"
                    />
                  </div>

                  <div className="col-span-1">
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mb-1 md:hidden"
                    >
                      Vintage
                    </Typography>
                    <Input
                      placeholder="Year"
                      value={item.vintage}
                      onChange={(e) =>
                        handleUpdateLineItem(item.id, {
                          vintage: e.target.value,
                        })
                      }
                      size="sm"
                    />
                  </div>

                  <div className="col-span-1">
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mb-1 md:hidden"
                    >
                      Quantity
                    </Typography>
                    <Input
                      type="number"
                      min={1}
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateLineItem(item.id, {
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      size="sm"
                      className="text-center"
                    />
                  </div>

                  <div className="col-span-2">
                    <Typography
                      variant="bodyXs"
                      colorRole="muted"
                      className="mb-1 md:hidden"
                    >
                      Price per Case (USD)
                    </Typography>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0"
                      value={item.pricePerCaseUsd || ''}
                      onChange={(e) =>
                        handleUpdateLineItem(item.id, {
                          pricePerCaseUsd: parseFloat(e.target.value) || 0,
                        })
                      }
                      size="sm"
                      className="text-right"
                    />
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    <Typography variant="bodySm" className="font-medium">
                      {formatCurrency(item.quantity * item.pricePerCaseUsd)}
                    </Typography>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLineItem(item.id)}
                    >
                      <Icon icon={IconTrash} size="sm" colorRole="danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Summary Section */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <Typography variant="headingSm">Order Summary</Typography>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Typography variant="bodySm" colorRole="muted">
                Total Cases
              </Typography>
              <Typography variant="bodySm" className="font-medium">
                {calculateTotalCases()}
              </Typography>
            </div>

            <div className="flex items-center justify-between">
              <Typography variant="bodySm" colorRole="muted">
                Total Items
              </Typography>
              <Typography variant="bodySm" className="font-medium">
                {lineItems.length}
              </Typography>
            </div>

            <Divider />

            <div className="flex items-center justify-between">
              <Typography variant="bodySm" colorRole="muted">
                Subtotal (USD)
              </Typography>
              <Typography variant="bodyMd" className="font-semibold">
                {formatCurrency(calculateSubtotal())}
              </Typography>
            </div>

            <Typography variant="bodyXs" colorRole="muted">
              Duty, VAT, and logistics will be calculated after review
            </Typography>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography variant="bodySm" className="font-medium">
              Internal Notes
            </Typography>
            <Input
              placeholder="Notes for internal use only..."
              value={partnerNotes}
              onChange={(e) => setPartnerNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/platform/admin/private-orders">Cancel</Link>
        </Button>
        <Button
          type="submit"
          variant="default"
          colorRole="brand"
          isDisabled={createOrder.isPending || !clientName.trim() || !partnerId}
        >
          <ButtonContent iconLeft={IconSend}>
            {createOrder.isPending ? 'Creating...' : 'Create Order'}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
};

export default AdminPrivateOrderForm;
