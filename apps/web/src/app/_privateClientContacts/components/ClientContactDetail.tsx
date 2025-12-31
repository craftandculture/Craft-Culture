'use client';

import {
  IconArrowLeft,
  IconMail,
  IconMapPin,
  IconPencil,
  IconPhone,
  IconPlus,
  IconWine,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import Link from 'next/link';

import PrivateOrderStatusBadge from '@/app/_privateClientOrders/components/PrivateOrderStatusBadge';
import Button from '@/app/_ui/components/Button/Button';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import { useTRPCClient } from '@/lib/trpc/browser';

interface ClientContactDetailProps {
  clientId: string;
}

/**
 * Detail view for a client contact with order history
 */
const ClientContactDetail = ({ clientId }: ClientContactDetailProps) => {
  const trpcClient = useTRPCClient();

  const { data: contact, isLoading } = useQuery({
    queryKey: ['privateClientContacts.getOne', clientId],
    queryFn: () => trpcClient.privateClientContacts.getOne.query({ id: clientId }),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Typography variant="bodySm" colorRole="muted">
          Loading client...
        </Typography>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Typography variant="bodySm" colorRole="muted">
          Client not found
        </Typography>
        <Button asChild variant="outline">
          <Link href="/platform/clients">
            <Icon icon={IconArrowLeft} size="sm" className="mr-2" />
            Back to Clients
          </Link>
        </Button>
      </div>
    );
  }

  const address = [
    contact.addressLine1,
    contact.addressLine2,
    contact.city,
    contact.stateProvince,
    contact.postalCode,
    contact.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/platform/clients"
            className="mb-2 flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
          >
            <Icon icon={IconArrowLeft} size="sm" />
            Back to Clients
          </Link>
          <Typography variant="h2">{contact.name}</Typography>
          <Typography variant="bodySm" colorRole="muted">
            Client since {format(new Date(contact.createdAt), 'MMMM yyyy')}
          </Typography>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/platform/clients/${contact.id}/edit`}>
              <Icon icon={IconPencil} size="sm" className="mr-2" />
              Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/platform/private-orders/new?clientId=${contact.id}`}>
              <Icon icon={IconPlus} size="sm" className="mr-2" />
              New Order
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Contact Details Card */}
          <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-6">
            <Typography variant="h4" className="mb-4">
              Contact Details
            </Typography>
            <div className="space-y-3">
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Icon icon={IconMail} size="sm" colorRole="muted" />
                  <Typography variant="bodySm">{contact.email}</Typography>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <Icon icon={IconPhone} size="sm" colorRole="muted" />
                  <Typography variant="bodySm">{contact.phone}</Typography>
                </div>
              )}
              {address && (
                <div className="flex items-start gap-3">
                  <Icon icon={IconMapPin} size="sm" colorRole="muted" className="mt-0.5" />
                  <Typography variant="bodySm">{address}</Typography>
                </div>
              )}
            </div>
          </div>

          {/* Preferences Card */}
          {(contact.winePreferences || contact.deliveryInstructions || contact.paymentNotes) && (
            <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-6">
              <Typography variant="h4" className="mb-4">
                Preferences
              </Typography>
              <div className="space-y-4">
                {contact.winePreferences && (
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Wine Preferences
                    </Typography>
                    <Typography variant="bodySm">{contact.winePreferences}</Typography>
                  </div>
                )}
                {contact.deliveryInstructions && (
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Delivery Instructions
                    </Typography>
                    <Typography variant="bodySm">{contact.deliveryInstructions}</Typography>
                  </div>
                )}
                {contact.paymentNotes && (
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Payment Notes
                    </Typography>
                    <Typography variant="bodySm">{contact.paymentNotes}</Typography>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes Card */}
          {contact.notes && (
            <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-6">
              <Typography variant="h4" className="mb-4">
                Internal Notes
              </Typography>
              <Typography variant="bodySm">{contact.notes}</Typography>
            </div>
          )}

          {/* Order History */}
          <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-6">
            <div className="mb-4 flex items-center justify-between">
              <Typography variant="h4">Order History</Typography>
              <Button asChild size="sm" variant="outline">
                <Link href={`/platform/private-orders/new?clientId=${contact.id}`}>
                  <Icon icon={IconPlus} size="sm" className="mr-1" />
                  New Order
                </Link>
              </Button>
            </div>

            {contact.recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Icon icon={IconWine} size="lg" className="text-text-muted" />
                <Typography variant="bodySm" colorRole="muted">
                  No orders yet
                </Typography>
              </div>
            ) : (
              <div className="divide-y divide-border-muted">
                {contact.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/platform/private-orders/${order.id}`}
                    className="flex items-center justify-between py-3 transition-colors hover:bg-surface-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <Typography variant="bodySm" className="font-mono font-medium">
                          {order.orderNumber}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {format(new Date(order.createdAt), 'MMM d, yyyy')}
                        </Typography>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Typography variant="bodySm" className="font-medium">
                          {formatCurrency(order.totalUsd)}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {order.caseCount} cases
                        </Typography>
                      </div>
                      <PrivateOrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border-muted bg-surface-secondary/30 p-6">
            <Typography variant="h4" className="mb-4">
              Summary
            </Typography>
            <div className="space-y-4">
              <div>
                <Typography variant="bodyXs" colorRole="muted">
                  Total Orders
                </Typography>
                <Typography variant="h3">{contact.totalOrders}</Typography>
              </div>
              <div>
                <Typography variant="bodyXs" colorRole="muted">
                  Total Spend
                </Typography>
                <Typography variant="h3">{formatCurrency(contact.totalSpendUsd)}</Typography>
              </div>
              <div>
                <Typography variant="bodyXs" colorRole="muted">
                  Last Order
                </Typography>
                <Typography variant="bodySm">
                  {contact.lastOrderAt
                    ? format(new Date(contact.lastOrderAt), 'MMMM d, yyyy')
                    : 'Never'}
                </Typography>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientContactDetail;
