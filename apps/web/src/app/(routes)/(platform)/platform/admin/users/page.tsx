'use client';

import { IconCheck, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import AlertDialogTrigger from '@/app/_ui/components/AlertDialog/AlertDialogTrigger';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface UserData {
  id: string;
  name: string | null;
  email: string;
  customerType: string;
  approvalStatus: string;
  createdAt: Date | string;
}

/**
 * Admin page for managing user approvals
 *
 * Features:
 * - Filter users by approval status
 * - Search users by name or email
 * - Approve or reject user applications
 * - Delete user accounts with confirmation
 * - Real-time status updates
 */
const UserManagementPage = () => {
  const api = useTRPC();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users
  const { data, isLoading, refetch } = useQuery({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(api.users as any).getPaginated.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
      limit: 50,
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // Approve user mutation
  const { mutate: approveUser, isPending: isApproving } = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.users as any).approve.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Reject user mutation
  const { mutate: rejectUser, isPending: isRejecting } = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.users as any).reject.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Delete user mutation
  const { mutate: deleteUser, isPending: isDeleting } = useMutation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.users as any).delete.mutationOptions({
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
                  variant={statusFilter === status ? 'default' : 'outline'}
                  colorRole={statusFilter === status ? 'brand' : 'primary'}
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
                    {users.map((user: UserData) => (
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  isDisabled={isDeleting}
                                  className="border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                  <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {user.name}? This action
                                    cannot be undone and will permanently delete their account and
                                    all associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser({ userId: user.id })}
                                    className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                                  >
                                    Delete User
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

                    <div className="space-y-2">
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            isDisabled={isDeleting}
                            className="border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 w-full"
                          >
                            <ButtonContent iconLeft={IconTrash}>Delete User</ButtonContent>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {user.name}? This action cannot
                              be undone and will permanently delete their account and all
                              associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUser({ userId: user.id })}
                              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                            >
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
