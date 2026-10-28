'use client';

import {
  IconChevronRight,
  IconDots,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUserCheck,
  IconX,
} from '@tabler/icons-react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useState } from 'react';
import { toast } from 'sonner';

import UserEditDialog from '@/app/_auth/components/UserEditDialog';
import type { UserToEdit } from '@/app/_auth/components/UserEditDialog';
import UsersStatTiles from '@/app/_auth/components/UsersStatTiles';
import type { UsersFocus } from '@/app/_auth/components/UsersStatTiles';
import customerTypeOptions, {
  getCustomerTypeLabel,
} from '@/app/_auth/constants/customerTypeOptions';
import formatLastSeen from '@/app/_auth/utils/formatLastSeen';
import AlertDialog from '@/app/_ui/components/AlertDialog/AlertDialog';
import AlertDialogAction from '@/app/_ui/components/AlertDialog/AlertDialogAction';
import AlertDialogCancel from '@/app/_ui/components/AlertDialog/AlertDialogCancel';
import AlertDialogContent from '@/app/_ui/components/AlertDialog/AlertDialogContent';
import AlertDialogDescription from '@/app/_ui/components/AlertDialog/AlertDialogDescription';
import AlertDialogFooter from '@/app/_ui/components/AlertDialog/AlertDialogFooter';
import AlertDialogHeader from '@/app/_ui/components/AlertDialog/AlertDialogHeader';
import AlertDialogTitle from '@/app/_ui/components/AlertDialog/AlertDialogTitle';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import DropdownMenu from '@/app/_ui/components/DropdownMenu/DropdownMenu';
import DropdownMenuContent from '@/app/_ui/components/DropdownMenu/DropdownMenuContent';
import DropdownMenuItem from '@/app/_ui/components/DropdownMenu/DropdownMenuItem';
import DropdownMenuTrigger from '@/app/_ui/components/DropdownMenu/DropdownMenuTrigger';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const FOCUS_VALUES: UsersFocus[] = ['pending', 'team', 'partners', 'distributors', 'unlinked', 'never'];
const PAGE = 50;

/**
 * Dialog component for creating a new user
 */
const UserCreateDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) => {
  const api = useTRPC();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState<'b2b' | 'b2c' | 'private_clients'>(
    'private_clients',
  );
  const [role, setRole] = useState<'user' | 'admin' | 'wms_operator'>('user');
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>(
    'approved',
  );
  const [isTestUser, setIsTestUser] = useState(false);

  const resetForm = () => {
    setEmail('');
    setName('');
    setCustomerType('private_clients');
    setRole('user');
    setApprovalStatus('approved');
    setIsTestUser(false);
  };

  const { mutate: createUser, isPending } = useMutation(
    api.users.adminCreate.mutationOptions({
      onSuccess: () => {
        toast.success(
          isTestUser
            ? 'Test user created successfully. Activate them later to assign an email.'
            : 'User created successfully',
        );
        onOpenChange(false);
        resetForm();
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create user');
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser({
      email: isTestUser ? undefined : email,
      name,
      customerType,
      role,
      approvalStatus,
      isTestUser,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            {isTestUser
              ? 'Create a test user without an email. They cannot sign in until activated with a real email.'
              : 'Create a user directly without requiring them to register. They can sign in using magic link.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Test User Toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-border-muted p-3">
            <input
              type="checkbox"
              id="isTestUser"
              checked={isTestUser}
              onChange={(e) => {
                setIsTestUser(e.target.checked);
                if (e.target.checked) {
                  setEmail('');
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <div>
              <Typography variant="bodySm" className="font-medium">
                Create as Test User
              </Typography>
              <Typography variant="bodyXs" className="text-text-muted">
                Test users cannot sign in until activated with a real email
              </Typography>
            </div>
          </div>

          {!isTestUser && (
            <div className="space-y-2">
              <Typography variant="bodySm" className="font-medium">
                Email
              </Typography>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required={!isTestUser}
              />
            </div>
          )}

          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              Name
            </Typography>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="User name"
              required
            />
          </div>

          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              Customer Type
            </Typography>
            <Select
              value={customerType}
              onValueChange={(v) => setCustomerType(v as typeof customerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customerTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              Role
            </Typography>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="wms_operator">WMS Operator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              Approval Status
            </Typography>
            <Select
              value={approvalStatus}
              onValueChange={(v) => setApprovalStatus(v as typeof approvalStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              isDisabled={isPending}
            >
              <ButtonContent>Cancel</ButtonContent>
            </Button>
            <Button
              type="submit"
              colorRole="bold"
              isDisabled={isPending || (!isTestUser && !email) || !name}
            >
              <ButtonContent>
                {isPending ? 'Creating...' : isTestUser ? 'Create Test User' : 'Create User'}
              </ButtonContent>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Dialog component for activating a test user by assigning a real email
 */
const ActivateTestUserDialog = ({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: { id: string; name: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) => {
  const api = useTRPC();
  const [email, setEmail] = useState('');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setEmail('');
    }
  }, [open]);

  const { mutate: activateTestUser, isPending } = useMutation(
    api.users.activateTestUser.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        onOpenChange(false);
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to activate test user');
      },
    }),
  );

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    activateTestUser({
      userId: user.id,
      email: email.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate Test User</DialogTitle>
          <DialogDescription>
            Assign a real email address to <strong>{user.name}</strong> so they can sign in using
            magic link.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              Email Address
            </Typography>
            <Input
              id="activateEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
            <Typography variant="bodyXs" className="text-text-muted">
              The user will be able to sign in with this email using magic link
            </Typography>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              isDisabled={isPending}
            >
              <ButtonContent>Cancel</ButtonContent>
            </Button>
            <Button type="submit" colorRole="bold" isDisabled={isPending || !email.trim()}>
              <ButtonContent>{isPending ? 'Activating...' : 'Activate User'}</ButtonContent>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const pill = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-text-primary text-surface-primary'
      : 'bg-surface-muted text-text-secondary hover:bg-fill-primary-hover hover:text-text-primary'
  }`;

const STATUS_PILL: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Awaiting approval',
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-surface-muted text-text-muted ring-border-muted',
  },
};

const ROLE_PILL: Record<string, { label: string; className: string } | undefined> = {
  admin: {
    label: 'C&C admin',
    className: 'bg-text-primary text-surface-primary ring-transparent',
  },
  wms_operator: {
    label: 'Warehouse',
    className: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  },
};

const chip = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset';

type ListedUser = UserToEdit & {
  isTestUser: boolean | null;
  lastLogin: Date | string | null;
  sharesEmail: boolean;
};

/**
 * Users — who can sign in, what they can see, and who they act for
 *
 * Built exception-first: the tiles count the users that need someone to act
 * (awaiting approval, linked to no organisation) and double as filters. The
 * organisation a login acts for is shown, read-only, on every row; changing
 * it is a deliberate edit, not a dropdown that saves on change.
 */
const UserManagementPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Admin alerts link to ?filter=pending — open on that list rather than all
  const [focus, setFocus] = useState<UsersFocus>(() => {
    const requested = searchParams.get('filter');
    return FOCUS_VALUES.includes(requested as UsersFocus) ? (requested as UsersFocus) : '';
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const search = useDeferredValue(searchQuery.trim());
  const [limit, setLimit] = useState(PAGE);
  const [editingUser, setEditingUser] = useState<UserToEdit | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activateUser, setActivateUser] = useState<{ id: string; name: string | null } | null>(null);
  const [deletingUser, setDeletingUser] = useState<{ id: string; name: string | null } | null>(null);

  // A new filter starts from the first page again
  useEffect(() => setLimit(PAGE), [focus, statusFilter, search]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.users.getPaginated.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      focus: focus || undefined,
      search: search || undefined,
      limit,
    }),
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });

  const onDecision = (verb: string) => ({
    onSuccess: () => {
      toast.success(verb);
      void refetch();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const { mutate: approveUser, isPending: isApproving } = useMutation(
    api.users.approve.mutationOptions(onDecision('Approved — they can sign in now')),
  );
  const { mutate: rejectUser, isPending: isRejecting } = useMutation(
    api.users.reject.mutationOptions(onDecision('Rejected')),
  );
  const { mutate: deleteUser } = useMutation(
    api.users.delete.mutationOptions(onDecision('User deleted')),
  );

  const users: ListedUser[] = (data?.data ?? []).map((u) => ({
    ...u,
    customerType: u.customerType as UserToEdit['customerType'],
    role: u.role as UserToEdit['role'],
    approvalStatus: u.approvalStatus as UserToEdit['approvalStatus'],
  }));
  const totalCount = data?.meta.totalCount ?? 0;
  const counts = data?.meta.counts;
  const filtered = !!focus || statusFilter !== 'all' || !!search;

  const organisationOf = (user: ListedUser) => {
    if (user.organizations.length > 0) {
      return <span className="truncate">{user.organizations.map((o) => o.name).join(', ')}</span>;
    }
    if (user.role !== 'user') {
      return <span className="text-text-muted">Craft &amp; Culture</span>;
    }
    if (user.customerType === 'b2c') {
      return <span className="text-text-muted">—</span>;
    }
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
        Not linked
      </span>
    );
  };

  const decisionButtons = (user: ListedUser, full = false) => (
    <>
      {user.approvalStatus !== 'approved' && (
        <Button
          size="sm"
          colorRole="bold"
          className={full ? 'flex-1 justify-center' : ''}
          onClick={(e) => {
            e.stopPropagation();
            approveUser({ userId: user.id });
          }}
          isDisabled={isApproving}
        >
          <ButtonContent>Approve</ButtonContent>
        </Button>
      )}
      {user.approvalStatus === 'pending' && (
        <Button
          size="sm"
          variant="outline"
          className={full ? 'flex-1 justify-center' : ''}
          onClick={(e) => {
            e.stopPropagation();
            rejectUser({ userId: user.id });
          }}
          isDisabled={isRejecting}
        >
          <ButtonContent>Reject</ButtonContent>
        </Button>
      )}
      {user.isTestUser && (
        <Button
          size="sm"
          variant="outline"
          className={full ? 'flex-1 justify-center' : ''}
          onClick={(e) => {
            e.stopPropagation();
            setActivateUser({ id: user.id, name: user.name });
          }}
        >
          <ButtonContent iconLeft={IconUserCheck}>Activate</ButtonContent>
        </Button>
      )}
    </>
  );

  const rowMenu = (user: ListedUser) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More for ${user.name ?? user.email}`}
          onClick={(e) => e.stopPropagation()}
          className="flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-primary-hover hover:text-text-primary"
        >
          <IconDots className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => setEditingUser(user)}>
          <IconEdit className="size-4" /> Edit user
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/platform/admin/users/${user.id}`}>
            <IconChevronRight className="size-4" /> Open profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem colorRole="danger" onSelect={() => setDeletingUser({ id: user.id, name: user.name })}>
          <IconTrash className="size-4" /> Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const nameCell = (user: ListedUser) => (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="truncate font-medium text-text-primary">{user.name || 'Unnamed'}</span>
        {ROLE_PILL[user.role] && (
          <span className={`${chip} ${ROLE_PILL[user.role]?.className}`}>{ROLE_PILL[user.role]?.label}</span>
        )}
        {user.sharesEmail && (
          <span
            title="Another account uses this email in different capitals. Keep the one they sign in with and delete the other."
            className={`${chip} bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30`}
          >
            Duplicate email
          </span>
        )}
        {user.isTestUser && (
          <span className={`${chip} bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30`}>
            Test
          </span>
        )}
      </div>
      <p className="truncate text-xs text-text-muted">{user.isTestUser ? 'No email yet' : user.email}</p>
    </div>
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Users</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              Who can sign in, what they can see, and who they act for
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateDialogOpen(true)}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-text-primary px-4 text-sm font-semibold text-surface-primary shadow-sm transition hover:opacity-90"
          >
            <IconPlus className="size-4" />
            Add user
          </button>
        </div>

        <UsersStatTiles counts={counts} focus={focus} onFocus={setFocus} />

        {/* Search + status */}
        <div className="space-y-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              placeholder="Search by name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-xl border border-border-muted bg-surface-primary pl-9 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:border-text-muted focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex max-w-full gap-2 overflow-x-auto">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <button key={status} type="button" onClick={() => setStatusFilter(status)} className={pill(statusFilter === status)}>
                  {status === 'all' ? 'All' : status === 'pending' ? 'Awaiting approval' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-text-muted tabular-nums">
              {isLoading ? 'Loading…' : `${totalCount} ${totalCount === 1 ? 'user' : 'users'}`}
              {isFetching && !isLoading ? ' · updating' : ''}
            </span>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setFocus('');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary"
              >
                <IconX className="size-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="py-16 text-center text-sm text-text-muted">Loading users…</p>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-muted py-14 text-center">
            <p className="text-sm font-medium text-text-primary">
              {focus === 'pending' ? 'Nobody is waiting for approval' : focus === 'unlinked' ? 'Every account is linked' : 'No users match'}
            </p>
            {filtered && <p className="mt-1 text-xs text-text-muted">Clear the filters to see everyone.</p>}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-muted bg-surface-primary shadow-sm">
            {/* Desktop */}
            <table className="hidden w-full table-fixed text-sm md:table">
              <thead className="border-b border-border-muted bg-surface-muted/50 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="w-[30%] px-4 py-2.5">User</th>
                  <th className="w-[13%] px-4 py-2.5">Account</th>
                  <th className="w-[20%] px-4 py-2.5">Acts for</th>
                  <th className="w-[13%] px-4 py-2.5">Status</th>
                  <th className="w-[10%] px-4 py-2.5">Last sign-in</th>
                  <th className="w-[14%] px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {users.map((user) => {
                  const seen = formatLastSeen(user.lastLogin);
                  const status = STATUS_PILL[user.approvalStatus];
                  return (
                    <tr
                      key={user.id}
                      className="cursor-pointer transition-colors hover:bg-surface-muted/60"
                      onClick={() => router.push(`/platform/admin/users/${user.id}`)}
                    >
                      <td className="px-4 py-3">{nameCell(user)}</td>
                      <td className="px-4 py-3 text-text-secondary">{getCustomerTypeLabel(user.customerType)}</td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0">{organisationOf(user)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {status && <span className={`${chip} ${status.className}`}>{status.label}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span title={seen.title} className={seen.stale ? 'text-text-muted' : 'text-text-secondary'}>
                          {seen.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {decisionButtons(user)}
                          {rowMenu(user)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Phone */}
            <ul className="divide-y divide-border-muted md:hidden">
              {users.map((user) => {
                const seen = formatLastSeen(user.lastLogin);
                const status = STATUS_PILL[user.approvalStatus];
                const needsDecision = user.approvalStatus !== 'approved' || !!user.isTestUser;
                return (
                  <li key={user.id} className="space-y-2.5 p-4">
                    <div className="flex items-start gap-2">
                      <Link href={`/platform/admin/users/${user.id}`} className="min-w-0 flex-1">
                        {nameCell(user)}
                      </Link>
                      {rowMenu(user)}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <dt className="text-text-muted">Account</dt>
                      <dd className="text-text-secondary">{getCustomerTypeLabel(user.customerType)}</dd>
                      <dt className="text-text-muted">Acts for</dt>
                      <dd className="flex min-w-0">{organisationOf(user)}</dd>
                      <dt className="text-text-muted">Status</dt>
                      <dd>{status && <span className={`${chip} ${status.className}`}>{status.label}</span>}</dd>
                      <dt className="text-text-muted">Last sign-in</dt>
                      <dd className="text-text-secondary">{seen.label}</dd>
                    </dl>
                    {needsDecision && <div className="flex gap-2">{decisionButtons(user, true)}</div>}
                  </li>
                );
              })}
            </ul>

            {data?.meta.nextCursor !== undefined && (
              <div className="border-t border-border-muted p-3 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((n) => Math.min(n + PAGE, 200))}
                  disabled={isFetching}
                  className="h-9 rounded-lg border border-border-muted px-4 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                >
                  {isFetching ? 'Loading…' : `Show more (${users.length} of ${totalCount})`}
                </button>
              </div>
            )}
          </div>
        )}

        <UserEditDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
          onSuccess={() => void refetch()}
        />

        <UserCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => void refetch()}
        />

        <ActivateTestUserDialog
          user={activateUser}
          open={!!activateUser}
          onOpenChange={(open) => {
            if (!open) setActivateUser(null);
          }}
          onSuccess={() => void refetch()}
        />

        <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deletingUser?.name ?? 'this user'}?</AlertDialogTitle>
              <AlertDialogDescription>
                They will no longer be able to sign in. This cannot be undone. Records they created are kept and reassigned to you.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingUser && deleteUser({ userId: deletingUser.id })}
                className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              >
                Delete user
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default UserManagementPage;
