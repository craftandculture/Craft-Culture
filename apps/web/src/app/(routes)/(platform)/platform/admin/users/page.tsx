'use client';

import {
  IconCheck,
  IconEdit,
  IconEye,
  IconLogin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUserCheck,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogFooter from '@/app/_ui/components/Dialog/DialogFooter';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type CustomerTypeFilter = 'all' | 'b2b' | 'b2c' | 'private_clients';

interface UserToEdit {
  id: string;
  name: string | null;
  email: string;
  customerType: 'b2b' | 'b2c' | 'private_clients';
  role: 'user' | 'admin';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  isTestUser?: boolean;
}

/**
 * Dialog component for editing user details
 */
const UserEditDialog = ({
  user,
  open,
  onOpenChange,
  onSuccess,
}: {
  user: UserToEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) => {
  const api = useTRPC();
  const [name, setName] = useState(user?.name ?? '');
  const [newEmail, setNewEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [customerType, setCustomerType] = useState<'b2b' | 'b2c' | 'private_clients'>(
    user?.customerType ?? 'b2c',
  );
  const [role, setRole] = useState<'user' | 'admin'>(user?.role ?? 'user');
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>(
    user?.approvalStatus ?? 'pending',
  );

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setNewEmail('');
      setIsEditingEmail(false);
      setCustomerType(user.customerType);
      setRole(user.role);
      setApprovalStatus(user.approvalStatus);
    }
  }, [user]);

  const { mutate: updateUser, isPending } = useMutation(
    api.users.adminUpdate.mutationOptions({
      onSuccess: () => {
        toast.success('User updated successfully');
        onOpenChange(false);
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update user');
      },
    }),
  );

  const { mutate: changeEmail, isPending: isChangingEmail } = useMutation(
    api.users.adminChangeEmail.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        setNewEmail('');
        setIsEditingEmail(false);
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to change email');
      },
    }),
  );

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser({
      userId: user.id,
      name: name || undefined,
      customerType,
      role,
      approvalStatus,
    });
  };

  const handleEmailChange = () => {
    if (!newEmail.trim()) {
      toast.error('Please enter a new email address');
      return;
    }
    changeEmail({
      userId: user.id,
      newEmail: newEmail.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user details for {user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Section */}
          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              Email
            </Typography>
            {!isEditingEmail ? (
              <div className="flex items-center gap-2">
                <Input
                  value={user.email}
                  disabled
                  className="flex-1 bg-surface-muted"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingEmail(true)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingEmail(false);
                      setNewEmail('');
                    }}
                    isDisabled={isChangingEmail}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    colorRole="brand"
                    size="sm"
                    onClick={handleEmailChange}
                    isDisabled={isChangingEmail || !newEmail.trim()}
                  >
                    {isChangingEmail ? 'Updating...' : 'Update Email'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Typography variant="bodySm" className="font-medium">
              Name
            </Typography>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="User name"
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
                <SelectItem value="b2b">Distributor Staff</SelectItem>
                <SelectItem value="b2c">Sales Rep</SelectItem>
                <SelectItem value="private_clients">Partner Staff</SelectItem>
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
            <Button type="submit" colorRole="brand" isDisabled={isPending}>
              <ButtonContent>{isPending ? 'Saving...' : 'Save Changes'}</ButtonContent>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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
  const [role, setRole] = useState<'user' | 'admin'>('user');
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
                <SelectItem value="b2b">Distributor Staff</SelectItem>
                <SelectItem value="b2c">Sales Rep</SelectItem>
                <SelectItem value="private_clients">Partner Staff</SelectItem>
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
              colorRole="brand"
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
            <Button type="submit" colorRole="brand" isDisabled={isPending || !email.trim()}>
              <ButtonContent>{isPending ? 'Activating...' : 'Activate User'}</ButtonContent>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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

/**
 * Component to manage distributor assignment for a user
 */
const DistributorAssignment = ({
  userId,
  distributors,
}: {
  userId: string;
  distributors: { id: string; businessName: string; status: string }[];
}) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Fetch current membership
  const { data: membership, isLoading } = useQuery({
    ...api.users.getPartnerMembership.queryOptions({ userId }),
  });

  // Assign mutation
  const { mutate: assignPartner, isPending: isAssigning } = useMutation(
    api.users.assignPartner.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Assigned to ${data.partner.businessName}`);
        void queryClient.invalidateQueries({
          queryKey: api.users.getPartnerMembership.queryKey({ userId }),
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to assign distributor');
      },
    }),
  );

  // Remove mutation
  const { mutate: removePartner, isPending: isRemoving } = useMutation(
    api.users.removePartner.mutationOptions({
      onSuccess: () => {
        toast.success('Removed from distributor');
        void queryClient.invalidateQueries({
          queryKey: api.users.getPartnerMembership.queryKey({ userId }),
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to remove from distributor');
      },
    }),
  );

  if (isLoading) {
    return <span className="text-text-muted text-xs">Loading...</span>;
  }

  // Get distributor membership from the new structure
  const distributorMembership = membership?.distributor;

  const currentPartnerId =
    distributorMembership?.type === 'member'
      ? distributorMembership.membership.partnerId
      : distributorMembership?.type === 'owner'
        ? distributorMembership.partner.id
        : undefined;

  const currentPartnerName =
    distributorMembership?.type === 'member'
      ? distributorMembership.membership.partner.businessName
      : distributorMembership?.type === 'owner'
        ? distributorMembership.partner.businessName
        : undefined;

  return (
    <Select
      value={currentPartnerId ?? 'none'}
      onValueChange={(value) => {
        if (value === 'none') {
          removePartner({ userId, partnerType: 'distributor' });
        } else {
          assignPartner({ userId, partnerId: value });
        }
      }}
      disabled={isAssigning || isRemoving}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder="Not assigned">
          {currentPartnerName ?? 'Not assigned'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-text-muted">Not assigned</span>
        </SelectItem>
        {distributors.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.businessName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/**
 * Component to manage wine partner assignment for a user
 */
const WinePartnerAssignment = ({
  userId,
  winePartners,
}: {
  userId: string;
  winePartners: { id: string; businessName: string; status: string }[];
}) => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Fetch current membership
  const { data: membership, isLoading } = useQuery({
    ...api.users.getPartnerMembership.queryOptions({ userId }),
  });

  // Assign mutation
  const { mutate: assignPartner, isPending: isAssigning } = useMutation(
    api.users.assignPartner.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Assigned to ${data.partner.businessName}`);
        void queryClient.invalidateQueries({
          queryKey: api.users.getPartnerMembership.queryKey({ userId }),
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to assign wine partner');
      },
    }),
  );

  // Remove mutation
  const { mutate: removePartner, isPending: isRemoving } = useMutation(
    api.users.removePartner.mutationOptions({
      onSuccess: () => {
        toast.success('Removed from wine partner');
        void queryClient.invalidateQueries({
          queryKey: api.users.getPartnerMembership.queryKey({ userId }),
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to remove from wine partner');
      },
    }),
  );

  if (isLoading) {
    return <span className="text-text-muted text-xs">Loading...</span>;
  }

  // Get wine partner membership from the structure
  const winePartnerMembership = membership?.winePartner;

  const currentPartnerId =
    winePartnerMembership?.type === 'member'
      ? winePartnerMembership.membership.partnerId
      : winePartnerMembership?.type === 'owner'
        ? winePartnerMembership.partner.id
        : undefined;

  const currentPartnerName =
    winePartnerMembership?.type === 'member'
      ? winePartnerMembership.membership.partner.businessName
      : winePartnerMembership?.type === 'owner'
        ? winePartnerMembership.partner.businessName
        : undefined;

  return (
    <Select
      value={currentPartnerId ?? 'none'}
      onValueChange={(value) => {
        if (value === 'none') {
          removePartner({ userId, partnerType: 'wine_partner' });
        } else {
          assignPartner({ userId, partnerId: value });
        }
      }}
      disabled={isAssigning || isRemoving}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder="Not assigned">
          {currentPartnerName ?? 'Not assigned'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-text-muted">Not assigned</span>
        </SelectItem>
        {winePartners.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.businessName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const UserManagementPage = () => {
  const api = useTRPC();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [customerTypeFilter, setCustomerTypeFilter] =
    useState<CustomerTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserToEdit | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activateUser, setActivateUser] = useState<{
    id: string;
    name: string | null;
  } | null>(null);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);

  // Fetch users
  const { data, isLoading, refetch, isFetching } = useQuery({
    ...api.users.getPaginated.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      customerType: customerTypeFilter === 'all' ? undefined : customerTypeFilter,
      search: searchQuery || undefined,
      limit: 50,
    }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch distributors for assignment dropdown
  const { data: distributors } = useQuery({
    ...api.users.getDistributors.queryOptions(),
  });

  // Fetch wine partners for assignment dropdown
  const { data: winePartners } = useQuery({
    ...api.users.getWinePartners.queryOptions(),
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

  // Delete user mutation
  const { mutate: deleteUser, isPending: isDeleting } = useMutation(
    api.users.delete.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Impersonate user mutation
  const { mutate: impersonateUser, isPending: isImpersonating } = useMutation(
    api.users.impersonate.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Now viewing as ${data.targetUser.name || data.targetUser.email}`);
        // Use full page reload to pick up new session cookie
        globalThis.location.assign('/platform');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to impersonate user');
      },
    }),
  );

  const users = data?.data ?? [];
  const totalCount = data?.meta.totalCount ?? 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="bg-fill-warning/10 text-text-warning border border-border-warning inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="bg-fill-brand/10 text-text-brand border border-border-brand inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="bg-fill-muted text-text-muted border border-border-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getTestBadge = () => (
    <span className="bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
      Test
    </span>
  );

  const getCustomerTypeLabel = (type: string) => {
    switch (type) {
      case 'b2b':
        return 'Distributor Staff';
      case 'b2c':
        return 'Sales Rep';
      case 'private_clients':
        return 'Partner Staff';
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Typography variant="headingLg" className="mb-2">
                User Management
              </Typography>
              <Typography variant="bodyMd" colorRole="muted" className="mb-3">
                Review and approve user applications
              </Typography>
              <div className="flex flex-wrap gap-4 text-xs text-text-muted">
                <span>
                  <strong>Distributor Staff:</strong> Licensed Distributors employees
                </span>
                <span>
                  <strong>Partner Staff:</strong> Wine company employees
                </span>
                <span>
                  <strong>Sales Rep:</strong> B2C sales agents
                </span>
              </div>
            </div>
            <Button colorRole="brand" onClick={() => setCreateDialogOpen(true)}>
              <ButtonContent iconLeft={IconPlus}>Create User</ButtonContent>
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card>
          <CardContent className="space-y-4 p-6">
            {/* Status Tabs */}
            <div>
              <Typography variant="bodyXs" className="text-text-muted mb-2">
                Approval Status
              </Typography>
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
            </div>

            {/* Customer Type Tabs */}
            <div>
              <Typography variant="bodyXs" className="text-text-muted mb-2">
                Customer Type
              </Typography>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: 'all', label: 'All Types' },
                    { value: 'b2b', label: 'Distributor Staff' },
                    { value: 'b2c', label: 'Sales Rep' },
                    { value: 'private_clients', label: 'Partner Staff' },
                  ] as const
                ).map((type) => (
                  <Button
                    key={type.value}
                    variant={customerTypeFilter === type.value ? 'default' : 'outline'}
                    colorRole={customerTypeFilter === type.value ? 'brand' : 'primary'}
                    size="sm"
                    onClick={() => setCustomerTypeFilter(type.value)}
                  >
                    <ButtonContent>{type.label}</ButtonContent>
                  </Button>
                ))}
              </div>
            </div>

            {/* Search with Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={() => refetch()}
                disabled={isFetching}
                className="shrink-0"
              >
                <IconRefresh className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
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
                        Distributor
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Partner
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Signup Date
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="text-text-secondary px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border-muted divide-y">
                    {users.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-surface-muted cursor-pointer"
                        onClick={() => router.push(`/platform/admin/users/${user.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/platform/admin/users/${user.id}`}
                                className="font-medium hover:text-text-brand hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {user.name}
                              </Link>
                              {user.isTestUser && getTestBadge()}
                            </div>
                            <Typography variant="bodyXs" className="text-text-muted">
                              {user.isTestUser ? 'No email assigned' : user.email}
                            </Typography>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm">
                            {getCustomerTypeLabel(user.customerType)}
                          </Typography>
                        </td>
                        <td className="px-6 py-4">
                          <DistributorAssignment
                            userId={user.id}
                            distributors={distributors ?? []}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <WinePartnerAssignment
                            userId={user.id}
                            winePartners={winePartners ?? []}
                          />
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(user.approvalStatus)}</td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm" className="text-text-secondary">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </Typography>
                        </td>
                        <td className="px-6 py-4">
                          <Typography variant="bodySm" className="text-text-secondary">
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleDateString()
                              : 'Never'}
                          </Typography>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {user.approvalStatus === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  colorRole="brand"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    approveUser({ userId: user.id });
                                  }}
                                  isDisabled={isApproving}
                                >
                                  <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    rejectUser({ userId: user.id });
                                  }}
                                  isDisabled={isRejecting}
                                >
                                  <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                                </Button>
                              </>
                            )}
                            {user.approvalStatus === 'rejected' && (
                              <Button
                                size="sm"
                                variant="default"
                                colorRole="brand"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approveUser({ userId: user.id });
                                }}
                                isDisabled={isApproving}
                              >
                                <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                              </Button>
                            )}
                            {user.isTestUser && (
                              <Button
                                size="sm"
                                variant="default"
                                colorRole="brand"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivateUser({ id: user.id, name: user.name });
                                  setActivateDialogOpen(true);
                                }}
                              >
                                <ButtonContent iconLeft={IconUserCheck}>Activate</ButtonContent>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/platform/admin/users/${user.id}`);
                              }}
                            >
                              <ButtonContent iconLeft={IconEye}>View</ButtonContent>
                            </Button>
                            {!user.isTestUser && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  impersonateUser({ userId: user.id });
                                }}
                                isDisabled={isImpersonating}
                              >
                                <ButtonContent iconLeft={IconLogin}>Login as</ButtonContent>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingUser({
                                  id: user.id,
                                  name: user.name,
                                  email: user.email,
                                  customerType: user.customerType as 'b2b' | 'b2c' | 'private_clients',
                                  role: user.role as 'user' | 'admin',
                                  approvalStatus: user.approvalStatus as 'pending' | 'approved' | 'rejected',
                                });
                                setEditDialogOpen(true);
                              }}
                            >
                              <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  colorRole="danger"
                                  isDisabled={isDeleting}
                                  onClick={(e) => e.stopPropagation()}
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
                        <div className="flex items-center gap-2">
                          <Typography variant="bodySm" className="font-medium">
                            {user.name}
                          </Typography>
                          {user.isTestUser && getTestBadge()}
                        </div>
                        <Typography variant="bodyXs" className="text-text-muted">
                          {user.isTestUser ? 'No email assigned' : user.email}
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
                      <Typography variant="bodyXs" className="text-text-muted">
                        Last login:{' '}
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : 'Never'}
                      </Typography>
                    </div>

                    <div className="space-y-2">
                      {user.isTestUser && (
                        <Button
                          size="sm"
                          variant="default"
                          colorRole="brand"
                          onClick={() => {
                            setActivateUser({ id: user.id, name: user.name });
                            setActivateDialogOpen(true);
                          }}
                          className="w-full"
                        >
                          <ButtonContent iconLeft={IconUserCheck}>Activate</ButtonContent>
                        </Button>
                      )}
                      {user.approvalStatus === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            colorRole="brand"
                            onClick={() => approveUser({ userId: user.id })}
                            isDisabled={isApproving}
                            className="flex-1"
                          >
                            <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectUser({ userId: user.id })}
                            isDisabled={isRejecting}
                            className="flex-1"
                          >
                            <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
                          </Button>
                        </div>
                      )}
                      {user.approvalStatus === 'rejected' && (
                        <Button
                          size="sm"
                          variant="default"
                          colorRole="brand"
                          onClick={() => approveUser({ userId: user.id })}
                          isDisabled={isApproving}
                          className="w-full"
                        >
                          <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
                        </Button>
                      )}
                      {!user.isTestUser && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => impersonateUser({ userId: user.id })}
                          isDisabled={isImpersonating}
                          className="w-full"
                        >
                          <ButtonContent iconLeft={IconLogin}>Login as User</ButtonContent>
                        </Button>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setEditingUser({
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              customerType: user.customerType as 'b2b' | 'b2c' | 'private_clients',
                              role: user.role as 'user' | 'admin',
                              approvalStatus: user.approvalStatus as 'pending' | 'approved' | 'rejected',
                            });
                            setEditDialogOpen(true);
                          }}
                        >
                          <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              colorRole="danger"
                              isDisabled={isDeleting}
                              className="flex-1"
                            >
                              <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Edit Dialog */}
        <UserEditDialog
          user={editingUser}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingUser(null);
          }}
          onSuccess={() => {
            void refetch();
          }}
        />

        {/* User Create Dialog */}
        <UserCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            void refetch();
          }}
        />

        {/* Activate Test User Dialog */}
        <ActivateTestUserDialog
          user={activateUser}
          open={activateDialogOpen}
          onOpenChange={(open) => {
            setActivateDialogOpen(open);
            if (!open) setActivateUser(null);
          }}
          onSuccess={() => {
            void refetch();
          }}
        />
      </div>
    </div>
  );
};

export default UserManagementPage;
