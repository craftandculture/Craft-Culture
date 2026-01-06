'use client';

import {
  IconArrowLeft,
  IconBuilding,
  IconBuildingBank,
  IconCheck,
  IconClock,
  IconDevices,
  IconEdit,
  IconLoader2,
  IconLogin,
  IconMail,
  IconMapPin,
  IconPhone,
  IconTrash,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import Icon from '@/app/_ui/components/Icon/Icon';
import Input from '@/app/_ui/components/Input/Input';
import Select from '@/app/_ui/components/Select/Select';
import SelectContent from '@/app/_ui/components/Select/SelectContent';
import SelectItem from '@/app/_ui/components/Select/SelectItem';
import SelectTrigger from '@/app/_ui/components/Select/SelectTrigger';
import SelectValue from '@/app/_ui/components/Select/SelectValue';
import Tabs from '@/app/_ui/components/Tabs/Tabs';
import TabsContent from '@/app/_ui/components/Tabs/TabsContent';
import TabsList from '@/app/_ui/components/Tabs/TabsList';
import TabsTrigger from '@/app/_ui/components/Tabs/TabsTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import authBrowserClient from '@/lib/better-auth/browser';
import useTRPC from '@/lib/trpc/browser';

import customerTypeOptions, { getCustomerTypeLabel } from '../constants/customerTypeOptions';

interface UserDetailViewProps {
  userId: string;
}

/**
 * User Detail View Component
 *
 * Displays comprehensive user information with editing capabilities.
 */
const UserDetailView = ({ userId }: UserDetailViewProps) => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Form states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [editedName, setEditedName] = useState('');
  const [editedCustomerType, setEditedCustomerType] = useState<'b2b' | 'b2c' | 'private_clients'>('b2c');
  const [editedRole, setEditedRole] = useState<'user' | 'admin'>('user');

  // Fetch user data
  const { data, isLoading, error } = useQuery({
    ...api.users.adminGetOne.queryOptions({ userId }),
  });

  // Mutations
  const { mutate: updateUser, isPending: isUpdating } = useMutation(
    api.users.adminUpdate.mutationOptions({
      onSuccess: () => {
        toast.success('User updated successfully');
        setIsEditingProfile(false);
        void queryClient.invalidateQueries({
          queryKey: api.users.adminGetOne.queryKey({ userId }),
        });
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to update user');
      },
    }),
  );

  const { mutate: changeEmail, isPending: isChangingEmail } = useMutation(
    api.users.adminChangeEmail.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        setIsEditingEmail(false);
        setNewEmail('');
        void queryClient.invalidateQueries({
          queryKey: api.users.adminGetOne.queryKey({ userId }),
        });
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to change email');
      },
    }),
  );

  const { mutate: approveUser, isPending: isApproving } = useMutation(
    api.users.approve.mutationOptions({
      onSuccess: () => {
        toast.success('User approved');
        void queryClient.invalidateQueries({
          queryKey: api.users.adminGetOne.queryKey({ userId }),
        });
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to approve user');
      },
    }),
  );

  const { mutate: rejectUser, isPending: isRejecting } = useMutation(
    api.users.reject.mutationOptions({
      onSuccess: () => {
        toast.success('User rejected');
        void queryClient.invalidateQueries({
          queryKey: api.users.adminGetOne.queryKey({ userId }),
        });
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to reject user');
      },
    }),
  );

  const { mutate: deleteUser, isPending: isDeleting } = useMutation(
    api.users.delete.mutationOptions({
      onSuccess: () => {
        toast.success('User deleted');
        router.push('/platform/admin/users');
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete user');
      },
    }),
  );

  // Impersonation - call Better Auth client directly (not through tRPC)
  // This ensures the session cookie is properly set in the browser
  const [isImpersonating, setIsImpersonating] = useState(false);

  const handleImpersonate = async (targetUserId: string, targetUserName: string | null, targetUserEmail: string) => {
    setIsImpersonating(true);
    try {
      const result = await authBrowserClient.admin.impersonateUser({
        userId: targetUserId,
      });

      if (result.error) {
        toast.error(result.error.message || 'Failed to impersonate user');
        return;
      }

      toast.success(`Now viewing as ${targetUserName || targetUserEmail}`);
      // Use full page reload to pick up new session cookie
      globalThis.location.assign('/platform');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to impersonate user');
    } finally {
      setIsImpersonating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon icon={IconLoader2} size="lg" className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Typography variant="bodyMd" colorRole="danger">
            {error?.message || 'User not found'}
          </Typography>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/platform/admin/users">Back to Users</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { user, partners, recentActivity, activeSessions } = data;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
          Admin
        </span>
      );
    }
    return null;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStartEdit = () => {
    setEditedName(user.name || '');
    setEditedCustomerType(user.customerType as 'b2b' | 'b2c' | 'private_clients');
    setEditedRole(user.role as 'user' | 'admin');
    setIsEditingProfile(true);
  };

  const handleSaveProfile = () => {
    updateUser({
      userId: user.id,
      name: editedName || undefined,
      customerType: editedCustomerType,
      role: editedRole,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/platform/admin/users">
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Typography variant="headingLg">{user.name || 'Unnamed User'}</Typography>
              {getStatusBadge(user.approvalStatus)}
              {getRoleBadge(user.role)}
            </div>
            <Typography variant="bodySm" colorRole="muted">
              {user.email}
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user.approvalStatus === 'pending' && (
            <>
              <Button
                size="sm"
                colorRole="brand"
                onClick={() => approveUser({ userId: user.id })}
                isDisabled={isApproving}
              >
                <ButtonContent iconLeft={IconCheck}>Approve</ButtonContent>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectUser({ userId: user.id })}
                isDisabled={isRejecting}
              >
                <ButtonContent iconLeft={IconX}>Reject</ButtonContent>
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleImpersonate(user.id, user.name, user.email)}
            isDisabled={isImpersonating}
          >
            <ButtonContent iconLeft={IconLogin}>Login as User</ButtonContent>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" colorRole="danger">
                <ButtonContent iconLeft={IconTrash}>Delete</ButtonContent>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {user.name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteUser({ userId: user.id })}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeleting}
                >
                  Delete User
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <Icon icon={IconUser} size="sm" className="mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="partners">
            <Icon icon={IconUsers} size="sm" className="mr-2" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="company">
            <Icon icon={IconBuilding} size="sm" className="mr-2" />
            Company
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Icon icon={IconClock} size="sm" className="mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Info Card */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <Typography variant="headingSm">Basic Information</Typography>
                  {!isEditingProfile ? (
                    <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                      <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingProfile(false)}
                        isDisabled={isUpdating}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        colorRole="brand"
                        size="sm"
                        onClick={handleSaveProfile}
                        isDisabled={isUpdating}
                      >
                        {isUpdating ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Email */}
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Email
                    </Typography>
                    {!isEditingEmail ? (
                      <div className="flex items-center gap-2">
                        <Input value={user.email} disabled className="bg-surface-muted" />
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
                          placeholder="Enter new email"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
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
                            variant="default"
                            colorRole="brand"
                            size="sm"
                            onClick={() => changeEmail({ userId: user.id, newEmail })}
                            isDisabled={isChangingEmail || !newEmail.trim()}
                          >
                            {isChangingEmail ? 'Updating...' : 'Update Email'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Name
                    </Typography>
                    {isEditingProfile ? (
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="User name"
                      />
                    ) : (
                      <Typography variant="bodySm">{user.name || '-'}</Typography>
                    )}
                  </div>

                  {/* Customer Type */}
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Customer Type
                    </Typography>
                    {isEditingProfile ? (
                      <Select
                        value={editedCustomerType}
                        onValueChange={(v) => setEditedCustomerType(v as typeof editedCustomerType)}
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
                    ) : (
                      <Typography variant="bodySm">
                        {getCustomerTypeLabel(user.customerType)}
                      </Typography>
                    )}
                  </div>

                  {/* Role */}
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Role
                    </Typography>
                    {isEditingProfile ? (
                      <Select
                        value={editedRole}
                        onValueChange={(v) => setEditedRole(v as typeof editedRole)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Typography variant="bodySm" className="capitalize">
                        {user.role}
                      </Typography>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Phone
                    </Typography>
                    <Typography variant="bodySm">{user.phone || '-'}</Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Status & Dates
                </Typography>

                <div className="space-y-4">
                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Approval Status
                    </Typography>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(user.approvalStatus)}
                      {user.approvedBy && (
                        <Typography variant="bodyXs" colorRole="muted">
                          by {user.approvedBy.name}
                        </Typography>
                      )}
                    </div>
                  </div>

                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Email Verified
                    </Typography>
                    <Typography variant="bodySm">
                      {user.emailVerified ? 'Yes' : 'No'}
                    </Typography>
                  </div>

                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Created
                    </Typography>
                    <Typography variant="bodySm">{formatDate(user.createdAt)}</Typography>
                  </div>

                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Approved At
                    </Typography>
                    <Typography variant="bodySm">{formatDate(user.approvedAt)}</Typography>
                  </div>

                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Onboarding Completed
                    </Typography>
                    <Typography variant="bodySm">
                      {formatDate(user.onboardingCompletedAt)}
                    </Typography>
                  </div>

                  <div>
                    <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                      Terms Accepted
                    </Typography>
                    <Typography variant="bodySm">{formatDate(user.termsAcceptedAt)}</Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Card */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Icon icon={IconMapPin} size="sm" colorRole="muted" />
                  <Typography variant="headingSm">Address</Typography>
                </div>

                <div className="space-y-2">
                  {user.addressLine1 || user.city || user.country ? (
                    <>
                      {user.addressLine1 && (
                        <Typography variant="bodySm">{user.addressLine1}</Typography>
                      )}
                      {user.addressLine2 && (
                        <Typography variant="bodySm">{user.addressLine2}</Typography>
                      )}
                      <Typography variant="bodySm">
                        {[user.city, user.stateProvince, user.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </Typography>
                      {user.country && (
                        <Typography variant="bodySm">{user.country}</Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="bodySm" colorRole="muted">
                      No address provided
                    </Typography>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {partners.owned && (
              <Card>
                <CardContent className="p-6">
                  <Typography variant="headingSm" className="mb-4">
                    Owned Partner
                  </Typography>
                  <div className="space-y-2">
                    <Typography variant="bodySm" className="font-medium">
                      {partners.owned.businessName}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="capitalize">
                      {partners.owned.type.replace('_', ' ')}
                    </Typography>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Distributor
                </Typography>
                {partners.distributor ? (
                  <div className="space-y-2">
                    <Typography variant="bodySm" className="font-medium">
                      {partners.distributor.name}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="capitalize">
                      Role: {partners.distributor.role}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Joined: {formatDate(partners.distributor.joinedAt)}
                    </Typography>
                  </div>
                ) : (
                  <Typography variant="bodySm" colorRole="muted">
                    Not assigned to any distributor
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Wine Partner
                </Typography>
                {partners.winePartner ? (
                  <div className="space-y-2">
                    <Typography variant="bodySm" className="font-medium">
                      {partners.winePartner.name}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="capitalize">
                      Role: {partners.winePartner.role}
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted">
                      Joined: {formatDate(partners.winePartner.joinedAt)}
                    </Typography>
                  </div>
                ) : (
                  <Typography variant="bodySm" colorRole="muted">
                    Not assigned to any wine partner
                  </Typography>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company" className="mt-6">
          <div className="grid gap-6">
            {/* Company Information Card */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Company Information
                </Typography>

                {user.companyName ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          Company Name
                        </Typography>
                        <Typography variant="bodySm">{user.companyName}</Typography>
                      </div>

                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          VAT Number
                        </Typography>
                        <Typography variant="bodySm">{user.companyVatNumber || '-'}</Typography>
                      </div>

                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          Website
                        </Typography>
                        <Typography variant="bodySm">{user.companyWebsite || '-'}</Typography>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          <Icon icon={IconMail} size="xs" className="mr-1 inline" />
                          Company Email
                        </Typography>
                        <Typography variant="bodySm">{user.companyEmail || '-'}</Typography>
                      </div>

                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          <Icon icon={IconPhone} size="xs" className="mr-1 inline" />
                          Company Phone
                        </Typography>
                        <Typography variant="bodySm">{user.companyPhone || '-'}</Typography>
                      </div>

                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          <Icon icon={IconMapPin} size="xs" className="mr-1 inline" />
                          Company Address
                        </Typography>
                        <Typography variant="bodySm">{user.companyAddress || '-'}</Typography>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Typography variant="bodySm" colorRole="muted">
                    No company information provided
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Bank Details Card */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Icon icon={IconBuildingBank} size="sm" colorRole="muted" />
                  <Typography variant="headingSm">Bank Details</Typography>
                </div>

                {user.bankDetails &&
                typeof user.bankDetails === 'object' &&
                Object.keys(user.bankDetails).length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          Bank Name
                        </Typography>
                        <Typography variant="bodySm">
                          {(user.bankDetails as Record<string, string>).bankName || '-'}
                        </Typography>
                      </div>

                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          Account Holder
                        </Typography>
                        <Typography variant="bodySm">
                          {(user.bankDetails as Record<string, string>).accountHolder || '-'}
                        </Typography>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          IBAN
                        </Typography>
                        <Typography variant="bodySm">
                          {(user.bankDetails as Record<string, string>).iban || '-'}
                        </Typography>
                      </div>

                      <div>
                        <Typography variant="bodyXs" colorRole="muted" className="mb-1">
                          SWIFT/BIC
                        </Typography>
                        <Typography variant="bodySm">
                          {(user.bankDetails as Record<string, string>).swiftBic || '-'}
                        </Typography>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Typography variant="bodySm" colorRole="muted">
                    No bank details provided
                  </Typography>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Activity */}
            <Card>
              <CardContent className="p-6">
                <Typography variant="headingSm" className="mb-4">
                  Recent Activity
                </Typography>

                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 border-b border-border-muted pb-3 last:border-0"
                      >
                        <div className="flex-1">
                          <Typography variant="bodySm" className="font-medium">
                            {activity.action.replace('.', ': ').replace('_', ' ')}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            by {activity.adminName || 'System'}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            {formatDate(activity.createdAt)}
                          </Typography>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Typography variant="bodySm" colorRole="muted">
                    No recent activity
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Icon icon={IconDevices} size="sm" colorRole="muted" />
                  <Typography variant="headingSm">Active Sessions</Typography>
                </div>

                {activeSessions.length > 0 ? (
                  <div className="space-y-3">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="border-b border-border-muted pb-3 last:border-0"
                      >
                        <Typography variant="bodyXs" className="font-medium">
                          {session.userAgent?.split('(')[0] || 'Unknown device'}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          IP: {session.ipAddress || 'Unknown'}
                        </Typography>
                        <Typography variant="bodyXs" colorRole="muted">
                          Created: {formatDate(session.createdAt)}
                        </Typography>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Typography variant="bodySm" colorRole="muted">
                    No active sessions
                  </Typography>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserDetailView;
