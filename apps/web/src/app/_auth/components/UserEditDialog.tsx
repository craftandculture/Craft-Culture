'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import customerTypeOptions from '@/app/_auth/constants/customerTypeOptions';
import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
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

type CustomerType = 'b2b' | 'b2c' | 'private_clients';
type Role = 'user' | 'admin' | 'wms_operator';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserToEdit {
  id: string;
  name: string | null;
  email: string;
  customerType: CustomerType;
  role: Role;
  approvalStatus: ApprovalStatus;
  organizations: { id: string; name: string; type: string }[];
}

const NONE = 'none';

/**
 * The organisation slot a customer type fills, if any
 *
 * A distributor login acts for a distributor; a partner account acts for a
 * wine partner or a collector. A sales rep acts for nobody.
 */
const slotFor = (customerType: CustomerType) =>
  customerType === 'b2b'
    ? ('distributor' as const)
    : customerType === 'private_clients'
      ? ('wine_partner' as const)
      : null;

/**
 * Edit a user's details, access and the organisation they act for
 *
 * The organisation used to be a dropdown on every row of the list that
 * saved the moment it changed, so a stray tap relinked a partner's login to
 * somebody else's stock. It now lives here and is saved with everything
 * else, only when Save is pressed.
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
  const [name, setName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [customerType, setCustomerType] = useState<CustomerType>('b2c');
  const [role, setRole] = useState<Role>('user');
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('pending');
  const [organizationId, setOrganizationId] = useState<string>(NONE);
  const [isSaving, setIsSaving] = useState(false);

  const { data: me } = useQuery(api.users.getMe.queryOptions());
  const { data: distributors } = useQuery({
    ...api.users.getDistributors.queryOptions(),
    enabled: open,
  });
  const { data: winePartners } = useQuery({
    ...api.users.getWinePartners.queryOptions(),
    enabled: open,
  });

  // Your own role and status are locked; another admin has to change them
  const isSelf = !!user && me?.id === user.id;
  const slot = slotFor(customerType);
  const options = slot === 'distributor' ? (distributors ?? []) : (winePartners ?? []);

  const currentFor = (u: UserToEdit, s: ReturnType<typeof slotFor>) => {
    if (!s) return NONE;
    const match = u.organizations.find((o) =>
      s === 'distributor' ? o.type === 'distributor' : o.type !== 'distributor',
    );
    return match?.id ?? NONE;
  };

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setNewEmail('');
      setIsEditingEmail(false);
      setCustomerType(user.customerType);
      setRole(user.role);
      setApprovalStatus(user.approvalStatus);
      setOrganizationId(currentFor(user, slotFor(user.customerType)));
    }
  }, [user]);

  const { mutateAsync: updateUser } = useMutation(api.users.adminUpdate.mutationOptions());
  const { mutateAsync: assignPartner } = useMutation(api.users.assignPartner.mutationOptions());
  const { mutateAsync: removePartner } = useMutation(api.users.removePartner.mutationOptions());

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUser({
        userId: user.id,
        name: name || undefined,
        customerType,
        role,
        approvalStatus,
      });

      const before = currentFor(user, slot);
      if (slot && organizationId !== before) {
        if (organizationId === NONE) {
          await removePartner({ userId: user.id, partnerType: slot });
        } else {
          await assignPartner({ userId: user.id, partnerId: organizationId });
        }
      }

      toast.success('User saved');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailChange = () => {
    if (!newEmail.trim()) {
      toast.error('Enter the new email address');
      return;
    }
    changeEmail({ userId: user.id, newEmail: newEmail.trim() });
  };

  const field = 'space-y-1.5';
  const label = 'text-xs font-medium text-text-secondary';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user.name ?? user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={field}>
            <p className={label}>Email</p>
            {!isEditingEmail ? (
              <div className="flex items-center gap-2">
                <Input value={user.email} disabled className="flex-1 bg-surface-muted" />
                <Button type="button" variant="outline" size="md" onClick={() => setIsEditingEmail(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email address"
                  autoFocus
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
                    colorRole="bold"
                    size="sm"
                    onClick={handleEmailChange}
                    isDisabled={isChangingEmail || !newEmail.trim()}
                  >
                    {isChangingEmail ? 'Updating…' : 'Update email'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className={field}>
            <p className={label}>Name</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={field}>
              <p className={label}>Account type</p>
              <Select
                value={customerType}
                onValueChange={(v) => {
                  const next = v as CustomerType;
                  setCustomerType(next);
                  setOrganizationId(currentFor(user, slotFor(next)));
                }}
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

            <div className={field}>
              <p className={label}>Access</p>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isSelf}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Standard</SelectItem>
                  <SelectItem value="admin">C&amp;C admin</SelectItem>
                  <SelectItem value="wms_operator">Warehouse operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {slot && (
            <div className={field}>
              <p className={label}>
                {slot === 'distributor' ? 'Distributor they work for' : 'Partner or collector they act for'}
              </p>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Not linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="text-text-muted">Not linked</span>
                  </SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.businessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {organizationId === NONE && role === 'user' && (
                <Typography variant="bodyXs" className="text-amber-700 dark:text-amber-400">
                  Without a link this login signs in to an empty account.
                </Typography>
              )}
            </div>
          )}

          <div className={field}>
            <p className={label}>Approval</p>
            <Select
              value={approvalStatus}
              onValueChange={(v) => setApprovalStatus(v as ApprovalStatus)}
              disabled={isSelf}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Awaiting approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && (
              <Typography variant="bodyXs" colorRole="muted">
                Ask another admin to change your own access or approval.
              </Typography>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} isDisabled={isSaving}>
              <ButtonContent>Cancel</ButtonContent>
            </Button>
            <Button type="submit" colorRole="bold" isDisabled={isSaving}>
              <ButtonContent>{isSaving ? 'Saving…' : 'Save'}</ButtonContent>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserEditDialog;
