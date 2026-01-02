'use client';

import {
  IconBottle,
  IconBuilding,
  IconCalculator,
  IconEdit,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
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
import Dialog from '@/app/_ui/components/Dialog/Dialog';
import DialogContent from '@/app/_ui/components/Dialog/DialogContent';
import DialogDescription from '@/app/_ui/components/Dialog/DialogDescription';
import DialogHeader from '@/app/_ui/components/Dialog/DialogHeader';
import DialogTitle from '@/app/_ui/components/Dialog/DialogTitle';
import DialogTrigger from '@/app/_ui/components/Dialog/DialogTrigger';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

type PartnerStatus = 'active' | 'inactive' | 'suspended';

/**
 * Admin page for managing wine partners (wine companies)
 *
 * Wine partners are companies that source stock and bring clients.
 * They create quotes and private client orders.
 */
const WinePartnersPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Form state for creating partner
  const [newPartner, setNewPartner] = useState({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
    taxId: '',
    logoUrl: '',
  });

  // Edit partner dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<{
    id: string;
    businessName: string;
    businessAddress: string;
    businessPhone: string;
    businessEmail: string;
    taxId: string;
    logoUrl: string;
    // PCO pricing settings
    logisticsCostPerCase: number;
    pcoDutyRate: number;
    pcoVatRate: number;
  } | null>(null);

  // Fetch wine partners only
  const { data, isLoading, refetch } = useQuery({
    ...api.partners.getMany.queryOptions({
      type: 'wine_partner',
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
    }),
  });

  // Create partner mutation
  const { mutate: createPartner, isPending: isCreating } = useMutation(
    api.partners.create.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsCreateDialogOpen(false);
        setNewPartner({
          businessName: '',
          businessAddress: '',
          businessPhone: '',
          businessEmail: '',
          taxId: '',
          logoUrl: '',
        });
      },
    }),
  );

  // Update partner mutation
  const { mutate: updatePartner, isPending: isUpdating } = useMutation(
    api.partners.update.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsEditDialogOpen(false);
        setEditingPartner(null);
      },
    }),
  );

  // Delete partner mutation
  const { mutate: deletePartner, isPending: isDeletingPartner } = useMutation(
    api.partners.delete.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  const partners = data ?? [];

  const getStatusBadge = (status: PartnerStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="bg-fill-brand/10 text-text-brand border border-border-brand inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="bg-fill-muted text-text-muted border border-border-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Inactive
          </span>
        );
      case 'suspended':
        return (
          <span className="bg-fill-warning/10 text-text-warning border border-border-warning inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Suspended
          </span>
        );
    }
  };

  const handleEditPartner = (partner: (typeof partners)[0]) => {
    setEditingPartner({
      id: partner.id,
      businessName: partner.businessName,
      businessAddress: partner.businessAddress || '',
      businessPhone: partner.businessPhone || '',
      businessEmail: partner.businessEmail || '',
      taxId: partner.taxId || '',
      logoUrl: partner.logoUrl || '',
      // PCO pricing settings with defaults
      logisticsCostPerCase: partner.logisticsCostPerCase ?? 60,
      pcoDutyRate: partner.pcoDutyRate ?? 0.05,
      pcoVatRate: partner.pcoVatRate ?? 0.05,
    });
    setIsEditDialogOpen(true);
  };

  const handleSavePartner = () => {
    if (!editingPartner) return;

    updatePartner({
      partnerId: editingPartner.id,
      businessName: editingPartner.businessName,
      businessAddress: editingPartner.businessAddress || undefined,
      businessPhone: editingPartner.businessPhone || undefined,
      businessEmail: editingPartner.businessEmail || undefined,
      taxId: editingPartner.taxId || undefined,
      logoUrl: editingPartner.logoUrl || undefined,
      // PCO pricing settings
      logisticsCostPerCase: editingPartner.logisticsCostPerCase,
      pcoDutyRate: editingPartner.pcoDutyRate,
      pcoVatRate: editingPartner.pcoVatRate,
    });
  };

  const handleCreatePartner = () => {
    createPartner({
      type: 'wine_partner',
      businessName: newPartner.businessName,
      businessAddress: newPartner.businessAddress,
      businessPhone: newPartner.businessPhone || undefined,
      businessEmail: newPartner.businessEmail || undefined,
      taxId: newPartner.taxId,
      logoUrl: newPartner.logoUrl || undefined,
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Typography variant="headingLg" className="mb-2">
              Partners (Wine Companies)
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Manage wine companies that source stock and bring clients
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" colorRole="brand">
                  <ButtonContent iconLeft={IconPlus}>Add Partner</ButtonContent>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Wine Partner</DialogTitle>
                  <DialogDescription>
                    Add a wine company that will source stock and bring clients
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreatePartner();
                  }}
                  className="space-y-6 mt-4"
                >
                  {/* Business Details Section */}
                  <div className="space-y-4">
                    <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                      <IconBuilding className="h-4 w-4" />
                      Company Details
                    </Typography>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Company Name *
                        </label>
                        <input
                          type="text"
                          value={newPartner.businessName}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessName: e.target.value })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          TRN / Tax ID
                        </label>
                        <input
                          type="text"
                          value={newPartner.taxId}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, taxId: e.target.value })
                          }
                          placeholder="e.g., 100123456789003"
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Business Address
                        </label>
                        <textarea
                          value={newPartner.businessAddress}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessAddress: e.target.value })
                          }
                          rows={2}
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={newPartner.businessEmail}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessEmail: e.target.value })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={newPartner.businessPhone}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, businessPhone: e.target.value })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Branding Section */}
                  <div className="space-y-4 border-t border-border-muted pt-4">
                    <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                      <IconPhoto className="h-4 w-4" />
                      Branding
                    </Typography>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Logo URL
                      </label>
                      <input
                        type="url"
                        value={newPartner.logoUrl}
                        onChange={(e) =>
                          setNewPartner({ ...newPartner, logoUrl: e.target.value })
                        }
                        placeholder="https://example.com/logo.png"
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                      {newPartner.logoUrl && (
                        <div className="mt-2 p-2 bg-fill-muted rounded-lg inline-block">
                          <img
                            src={newPartner.logoUrl}
                            alt="Logo preview"
                            className="max-h-12 object-contain"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-border-muted">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      <ButtonContent>Cancel</ButtonContent>
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      colorRole="brand"
                      isDisabled={isCreating}
                    >
                      <ButtonContent>
                        {isCreating ? 'Creating...' : 'Add Partner'}
                      </ButtonContent>
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'inactive', 'suspended'] as const).map((status) => (
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

            <div className="relative">
              <IconSearch className="text-text-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by company name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-background-primary border-border-primary text-text-primary placeholder:text-text-muted w-full rounded-lg border px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Typography variant="bodySm" className="text-text-muted">
              {isLoading ? 'Loading...' : `${partners.length} partners found`}
            </Typography>
          </CardContent>
        </Card>

        {/* Partners List */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                Loading partners...
              </Typography>
            </CardContent>
          </Card>
        ) : partners.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <IconBottle className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <Typography variant="bodyMd" className="text-text-muted">
                No wine partners found. Click &quot;Add Partner&quot; to create one.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {partners.map((partner) => (
              <Card key={partner.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Partner Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        {partner.logoUrl ? (
                          <img
                            src={partner.logoUrl}
                            alt={partner.businessName}
                            className="h-10 w-10 object-contain rounded"
                          />
                        ) : (
                          <div className="h-10 w-10 bg-fill-muted rounded flex items-center justify-center">
                            <IconBottle className="h-5 w-5 text-text-muted" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <Typography variant="headingSm">{partner.businessName}</Typography>
                            {getStatusBadge(partner.status)}
                          </div>
                          {partner.taxId && (
                            <Typography variant="bodyXs" colorRole="muted" className="flex items-center gap-1">
                              <IconReceipt className="h-3 w-3" />
                              TRN: {partner.taxId}
                            </Typography>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        {partner.businessAddress && (
                          <div className="flex items-start gap-1.5 text-text-muted">
                            <IconMapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span className="text-xs">{partner.businessAddress}</span>
                          </div>
                        )}
                        {partner.businessEmail && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <IconMail className="h-3.5 w-3.5" />
                            <span className="text-xs">{partner.businessEmail}</span>
                          </div>
                        )}
                        {partner.businessPhone && (
                          <div className="flex items-center gap-1.5 text-text-muted">
                            <IconPhone className="h-3.5 w-3.5" />
                            <span className="text-xs">{partner.businessPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Section */}
                    <div className="flex-shrink-0 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditPartner(partner)}
                      >
                        <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            colorRole="danger"
                            isDisabled={isDeletingPartner}
                            title="Delete Partner"
                          >
                            <ButtonContent iconLeft={IconTrash} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Partner</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete{' '}
                              <strong>{partner.businessName}</strong>? This will remove all
                              associated user memberships.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePartner({ partnerId: partner.id })}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete Partner
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Partner Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Partner</DialogTitle>
              <DialogDescription>Update wine partner details</DialogDescription>
            </DialogHeader>

            {editingPartner && (
              <div className="space-y-6 mt-4">
                {/* Company Details */}
                <div className="space-y-4">
                  <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                    <IconBuilding className="h-4 w-4" />
                    Company Details
                  </Typography>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={editingPartner.businessName}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessName: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        TRN / Tax ID
                      </label>
                      <input
                        type="text"
                        value={editingPartner.taxId}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, taxId: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Business Address
                      </label>
                      <textarea
                        value={editingPartner.businessAddress}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessAddress: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editingPartner.businessEmail}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessEmail: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={editingPartner.businessPhone}
                        onChange={(e) =>
                          setEditingPartner({ ...editingPartner, businessPhone: e.target.value })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Branding */}
                <div className="space-y-4 border-t border-border-muted pt-4">
                  <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                    <IconPhoto className="h-4 w-4" />
                    Branding
                  </Typography>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={editingPartner.logoUrl}
                      onChange={(e) =>
                        setEditingPartner({ ...editingPartner, logoUrl: e.target.value })
                      }
                      placeholder="https://example.com/logo.png"
                      className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                    />
                    {editingPartner.logoUrl && (
                      <div className="mt-2 p-2 bg-fill-muted rounded-lg inline-block">
                        <img
                          src={editingPartner.logoUrl}
                          alt="Logo preview"
                          className="max-h-12 object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Private Client Order Pricing */}
                <div className="space-y-4 border-t border-border-muted pt-4">
                  <Typography variant="bodySm" className="font-semibold flex items-center gap-2">
                    <IconCalculator className="h-4 w-4" />
                    Private Client Order Pricing
                  </Typography>

                  <Typography variant="bodyXs" colorRole="muted">
                    Configure how duty, VAT, and logistics costs are calculated for this
                    partner&apos;s private client orders
                  </Typography>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Duty Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={(editingPartner.pcoDutyRate * 100).toFixed(1)}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            pcoDutyRate: parseFloat(e.target.value) / 100 || 0,
                          })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        Default: 5%
                      </Typography>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        VAT Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={(editingPartner.pcoVatRate * 100).toFixed(1)}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            pcoVatRate: parseFloat(e.target.value) / 100 || 0,
                          })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        Default: 5%
                      </Typography>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">
                        Logistics ($/case)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editingPartner.logisticsCostPerCase}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            logisticsCostPerCase: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                      <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                        Default: $60/case
                      </Typography>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border-muted">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    <ButtonContent>Cancel</ButtonContent>
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    colorRole="brand"
                    onClick={handleSavePartner}
                    isDisabled={isUpdating}
                  >
                    <ButtonContent>{isUpdating ? 'Saving...' : 'Save Changes'}</ButtonContent>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default WinePartnersPage;
