'use client';

import {
  IconArrowLeft,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type Tab = 'sales' | 'private';

/**
 * Create new pick list from order
 *
 * Shows two tabs: Sales Orders (Zoho) and Private Orders (PCO).
 * Sales Orders tab is the default — shows invoiced Zoho orders ready for picking.
 */
const NewPickListPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Fetch Zoho sales orders
  const { data: zohoOrders, isLoading: isLoadingZoho } = useQuery({
    ...api.zohoSalesOrders.list.queryOptions(),
    select: (orders) =>
      orders
        .filter(
          (o) => o.status === 'synced' && o.zohoStatus === 'invoiced',
        )
        .sort((a, b) =>
          (b.salesOrderNumber ?? '').localeCompare(
            a.salesOrderNumber ?? '',
          ),
        ),
  });

  // Fetch PCO orders (cc_approved status, no pick list yet)
  const { data: pcoOrders, isLoading: isLoadingPco } = useQuery({
    ...api.privateClientOrders.admin.getMany.queryOptions({
      status: 'cc_approved',
      limit: 50,
    }),
  });

  // Release Zoho order to pick (creates pick list)
  const releaseToPickMutation = useMutation({
    ...api.zohoSalesOrders.releaseToPick.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      router.push(`/platform/admin/wms/pick/${data.pickList.id}`);
    },
  });

  // Create PCO pick list
  const createPcoMutation = useMutation({
    ...api.wms.admin.picking.create.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      router.push(`/platform/admin/wms/pick/${data.pickList.id}`);
    },
  });

  // Sync Zoho orders
  const syncMutation = useMutation({
    ...api.zohoSalesOrders.sync.mutationOptions(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries();
      alert(data.message);
    },
  });

  const isCreating =
    releaseToPickMutation.isPending || createPcoMutation.isPending;
  const createError =
    releaseToPickMutation.error ?? createPcoMutation.error;

  const handleCreate = () => {
    if (!selectedOrderId) return;
    if (activeTab === 'sales') {
      releaseToPickMutation.mutate({ salesOrderId: selectedOrderId });
    } else {
      createPcoMutation.mutate({ orderId: selectedOrderId });
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedOrderId(null);
    setSearchQuery('');
  };

  // Filter Zoho orders by search
  const filteredZohoOrders = zohoOrders?.filter((order) =>
    searchQuery
      ? order.salesOrderNumber
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        order.customerName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true,
  );

  // Filter PCO orders by search
  const filteredPcoOrders = pcoOrders?.orders.filter((order) =>
    searchQuery
      ? order.orderNumber
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        order.clientName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
      : true,
  );

  const isLoading = activeTab === 'sales' ? isLoadingZoho : isLoadingPco;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/platform/admin/wms/pick">
            <Button variant="ghost" size="sm">
              <Icon icon={IconArrowLeft} size="sm" />
            </Button>
          </Link>
          <div className="flex-1">
            <Typography variant="headingMd">New Pick List</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Select an order to create a pick list
            </Typography>
          </div>
          {activeTab === 'sales' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <Icon
                icon={syncMutation.isPending ? IconLoader2 : IconRefresh}
                size="sm"
                className={syncMutation.isPending ? 'animate-spin' : ''}
              />
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-fill-secondary p-1">
          <button
            type="button"
            onClick={() => handleTabChange('sales')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sales'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Sales Orders
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('private')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'private'
                ? 'bg-fill-primary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Private Orders
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Icon
            icon={IconSearch}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full rounded-lg border border-border-primary bg-fill-primary py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon
              icon={IconLoader2}
              className="animate-spin"
              colorRole="muted"
              size="lg"
            />
          </div>
        )}

        {/* Sales Orders List (Zoho) */}
        {activeTab === 'sales' && !isLoadingZoho && (
          <div className="space-y-2">
            {filteredZohoOrders?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Typography variant="headingSm" className="mb-2">
                    No Sales Orders Available
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    There are no invoiced sales orders ready for picking
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              filteredZohoOrders?.map((order) => (
                <Card
                  key={order.id}
                  className={`cursor-pointer transition-all ${
                    selectedOrderId === order.id
                      ? 'border-2 border-brand-500 ring-2 ring-brand-500/20'
                      : 'hover:border-border-brand'
                  }`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Typography
                          variant="bodySm"
                          className="font-semibold"
                        >
                          {order.salesOrderNumber}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {order.customerName ?? 'Unknown customer'}
                        </Typography>
                        <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                          <span>{order.itemCount} items</span>
                          <span>{order.totalQuantity} cases</span>
                          <span>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          selectedOrderId === order.id
                            ? 'border-brand-500 bg-brand-500'
                            : 'border-border-primary'
                        }`}
                      >
                        {selectedOrderId === order.id && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Private Orders List (PCO) */}
        {activeTab === 'private' && !isLoadingPco && (
          <div className="space-y-2">
            {filteredPcoOrders?.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Typography variant="headingSm" className="mb-2">
                    No Orders Available
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    There are no approved orders ready for picking
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              filteredPcoOrders?.map((order) => (
                <Card
                  key={order.id}
                  className={`cursor-pointer transition-all ${
                    selectedOrderId === order.id
                      ? 'border-2 border-brand-500 ring-2 ring-brand-500/20'
                      : 'hover:border-border-brand'
                  }`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Typography
                          variant="bodySm"
                          className="font-semibold"
                        >
                          {order.orderNumber}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          {order.clientName ?? 'Unknown client'}
                        </Typography>
                        <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                          <span>{order.totalItems ?? 0} items</span>
                          <span>{order.totalCases ?? 0} cases</span>
                          <span>
                            {new Date(
                              order.createdAt,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          selectedOrderId === order.id
                            ? 'border-brand-500 bg-brand-500'
                            : 'border-border-primary'
                        }`}
                      >
                        {selectedOrderId === order.id && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Create Button */}
        {selectedOrderId && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border-primary bg-fill-primary p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <Button
              variant="default"
              className="w-full"
              onClick={handleCreate}
              disabled={isCreating}
            >
              <ButtonContent
                iconLeft={isCreating ? IconLoader2 : IconPlus}
              >
                {isCreating ? 'Creating...' : 'Create Pick List'}
              </ButtonContent>
            </Button>
            {createError && (
              <Typography
                variant="bodyXs"
                className="mt-2 text-center text-red-600"
              >
                {createError.message}
              </Typography>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewPickListPage;
