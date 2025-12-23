'use client';

import {
  IconCopy,
  IconCreditCard,
  IconExternalLink,
  IconKey,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
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

type PartnerType = 'retailer' | 'sommelier' | 'distributor';
type PartnerStatus = 'active' | 'inactive' | 'suspended';

/**
 * Admin page for managing retail partners and API keys
 */
const PartnersPage = () => {
  const api = useTRPC();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state for creating partner
  const [newPartner, setNewPartner] = useState({
    userId: '',
    type: 'retailer' as PartnerType,
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    businessAddress: '',
    commissionRate: 0,
  });

  // Form state for creating API key
  const [newApiKey, setNewApiKey] = useState({
    name: '',
    permissions: ['read:inventory'] as string[],
  });

  // Payment config dialog state
  const [isPaymentConfigOpen, setIsPaymentConfigOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<{
    id: string;
    businessName: string;
    logoUrl: string;
    paymentMethod: 'bank_transfer' | 'link' | null;
    paymentDetails: {
      bankName?: string;
      accountName?: string;
      accountNumber?: string;
      sortCode?: string;
      iban?: string;
      swiftBic?: string;
      reference?: string;
      paymentUrl?: string;
    } | null;
  } | null>(null);

  // Fetch partners
  const { data, isLoading, refetch } = useQuery({
    ...api.partners.getMany.queryOptions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchQuery || undefined,
    }),
  });

  // Fetch users for dropdown (only approved users without partner accounts)
  const { data: usersData } = useQuery({
    ...api.users.getPaginated.queryOptions({
      status: 'approved',
      limit: 100,
    }),
  });

  // Create partner mutation
  const { mutate: createPartner, isPending: isCreating } = useMutation(
    api.partners.create.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsCreateDialogOpen(false);
        setNewPartner({
          userId: '',
          type: 'retailer',
          businessName: '',
          businessEmail: '',
          businessPhone: '',
          businessAddress: '',
          commissionRate: 0,
        });
      },
    }),
  );

  // Create API key mutation
  const { mutate: createApiKey, isPending: isCreatingKey } = useMutation(
    api.partners.apiKeys.create.mutationOptions({
      onSuccess: (data) => {
        setGeneratedApiKey(data.key);
        void refetch();
      },
    }),
  );

  // Revoke API key mutation
  const { mutate: revokeApiKey, isPending: isRevoking } = useMutation(
    api.partners.apiKeys.revoke.mutationOptions({
      onSuccess: () => {
        void refetch();
      },
    }),
  );

  // Update partner mutation
  const { mutate: updatePartner, isPending: isUpdating } = useMutation(
    api.partners.update.mutationOptions({
      onSuccess: () => {
        void refetch();
        setIsPaymentConfigOpen(false);
        setEditingPartner(null);
      },
    }),
  );

  const partners = data ?? [];
  const users = usersData?.data ?? [];

  // Filter out users who already have partner accounts
  const availableUsers = users.filter(
    (user) => !partners.some((p) => p.userId === user.id),
  );

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

  const getTypeBadge = (type: PartnerType) => {
    const labels = {
      retailer: 'Retailer',
      sommelier: 'Sommelier',
      distributor: 'Distributor',
    };
    return (
      <span className="bg-fill-muted text-text-secondary inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
        {labels[type]}
      </span>
    );
  };

  const handleCopyApiKey = () => {
    if (generatedApiKey) {
      void navigator.clipboard.writeText(generatedApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateApiKey = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setGeneratedApiKey(null);
    setNewApiKey({ name: '', permissions: ['read:inventory'] });
    setIsApiKeyDialogOpen(true);
  };

  const handleOpenPaymentConfig = (partner: typeof partners[0]) => {
    setEditingPartner({
      id: partner.id,
      businessName: partner.businessName,
      logoUrl: partner.logoUrl || '',
      paymentMethod: partner.paymentMethod,
      paymentDetails: partner.paymentDetails,
    });
    setIsPaymentConfigOpen(true);
  };

  const handleSavePaymentConfig = () => {
    if (!editingPartner) return;
    updatePartner({
      partnerId: editingPartner.id,
      logoUrl: editingPartner.logoUrl || undefined,
      paymentMethod: editingPartner.paymentMethod || undefined,
      paymentDetails: editingPartner.paymentDetails || undefined,
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Typography variant="headingLg" className="mb-2">
              Partner Management
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Manage retail partners and their API access
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/docs/api" target="_blank">
              <Button variant="outline">
                <ButtonContent iconRight={IconExternalLink}>API Docs</ButtonContent>
              </Button>
            </Link>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" colorRole="brand">
                  <ButtonContent iconLeft={IconPlus}>Add Partner</ButtonContent>
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Partner</DialogTitle>
                <DialogDescription>
                  Link a user account to a partner profile for API access
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createPartner(newPartner);
                }}
                className="space-y-4 mt-4"
              >
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    User Account
                  </label>
                  <select
                    value={newPartner.userId}
                    onChange={(e) =>
                      setNewPartner({ ...newPartner, userId: e.target.value })
                    }
                    className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Partner Type
                  </label>
                  <select
                    value={newPartner.type}
                    onChange={(e) =>
                      setNewPartner({
                        ...newPartner,
                        type: e.target.value as PartnerType,
                      })
                    }
                    className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                  >
                    <option value="retailer">Retailer</option>
                    <option value="sommelier">Sommelier</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Business Name
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
                    Business Email
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
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={newPartner.commissionRate}
                    onChange={(e) =>
                      setNewPartner({
                        ...newPartner,
                        commissionRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
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
                    <ButtonContent>{isCreating ? 'Creating...' : 'Create Partner'}</ButtonContent>
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
                placeholder="Search by business name..."
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
            <CardContent className="p-6">
              <Typography variant="bodyMd" className="text-text-muted text-center">
                No partners found. Click &quot;Add Partner&quot; to create one.
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Typography variant="headingSm">{partner.businessName}</Typography>
                        {getTypeBadge(partner.type)}
                        {getStatusBadge(partner.status)}
                      </div>
                      <Typography variant="bodySm" colorRole="muted">
                        {partner.user.name} &middot; {partner.user.email}
                      </Typography>
                      {partner.businessEmail && (
                        <Typography variant="bodyXs" colorRole="muted">
                          Business: {partner.businessEmail}
                        </Typography>
                      )}
                      <Typography variant="bodyXs" colorRole="muted">
                        Commission: {partner.commissionRate}%
                      </Typography>
                      {/* Payment Config Status */}
                      {partner.paymentMethod && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-fill-brand/10 text-text-brand border border-border-brand inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                            {partner.paymentMethod === 'bank_transfer' ? '🏦 Bank Transfer' : '🔗 Payment Link'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions Section */}
                    <div className="flex-shrink-0 space-y-3">
                      {/* Payment Config Button */}
                      <Button
                        size="sm"
                        variant={partner.paymentMethod ? 'outline' : 'default'}
                        colorRole={partner.paymentMethod ? 'primary' : 'brand'}
                        onClick={() => handleOpenPaymentConfig(partner)}
                        className="w-full"
                      >
                        <ButtonContent iconLeft={IconCreditCard}>
                          {partner.paymentMethod ? 'Edit Payment Config' : 'Configure Payment'}
                        </ButtonContent>
                      </Button>

                    {/* API Keys Section */}
                    <div className="flex-shrink-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Typography variant="bodySm" className="font-medium">
                          API Keys ({partner.apiKeyCount})
                        </Typography>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateApiKey(partner.id)}
                        >
                          <ButtonContent iconLeft={IconKey}>Generate Key</ButtonContent>
                        </Button>
                      </div>

                      {partner.apiKeys && partner.apiKeys.length > 0 && (
                        <div className="space-y-1">
                          {partner.apiKeys.map((key) => (
                            <div
                              key={key.id}
                              className="flex items-center justify-between gap-4 rounded-lg bg-fill-muted/50 px-3 py-2 text-sm"
                            >
                              <div>
                                <span className="font-mono text-xs">{key.keyPrefix}...</span>
                                <span className="text-text-muted ml-2">{key.name}</span>
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    colorRole="danger"
                                    isDisabled={isRevoking}
                                  >
                                    <ButtonContent iconLeft={IconTrash} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to revoke this API key? Any integrations
                                      using this key will immediately stop working.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => revokeApiKey({ apiKeyId: key.id })}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Revoke Key
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Payment Config Dialog */}
        <Dialog open={isPaymentConfigOpen} onOpenChange={setIsPaymentConfigOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Payment Configuration</DialogTitle>
              <DialogDescription>
                Configure payment details for {editingPartner?.businessName}
              </DialogDescription>
            </DialogHeader>

            {editingPartner && (
              <div className="space-y-6 mt-4">
                {/* Logo URL */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    <div className="flex items-center gap-2">
                      <IconPhoto className="h-4 w-4" />
                      Partner Logo URL
                    </div>
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
                    <div className="mt-2 p-2 bg-fill-muted rounded-lg">
                      <img
                        src={editingPartner.logoUrl}
                        alt="Partner logo preview"
                        className="max-h-16 object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Payment Method
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editingPartner.paymentMethod === 'bank_transfer' ? 'default' : 'outline'}
                      colorRole={editingPartner.paymentMethod === 'bank_transfer' ? 'brand' : 'primary'}
                      onClick={() =>
                        setEditingPartner({
                          ...editingPartner,
                          paymentMethod: 'bank_transfer',
                          paymentDetails: editingPartner.paymentDetails || {},
                        })
                      }
                    >
                      <ButtonContent>🏦 Bank Transfer</ButtonContent>
                    </Button>
                    <Button
                      type="button"
                      variant={editingPartner.paymentMethod === 'link' ? 'default' : 'outline'}
                      colorRole={editingPartner.paymentMethod === 'link' ? 'brand' : 'primary'}
                      onClick={() =>
                        setEditingPartner({
                          ...editingPartner,
                          paymentMethod: 'link',
                          paymentDetails: editingPartner.paymentDetails || {},
                        })
                      }
                    >
                      <ButtonContent>🔗 Payment Link</ButtonContent>
                    </Button>
                  </div>
                </div>

                {/* Bank Transfer Details */}
                {editingPartner.paymentMethod === 'bank_transfer' && (
                  <div className="space-y-3 p-4 bg-fill-muted/50 rounded-lg">
                    <Typography variant="bodySm" className="font-semibold">Bank Account Details</Typography>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.bankName || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: { ...editingPartner.paymentDetails, bankName: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Account Name</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.accountName || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: { ...editingPartner.paymentDetails, accountName: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Account Number</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.accountNumber || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: { ...editingPartner.paymentDetails, accountNumber: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Sort Code</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.sortCode || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: { ...editingPartner.paymentDetails, sortCode: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">IBAN</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.iban || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: { ...editingPartner.paymentDetails, iban: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">SWIFT/BIC</label>
                        <input
                          type="text"
                          value={editingPartner.paymentDetails?.swiftBic || ''}
                          onChange={(e) =>
                            setEditingPartner({
                              ...editingPartner,
                              paymentDetails: { ...editingPartner.paymentDetails, swiftBic: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Reference (optional template)</label>
                      <input
                        type="text"
                        value={editingPartner.paymentDetails?.reference || ''}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            paymentDetails: { ...editingPartner.paymentDetails, reference: e.target.value },
                          })
                        }
                        placeholder="e.g., CC-{QUOTE_ID}"
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Payment Link */}
                {editingPartner.paymentMethod === 'link' && (
                  <div className="space-y-3 p-4 bg-fill-muted/50 rounded-lg">
                    <Typography variant="bodySm" className="font-semibold">Payment Link</Typography>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Payment URL</label>
                      <input
                        type="url"
                        value={editingPartner.paymentDetails?.paymentUrl || ''}
                        onChange={(e) =>
                          setEditingPartner({
                            ...editingPartner,
                            paymentDetails: { ...editingPartner.paymentDetails, paymentUrl: e.target.value },
                          })
                        }
                        placeholder="https://pay.partner.com/..."
                        className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-border-muted">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPaymentConfigOpen(false)}
                  >
                    <ButtonContent>Cancel</ButtonContent>
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    colorRole="brand"
                    onClick={handleSavePaymentConfig}
                    isDisabled={isUpdating || !editingPartner.paymentMethod}
                  >
                    <ButtonContent>{isUpdating ? 'Saving...' : 'Save Configuration'}</ButtonContent>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Generate API Key Dialog */}
        <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {generatedApiKey ? 'API Key Generated' : 'Generate API Key'}
              </DialogTitle>
              <DialogDescription>
                {generatedApiKey
                  ? 'Copy this key now. You won\'t be able to see it again!'
                  : 'Create a new API key for this partner'}
              </DialogDescription>
            </DialogHeader>

            {generatedApiKey ? (
              <div className="space-y-4 mt-4">
                <div className="rounded-lg bg-fill-muted p-4">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-mono break-all">{generatedApiKey}</code>
                    <Button size="sm" variant="outline" onClick={handleCopyApiKey}>
                      <ButtonContent iconLeft={IconCopy}>
                        {copied ? 'Copied!' : 'Copy'}
                      </ButtonContent>
                    </Button>
                  </div>
                </div>
                <div className="bg-fill-warning/10 border border-border-warning rounded-lg p-3">
                  <Typography variant="bodySm" className="text-text-warning">
                    Save this key securely. It will only be shown once.
                  </Typography>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    colorRole="brand"
                    onClick={() => {
                      setIsApiKeyDialogOpen(false);
                      setGeneratedApiKey(null);
                    }}
                  >
                    <ButtonContent>Done</ButtonContent>
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedPartnerId) {
                    createApiKey({
                      partnerId: selectedPartnerId,
                      name: newApiKey.name,
                      permissions: newApiKey.permissions,
                    });
                  }
                }}
                className="space-y-4 mt-4"
              >
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                    placeholder="e.g., POS Integration"
                    className="w-full rounded-lg border border-border-primary bg-background-primary px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newApiKey.permissions.includes('read:inventory')}
                        onChange={(e) => {
                          const perms = e.target.checked
                            ? [...newApiKey.permissions, 'read:inventory']
                            : newApiKey.permissions.filter((p) => p !== 'read:inventory');
                          setNewApiKey({ ...newApiKey, permissions: perms });
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">read:inventory - Access product catalog</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsApiKeyDialogOpen(false)}
                  >
                    <ButtonContent>Cancel</ButtonContent>
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    colorRole="brand"
                    isDisabled={isCreatingKey}
                  >
                    <ButtonContent iconLeft={IconKey}>
                      {isCreatingKey ? 'Generating...' : 'Generate Key'}
                    </ButtonContent>
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PartnersPage;
