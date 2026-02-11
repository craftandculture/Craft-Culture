'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import OwnerBadge from '@/app/_wms/components/OwnerBadge';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

/**
 * WMS Partner Requests - Admin view to review and resolve partner requests
 * for transfers, withdrawals, and marking stock for sale
 */
const WMSPartnerRequestsPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [resolveModal, setResolveModal] = useState<{
    requestId: string;
    requestNumber: string;
    productName: string;
    action: 'approved' | 'rejected';
  } | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch requests
  const { data, isLoading, refetch } = useQuery({
    ...api.wms.admin.ownership.getRequests.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 50,
      offset: 0,
    }),
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    ...api.wms.admin.ownership.resolve.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      setResolveModal(null);
      setAdminNotes('');
    },
  });

  const handleResolve = (
    requestId: string,
    requestNumber: string,
    productName: string,
    action: 'approved' | 'rejected',
  ) => {
    setResolveModal({ requestId, requestNumber, productName, action });
    setAdminNotes('');
  };

  const confirmResolve = () => {
    if (!resolveModal) return;
    resolveMutation.mutate({
      requestId: resolveModal.requestId,
      status: resolveModal.action,
      adminNotes: adminNotes || undefined,
    });
  };

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'all', label: 'All' },
  ];

  const getRequestTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      transfer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      mark_for_sale: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      withdrawal: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    };
    const labels: Record<string, string> = {
      transfer: 'Transfer',
      mark_for_sale: 'For Sale',
      withdrawal: 'Withdrawal',
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[type] || 'bg-fill-secondary text-text-muted'}`}>
        {labels[type] || type}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-fill-secondary text-text-muted'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link
            href="/platform/admin/wms"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
          >
            <IconArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0 flex-1">
            <Typography variant="headingLg" className="mb-1">
              Partner Requests
            </Typography>
            <div className="flex flex-wrap items-center gap-2">
              <Typography variant="bodySm" colorRole="muted">
                Review and approve partner requests
              </Typography>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <ButtonContent iconLeft={IconRefresh}>Refresh</ButtonContent>
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Typography variant="headingLg" className="text-amber-600">
                  {data.summary.pendingCount}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  Pending Review
                </Typography>
              </CardContent>
            </Card>
            {data.summary.byStatus.map((stat) => (
              <Card key={stat.status}>
                <CardContent className="p-4 text-center">
                  <Typography variant="headingMd">{stat.count}</Typography>
                  <Typography variant="bodyXs" colorRole="muted">
                    {stat.status.charAt(0).toUpperCase() + stat.status.slice(1)}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1 rounded-lg bg-fill-secondary p-1">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === filter.id
                  ? 'bg-fill-primary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {filter.label}
              {filter.id === 'pending' && data?.summary?.pendingCount ? (
                <span className="ml-1 text-amber-600">({data.summary.pendingCount})</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
          </div>
        )}

        {/* Requests List */}
        {!isLoading && data && (
          <div className="space-y-3">
            {data.requests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Icon icon={IconCheck} size="xl" colorRole="muted" className="mx-auto mb-4" />
                  <Typography variant="headingSm" className="mb-2">
                    No Requests
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    {statusFilter === 'pending'
                      ? 'All requests have been processed'
                      : 'No requests match this filter'}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              data.requests.map((request) => (
                <Card key={request.id} className="hover:border-border-brand">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Typography variant="headingSm">{request.requestNumber}</Typography>
                          {getRequestTypeBadge(request.requestType)}
                          {getStatusBadge(request.status)}
                        </div>

                        <Typography variant="bodySm">{request.productName}</Typography>
                        <Typography variant="bodyXs" colorRole="muted" className="font-mono">
                          {request.lwin18}
                        </Typography>

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <OwnerBadge ownerName={request.partnerName ?? 'Unknown'} size="sm" />
                          <Typography variant="bodyXs" colorRole="muted">
                            {request.quantityCases} cases
                          </Typography>
                          {request.targetLocationCode && (
                            <div className="flex items-center gap-1">
                              <IconArrowRight className="h-3 w-3 text-text-muted" />
                              <LocationBadge locationCode={request.targetLocationCode} size="sm" />
                            </div>
                          )}
                        </div>

                        {request.partnerNotes && (
                          <Typography variant="bodyXs" colorRole="muted" className="mt-2 italic">
                            &ldquo;{request.partnerNotes}&rdquo;
                          </Typography>
                        )}

                        <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                          <span>
                            Requested by {request.requestedBy?.name ?? 'Unknown'} on{' '}
                            {new Date(request.requestedAt ?? request.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {request.adminNotes && (
                          <div className="mt-2 rounded bg-fill-secondary p-2">
                            <Typography variant="bodyXs" colorRole="muted">
                              Admin note: {request.adminNotes}
                            </Typography>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {request.status === 'pending' && (
                        <div className="flex gap-2 sm:flex-col">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              handleResolve(request.id, request.requestNumber, request.productName, 'approved')
                            }
                          >
                            <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleResolve(request.id, request.requestNumber, request.productName, 'rejected')
                            }
                          >
                            <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Pagination info */}
            {data.pagination.total > 0 && (
              <Typography variant="bodyXs" colorRole="muted" className="text-center">
                Showing {data.requests.length} of {data.pagination.total} requests
              </Typography>
            )}
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <Typography variant="headingSm" className="mb-4">
                {resolveModal.action === 'approved' ? 'Approve' : 'Reject'} Request
              </Typography>

              <div className="mb-4 rounded bg-fill-secondary p-3">
                <Typography variant="bodySm" className="font-medium">
                  {resolveModal.requestNumber}
                </Typography>
                <Typography variant="bodyXs" colorRole="muted">
                  {resolveModal.productName}
                </Typography>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">
                  Admin Notes (optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder={
                    resolveModal.action === 'approved'
                      ? 'Any notes about approval...'
                      : 'Reason for rejection...'
                  }
                  rows={3}
                  className="w-full rounded-lg border border-border-primary bg-fill-primary p-2 text-sm focus:border-border-brand focus:outline-none focus:ring-1 focus:ring-border-brand"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setResolveModal(null)}
                  disabled={resolveMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant={resolveModal.action === 'approved' ? 'primary' : 'destructive'}
                  className="flex-1"
                  onClick={confirmResolve}
                  disabled={resolveMutation.isPending}
                >
                  <ButtonContent iconLeft={resolveMutation.isPending ? IconLoader2 : undefined}>
                    {resolveMutation.isPending
                      ? 'Processing...'
                      : resolveModal.action === 'approved'
                        ? 'Approve'
                        : 'Reject'}
                  </ButtonContent>
                </Button>
              </div>

              {resolveMutation.isError && (
                <Typography variant="bodyXs" className="mt-3 text-red-600">
                  {resolveMutation.error?.message}
                </Typography>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WMSPartnerRequestsPage;
