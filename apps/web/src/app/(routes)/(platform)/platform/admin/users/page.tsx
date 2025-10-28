'use client';

import { IconCheck, IconSearch, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

/**
 * Admin page for managing user approvals
 *
 * Features:
 * - Filter users by approval status
 * - Search users by name or email
 * - Approve or reject user applications
 * - Real-time status updates
 */
const UserManagementPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users
  const { data, isLoading, refetch } = useQuery({
    ...api.users.getPaginated.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
      limit: 50,
    }),
  });

  // Approve user mutation
  const { mutate: approveUser, isPending: isApproving } = useMutation(
    api.users.approve.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Reject user mutation
  const { mutate: rejectUser, isPending: isRejecting } = useMutation(
    api.users.reject.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  const users = data?.data ?? [];
  const totalCount = data?.meta.totalCount ?? 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getCustomerTypeLabel = (type: string) => {
    return type === 'b2b' ? 'Distributor (B2B)' : 'Sales Person (B2C)';
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Typography variant="displaySm" className="font-bold">
            User Management
          </Typography>
          <Typography variant="bodyMd" className="text-text-secondary mt-1">
            Review and approve user applications
          </Typography>
        </div>

        {/* Filters Card */}
        <Card>
          <CardContent className="space-y-4 p-6">
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  <ButtonContent>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </ButtonContent>
                </Button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Results count */}
            <Typography variant="bodySm" className="text-text-muted">
              {isLoading ? 'Loading...' : `${totalCount} users found`}
            </Typography>
          </CardContent>
        </Card>

        {/* Users Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                Loading users...
              </Typography>
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                No users found
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead className="border-border-muted border-b">
                    <tr>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        User
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Customer Type
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Signup Date
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border-muted divide-y">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-muted">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <Typography variant="bodySm" className="font-medium">
                              {user.name}
                            </Typography>
                            <Typography variant="bodyXs" className="text-text-muted">
                              {user.email}
                            </Typography>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm">
                            {getCustomerTypeLabel(user.customerType)}
                          </Typography>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(user.approvalStatus)}</td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm" className="text-text-secondary">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </Typography>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {user.approvalStatus === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveUser({ userId: user.id })}
                                  isDisabled={isApproving}
                                  className="border-green-500 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20"
                                >
                                  <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => rejectUser({ userId: user.id })}
                                  isDisabled={isRejecting}
                                  className="border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                  <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                                </Button>
                              </>
                            )}
                            {user.approvalStatus === 'approved' && (
                              <Typography variant="bodyXs" className="text-text-muted">
                                No actions
                              </Typography>
                            )}
                            {user.approvalStatus === 'rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveUser({ userId: user.id })}
                                isDisabled={isApproving}
                                className="border-green-500 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20"
                              >
                                <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="divide-border-muted divide-y md:hidden">
                {users.map((user) => (
                  <div key={user.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Typography variant="bodySm" className="font-medium">
                          {user.name}
                        </Typography>
                        <Typography variant="bodyXs" className="text-text-muted">
                          {user.email}
                        </Typography>
                      </div>
                      {getStatusBadge(user.approvalStatus)}
                    </div>

                    <div className="space-y-1">
                      <Typography variant="bodyXs" className="text-text-secondary">
                        {getCustomerTypeLabel(user.customerType)}
                      </Typography>
                      <Typography variant="bodyXs" className="text-text-muted">
                        Signed up {new Date(user.createdAt).toLocaleDateString()}
                      </Typography>
                    </div>

                    {user.approvalStatus === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveUser({ userId: user.id })}
                          isDisabled={isApproving}
                          className="border-green-500 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20 flex-1"
                        >
                          <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectUser({ userId: user.id })}
                          isDisabled={isRejecting}
                          className="border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 flex-1"
                        >
                          <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                        </Button>
                      </div>
                    )}
                    {user.approvalStatus === 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveUser({ userId: user.id })}
                        isDisabled={isApproving}
                        className="border-green-500 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20 w-full"
                      >
                        <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UserManagementPage;
