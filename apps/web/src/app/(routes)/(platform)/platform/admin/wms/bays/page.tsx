'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconForklift,
  IconLayoutGrid,
  IconLoader2,
  IconPackages,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import ZebraPrint from '@/app/_wms/components/ZebraPrint';
import type { CompactTotemData } from '@/app/_wms/utils/generateCompactTotemZpl';
import { generateBatchCompactTotemsZpl } from '@/app/_wms/utils/generateCompactTotemZpl';
import useTRPC from '@/lib/trpc/browser';

/**
 * Bay Configuration Page - manage warehouse bay layout and print labels on-the-fly
 */
const BayConfigurationPage = () => {
  const api = useTRPC();
  const queryClient = useQueryClient();

  // UI state
  const [selectedBays, setSelectedBays] = useState<Set<string>>(new Set());
  const [showAddBay, setShowAddBay] = useState(false);
  const [isPrintingToZebra, setIsPrintingToZebra] = useState(false);
  const [zebraConnected, setZebraConnected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Edit bay state
  const [editingBay, setEditingBay] = useState<{ aisle: string; bay: string } | null>(null);
  const [editStorageMethod, setEditStorageMethod] = useState<'shelf' | 'pallet' | 'mixed'>('shelf');
  const [editForkliftFrom, setEditForkliftFrom] = useState('01');

  // Add bay form state
  const [newAisle, setNewAisle] = useState('');
  const [newBay, setNewBay] = useState('');
  const [newLevels, setNewLevels] = useState('00,01,02,03');
  const [newStorageMethod, setNewStorageMethod] = useState<'shelf' | 'pallet'>('shelf');
  const [forkliftFromLevel, setForkliftFromLevel] = useState('01');

  // Print function from ZebraPrint component
  const printFnRef = useRef<((zpl: string) => Promise<boolean>) | null>(null);

  const handlePrintReady = useCallback((printFn: (zpl: string) => Promise<boolean>) => {
    printFnRef.current = printFn;
  }, []);

  // Detect mobile device
  useEffect(() => {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    setIsMobile(mobile);
  }, []);

  // Get bay totems data
  const { data: bayTotemsData, isLoading } = useQuery({
    ...api.wms.admin.labels.getBayTotems.queryOptions({}),
  });

  // Get bay details when editing
  const { data: bayDetails, isLoading: bayDetailsLoading } = useQuery({
    ...api.wms.admin.locations.getBayDetails.queryOptions({
      aisle: editingBay?.aisle || '',
      bay: editingBay?.bay || '',
    }),
    enabled: !!editingBay,
  });

  // Update edit form when bay details load
  useEffect(() => {
    if (bayDetails) {
      setEditStorageMethod((bayDetails.settings.storageMethod as 'shelf' | 'pallet' | 'mixed') || 'shelf');
      setEditForkliftFrom(bayDetails.settings.forkliftFromLevel || '01');
    }
  }, [bayDetails]);

  // Group bays by aisle for display
  const baysByAisle = useMemo(() => {
    if (!bayTotemsData) return new Map<string, typeof bayTotemsData.totems>();

    const grouped = new Map<string, typeof bayTotemsData.totems>();
    for (const totem of bayTotemsData.totems) {
      const aisleGroup = grouped.get(totem.aisle) || [];
      aisleGroup.push(totem);
      grouped.set(totem.aisle, aisleGroup);
    }
    return grouped;
  }, [bayTotemsData]);

  // Get list of aisles
  const aisles = useMemo(() => {
    return Array.from(baysByAisle.keys()).sort();
  }, [baysByAisle]);

  // Mutations
  const addBayMutation = useMutation({
    ...api.wms.admin.locations.addBay.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Created ${result.created} locations for bay ${newAisle}-${newBay}`);
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.labels.getBayTotems.queryKey({}),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.locations.getMany.queryKey({}),
      });
      setShowAddBay(false);
      setNewAisle('');
      setNewBay('');

      // Auto-select the new bay for printing
      setSelectedBays(new Set([`${newAisle.toUpperCase()}-${newBay}`]));
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add bay');
    },
  });

  const deleteBayMutation = useMutation({
    ...api.wms.admin.locations.deleteBay.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Deleted bay ${result.aisle}-${result.bay} (${result.deleted} locations)`);
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.labels.getBayTotems.queryKey({}),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.locations.getMany.queryKey({}),
      });
      setConfirmDelete(null);
      setSelectedBays((prev) => {
        const newSet = new Set(prev);
        newSet.delete(`${result.aisle}-${result.bay}`);
        return newSet;
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete bay');
      setConfirmDelete(null);
    },
  });

  const updateBayMutation = useMutation({
    ...api.wms.admin.locations.updateBay.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Updated bay ${result.aisle}-${result.bay}`);
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.labels.getBayTotems.queryKey({}),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.locations.getMany.queryKey({}),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.locations.getBayDetails.queryKey({
          aisle: result.aisle,
          bay: result.bay,
        }),
      });
      setEditingBay(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update bay');
    },
  });

  const handleAddBay = () => {
    if (!newAisle.trim() || !newBay.trim()) {
      toast.error('Please enter aisle and bay');
      return;
    }

    const levels = newLevels
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l);
    if (levels.length === 0) {
      toast.error('Please enter at least one level');
      return;
    }

    addBayMutation.mutate({
      aisle: newAisle.trim().toUpperCase(),
      bay: newBay.trim(),
      levels,
      forkliftFromLevel: forkliftFromLevel || undefined,
    });
  };

  const handleDeleteBay = (aisle: string, bay: string) => {
    deleteBayMutation.mutate({ aisle, bay });
  };

  const handleUpdateBay = () => {
    if (!editingBay) return;

    updateBayMutation.mutate({
      aisle: editingBay.aisle,
      bay: editingBay.bay,
      storageMethod: editStorageMethod,
      forkliftFromLevel: editForkliftFrom,
    });
  };

  const toggleBay = (bayKey: string) => {
    setSelectedBays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bayKey)) {
        newSet.delete(bayKey);
      } else {
        newSet.add(bayKey);
      }
      return newSet;
    });
  };

  const selectAllInAisle = (aisle: string) => {
    const bays = baysByAisle.get(aisle) || [];
    const bayKeys = bays.map((b) => `${b.aisle}-${b.bay}`);
    const allSelected = bayKeys.every((k) => selectedBays.has(k));

    setSelectedBays((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        bayKeys.forEach((k) => newSet.delete(k));
      } else {
        bayKeys.forEach((k) => newSet.add(k));
      }
      return newSet;
    });
  };

  const handlePrintToZebra = async () => {
    if (selectedBays.size === 0 || !bayTotemsData) return;

    setIsPrintingToZebra(true);

    try {
      const selectedTotems = bayTotemsData.totems.filter((totem) =>
        selectedBays.has(`${totem.aisle}-${totem.bay}`),
      );

      const compactData: CompactTotemData[] = selectedTotems.map((totem, index) => ({
        aisle: totem.aisle,
        bay: totem.bay,
        levels: totem.levels.map((level) => ({
          level: level.level,
          barcode: level.barcode,
          requiresForklift: level.requiresForklift,
        })),
        arrowDirection: index % 2 === 0 ? 'right' : 'left',
      }));

      const zpl = generateBatchCompactTotemsZpl(compactData);

      if (zpl) {
        if (isMobile) {
          try {
            const blob = new Blob([zpl], { type: 'application/vnd.zebra.zpl' });
            const fileUrl = URL.createObjectURL(blob);
            const newWindow = window.open(fileUrl, '_blank');

            if (!newWindow) {
              const link = document.createElement('a');
              link.href = fileUrl;
              link.download = 'bay-labels.zpl';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.info('File downloaded. Open with Printer Setup Utility.');
            }

            setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
            toast.success(`Printed ${selectedBays.size} bay label(s)`);
            setSelectedBays(new Set());
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Print failed';
            toast.error(`Error: ${message}`);
          }
        } else if (printFnRef.current) {
          const success = await printFnRef.current(zpl);
          if (success) {
            toast.success(`Printed ${selectedBays.size} bay label(s)`);
            setSelectedBays(new Set());
          }
        }
      }
    } finally {
      setIsPrintingToZebra(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/platform/admin/wms"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fill-secondary text-text-muted transition-colors hover:bg-fill-primary hover:text-text-primary active:bg-fill-secondary"
            >
              <IconArrowLeft className="h-6 w-6" />
            </Link>
            <div className="min-w-0 flex-1">
              <Typography variant="headingLg" className="mb-1">
                Bay Configuration
              </Typography>
              <Typography variant="bodySm" colorRole="muted">
                Manage racking layout and print labels
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ZebraPrint onConnectionChange={setZebraConnected} onPrintReady={handlePrintReady} />

            {selectedBays.size > 0 && (
              <Button
                variant="default"
                onClick={handlePrintToZebra}
                disabled={(!zebraConnected && !isMobile) || isPrintingToZebra}
              >
                <ButtonContent iconLeft={isPrintingToZebra ? IconLoader2 : IconPrinter}>
                  {isPrintingToZebra ? 'Printing...' : `Print (${selectedBays.size})`}
                </ButtonContent>
              </Button>
            )}

            <Button variant="outline" onClick={() => setShowAddBay(!showAddBay)}>
              <ButtonContent iconLeft={showAddBay ? IconX : IconPlus}>
                {showAddBay ? 'Cancel' : 'Add Bay'}
              </ButtonContent>
            </Button>
          </div>
        </div>

        {/* Add Bay Form */}
        {showAddBay && (
          <Card>
            <div className="p-4 pb-3">
              <CardTitle>Add New Bay</CardTitle>
            </div>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Aisle</label>
                  <input
                    type="text"
                    value={newAisle}
                    onChange={(e) => setNewAisle(e.target.value.toUpperCase())}
                    placeholder="A"
                    maxLength={3}
                    className="w-full rounded-lg border border-border-primary bg-fill-secondary px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Bay Number</label>
                  <input
                    type="text"
                    value={newBay}
                    onChange={(e) => setNewBay(e.target.value)}
                    placeholder="05"
                    maxLength={3}
                    className="w-full rounded-lg border border-border-primary bg-fill-secondary px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Levels (comma-separated)</label>
                <input
                  type="text"
                  value={newLevels}
                  onChange={(e) => setNewLevels(e.target.value)}
                  placeholder="00,01,02,03"
                  className="w-full rounded-lg border border-border-primary bg-fill-secondary px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <p className="mt-1 text-xs text-text-muted">00 = ground level (no forklift)</p>
              </div>

              {/* Storage Method */}
              <div>
                <label className="mb-2 block text-sm font-medium">Storage Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewStorageMethod('shelf')}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                      newStorageMethod === 'shelf'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-border-primary hover:border-blue-300'
                    }`}
                  >
                    <Icon icon={IconBox} size="md" className={newStorageMethod === 'shelf' ? 'text-blue-600' : 'text-text-muted'} />
                    <span className={newStorageMethod === 'shelf' ? 'font-medium text-blue-600' : ''}>Shelf</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStorageMethod('pallet')}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                      newStorageMethod === 'pallet'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-border-primary hover:border-purple-300'
                    }`}
                  >
                    <Icon icon={IconPackages} size="md" className={newStorageMethod === 'pallet' ? 'text-purple-600' : 'text-text-muted'} />
                    <span className={newStorageMethod === 'pallet' ? 'font-medium text-purple-600' : ''}>Pallet</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Forklift Required From Level</label>
                <input
                  type="text"
                  value={forkliftFromLevel}
                  onChange={(e) => setForkliftFromLevel(e.target.value)}
                  placeholder="01"
                  maxLength={2}
                  className="w-full rounded-lg border border-border-primary bg-fill-secondary px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <p className="mt-1 text-xs text-text-muted">Levels at or above this require forklift</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowAddBay(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddBay} disabled={addBayMutation.isPending}>
                  <ButtonContent iconLeft={addBayMutation.isPending ? IconLoader2 : IconPlus}>
                    {addBayMutation.isPending ? 'Adding...' : 'Add Bay'}
                  </ButtonContent>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Bay Panel */}
        {editingBay && (
          <Card className="border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20">
            <div className="flex items-center justify-between border-b border-blue-200 p-4 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <Typography variant="headingMd">
                  Edit Bay {editingBay.aisle}-{editingBay.bay}
                </Typography>
              </div>
              <button
                onClick={() => setEditingBay(null)}
                className="rounded-lg p-2 text-text-muted hover:bg-fill-secondary hover:text-text-primary"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <CardContent className="space-y-4 p-4">
              {bayDetailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" />
                </div>
              ) : (
                <>
                  {/* Levels display */}
                  <div>
                    <Typography variant="labelMd" className="mb-2">
                      Levels ({bayDetails?.locations.length || 0})
                    </Typography>
                    <div className="flex flex-wrap gap-2">
                      {bayDetails?.locations.map((loc) => (
                        <div
                          key={loc.id}
                          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${
                            loc.requiresForklift
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-fill-secondary text-text-primary'
                          }`}
                        >
                          <span className="font-mono font-medium">{loc.level}</span>
                          {loc.requiresForklift && <IconForklift className="h-3.5 w-3.5" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Storage Method */}
                  <div>
                    <Typography variant="labelMd" className="mb-2">
                      Storage Method
                    </Typography>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditStorageMethod('shelf')}
                        className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                          editStorageMethod === 'shelf'
                            ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                            : 'border-border-primary bg-fill-primary hover:border-blue-300'
                        }`}
                      >
                        <Icon icon={IconBox} size="md" className={editStorageMethod === 'shelf' ? 'text-blue-600' : 'text-text-muted'} />
                        <span className={editStorageMethod === 'shelf' ? 'font-medium text-blue-700 dark:text-blue-300' : ''}>Shelf</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditStorageMethod('pallet')}
                        className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                          editStorageMethod === 'pallet'
                            ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/50'
                            : 'border-border-primary bg-fill-primary hover:border-purple-300'
                        }`}
                      >
                        <Icon icon={IconPackages} size="md" className={editStorageMethod === 'pallet' ? 'text-purple-600' : 'text-text-muted'} />
                        <span className={editStorageMethod === 'pallet' ? 'font-medium text-purple-700 dark:text-purple-300' : ''}>Pallet</span>
                      </button>
                    </div>
                  </div>

                  {/* Forklift From Level */}
                  <div>
                    <Typography variant="labelMd" className="mb-2">
                      Forklift Required From Level
                    </Typography>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={editForkliftFrom}
                        onChange={(e) => setEditForkliftFrom(e.target.value)}
                        placeholder="01"
                        maxLength={2}
                        className="w-20 rounded-lg border border-border-primary bg-fill-primary px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                      <Typography variant="bodySm" colorRole="muted">
                        Level {editForkliftFrom} and above require forklift
                      </Typography>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => setEditingBay(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateBay} disabled={updateBayMutation.isPending}>
                      <ButtonContent iconLeft={updateBayMutation.isPending ? IconLoader2 : IconCheck}>
                        {updateBayMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </ButtonContent>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{aisles.length}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Aisles
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{bayTotemsData?.totalTotems || 0}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Bays
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{selectedBays.size}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Selected
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Bays by Aisle */}
        {aisles.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Icon icon={IconLayoutGrid} size="xl" colorRole="muted" className="mx-auto mb-4" />
              <Typography variant="headingSm" className="mb-2">
                No Bays Found
              </Typography>
              <Typography variant="bodySm" colorRole="muted" className="mb-4">
                Create your first bay to get started
              </Typography>
              <Button onClick={() => setShowAddBay(true)}>
                <ButtonContent iconLeft={IconPlus}>Add Bay</ButtonContent>
              </Button>
            </CardContent>
          </Card>
        ) : (
          aisles.map((aisle) => {
            const bays = baysByAisle.get(aisle) || [];
            const bayKeys = bays.map((b) => `${b.aisle}-${b.bay}`);
            const allSelected = bayKeys.every((k) => selectedBays.has(k));
            const someSelected = bayKeys.some((k) => selectedBays.has(k));

            return (
              <Card key={aisle}>
                <div className="flex items-center justify-between border-b border-border-primary p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => selectAllInAisle(aisle)}
                      className={`flex h-6 w-6 items-center justify-center rounded border-2 transition-colors ${
                        allSelected
                          ? 'border-brand-primary bg-brand-primary text-white'
                          : someSelected
                            ? 'border-brand-primary bg-brand-primary/20'
                            : 'border-border-primary hover:border-brand-primary'
                      }`}
                    >
                      {allSelected && <IconCheck className="h-4 w-4" />}
                    </button>
                    <Typography variant="headingMd">Aisle {aisle}</Typography>
                    <Typography variant="bodySm" colorRole="muted">
                      ({bays.length} bays)
                    </Typography>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {bays.map((totem) => {
                      const bayKey = `${totem.aisle}-${totem.bay}`;
                      const isSelected = selectedBays.has(bayKey);
                      const isConfirmingDelete = confirmDelete === bayKey;
                      const isEditing = editingBay?.aisle === totem.aisle && editingBay?.bay === totem.bay;

                      return (
                        <div key={bayKey} className="group relative">
                          <button
                            onClick={() => toggleBay(bayKey)}
                            className={`w-full rounded-lg border-2 p-3 text-center transition-colors ${
                              isEditing
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : isSelected
                                  ? 'border-brand-primary bg-fill-brand-secondary'
                                  : 'border-border-primary hover:border-brand-primary'
                            }`}
                          >
                            <Typography variant="headingSm" className="font-mono">
                              {totem.bay}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              {totem.levels.length} levels
                            </Typography>
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBay({ aisle: totem.aisle, bay: totem.bay });
                            }}
                            className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white opacity-0 shadow transition-opacity hover:bg-blue-600 group-hover:opacity-100"
                          >
                            <IconPencil className="h-3 w-3" />
                          </button>

                          {/* Delete button */}
                          {isConfirmingDelete ? (
                            <div className="absolute -right-1 -top-1 flex gap-1">
                              <button
                                onClick={() => handleDeleteBay(totem.aisle, totem.bay)}
                                disabled={deleteBayMutation.isPending}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                              >
                                {deleteBayMutation.isPending ? (
                                  <IconLoader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <IconCheck className="h-3 w-3" />
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-fill-tertiary text-text-muted shadow hover:bg-fill-secondary"
                              >
                                <IconX className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(bayKey);
                              }}
                              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fill-tertiary text-text-muted opacity-0 shadow transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                            >
                              <IconTrash className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        {/* Quick Actions */}
        {selectedBays.size > 0 && !editingBay && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <Card className="shadow-xl">
              <CardContent className="flex items-center gap-4 p-4">
                <Typography variant="labelMd">{selectedBays.size} bay(s) selected</Typography>
                <Button
                  variant="default"
                  onClick={handlePrintToZebra}
                  disabled={(!zebraConnected && !isMobile) || isPrintingToZebra}
                >
                  <ButtonContent iconLeft={isPrintingToZebra ? IconLoader2 : IconPrinter}>
                    {isPrintingToZebra ? 'Printing...' : 'Print Labels'}
                  </ButtonContent>
                </Button>
                <Button variant="outline" onClick={() => setSelectedBays(new Set())}>
                  Clear
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default BayConfigurationPage;
