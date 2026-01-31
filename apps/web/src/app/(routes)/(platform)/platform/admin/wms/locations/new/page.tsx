'use client';

import { IconArrowLeft, IconLoader2, IconMapPin, IconPlus } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import CardTitle from '@/app/_ui/components/Card/CardTitle';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

/**
 * Create Locations Page - batch create warehouse locations
 */
const CreateLocationsPage = () => {
  const router = useRouter();
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Form state
  const [mode, setMode] = useState<'batch' | 'special'>('batch');
  const [aisles, setAisles] = useState('A');
  const [bayStart, setBayStart] = useState('01');
  const [bayEnd, setBayEnd] = useState('03');
  const [levelStart, setLevelStart] = useState('00');
  const [levelEnd, setLevelEnd] = useState('03');
  const [forkliftFromLevel, setForkliftFromLevel] = useState('01');
  const [specialName, setSpecialName] = useState('');
  const [specialType, setSpecialType] = useState<'receiving' | 'shipping' | 'floor'>('receiving');

  // Generate arrays from ranges
  const generateRange = (start: string, end: string) => {
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);
    const result = [];
    for (let i = startNum; i <= endNum; i++) {
      result.push(i.toString().padStart(2, '0'));
    }
    return result;
  };

  // Calculate preview
  const aisleList = aisles.split(',').map((a) => a.trim().toUpperCase());
  const bayList = generateRange(bayStart, bayEnd);
  const levelList = generateRange(levelStart, levelEnd);
  const totalLocations = aisleList.length * bayList.length * levelList.length;

  // Mutations
  const { mutate: batchCreate, isPending: isBatchPending } = useMutation({
    ...api.wms.admin.locations.batchCreate.mutationOptions(),
    onSuccess: (result) => {
      toast.success(`Created ${result.created} locations`);
      void queryClient.invalidateQueries({ queryKey: [['wms', 'admin', 'locations']] });
      router.push('/platform/admin/wms/locations');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create locations');
    },
  });

  const { mutate: createSpecial, isPending: isSpecialPending } = useMutation({
    ...api.wms.admin.locations.createSpecial.mutationOptions(),
    onSuccess: () => {
      toast.success('Special location created');
      void queryClient.invalidateQueries({ queryKey: [['wms', 'admin', 'locations']] });
      setSpecialName('');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create location');
    },
  });

  const handleBatchCreate = () => {
    batchCreate({
      aisles: aisleList,
      bays: bayList,
      levels: levelList,
      locationType: 'rack',
      forkliftFromLevel,
    });
  };

  const handleCreateSpecial = () => {
    if (!specialName.trim()) {
      toast.error('Please enter a location name');
      return;
    }
    createSpecial({
      name: specialName.trim(),
      locationType: specialType,
    });
  };

  const isPending = isBatchPending || isSpecialPending;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/platform/admin/wms/locations">
              <Icon icon={IconArrowLeft} size="sm" />
            </Link>
          </Button>
          <div>
            <Typography variant="headingLg" className="mb-2">
              Create Locations
            </Typography>
            <Typography variant="bodyMd" colorRole="muted">
              Set up your warehouse location structure
            </Typography>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="flex gap-2">
          <Button
            variant={mode === 'batch' ? 'default' : 'outline'}
            onClick={() => setMode('batch')}
          >
            Batch Create (Rack)
          </Button>
          <Button
            variant={mode === 'special' ? 'default' : 'outline'}
            onClick={() => setMode('special')}
          >
            Special Location
          </Button>
        </div>

        {mode === 'batch' ? (
          <>
            {/* Batch Create Form */}
            <Card>
              <div className="p-4 pb-3">
                <CardTitle>Rack Location Setup</CardTitle>
              </div>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Aisles (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={aisles}
                    onChange={(e) => setAisles(e.target.value)}
                    placeholder="A, B, C"
                    className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    e.g., A or A, B, C for multiple aisles
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Bay Start</label>
                    <input
                      type="text"
                      value={bayStart}
                      onChange={(e) => setBayStart(e.target.value)}
                      placeholder="01"
                      className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Bay End</label>
                    <input
                      type="text"
                      value={bayEnd}
                      onChange={(e) => setBayEnd(e.target.value)}
                      placeholder="03"
                      className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Level Start</label>
                    <input
                      type="text"
                      value={levelStart}
                      onChange={(e) => setLevelStart(e.target.value)}
                      placeholder="00"
                      className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono"
                    />
                    <p className="mt-1 text-xs text-text-muted">00 = floor level</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Level End</label>
                    <input
                      type="text"
                      value={levelEnd}
                      onChange={(e) => setLevelEnd(e.target.value)}
                      placeholder="03"
                      className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Forklift Required From Level
                  </label>
                  <input
                    type="text"
                    value={forkliftFromLevel}
                    onChange={(e) => setForkliftFromLevel(e.target.value)}
                    placeholder="01"
                    className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Levels at or above this will be marked as requiring forklift
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <div className="p-4 pb-3">
                <CardTitle>Preview</CardTitle>
              </div>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-fill-secondary rounded-lg">
                    <Typography variant="bodyXs" colorRole="muted">
                      Total Locations
                    </Typography>
                    <Typography variant="headingMd">{totalLocations}</Typography>
                  </div>
                  <div className="p-3 bg-fill-secondary rounded-lg">
                    <Typography variant="bodyXs" colorRole="muted">
                      Naming Format
                    </Typography>
                    <Typography variant="headingSm" className="font-mono">
                      {aisleList[0]}-{bayStart}-{levelStart}
                    </Typography>
                  </div>
                </div>

                <Typography variant="bodySm" colorRole="muted" className="mb-2">
                  Sample locations:
                </Typography>
                <div className="flex flex-wrap gap-2">
                  {aisleList.slice(0, 2).map((aisle) =>
                    bayList.slice(0, 2).map((bay) =>
                      levelList.slice(0, 2).map((level) => (
                        <span
                          key={`${aisle}-${bay}-${level}`}
                          className="px-2 py-1 text-xs font-mono bg-fill-tertiary rounded"
                        >
                          {aisle}-{bay}-{level}
                        </span>
                      )),
                    ),
                  )}
                  {totalLocations > 8 && (
                    <span className="px-2 py-1 text-xs text-text-muted">
                      ...and {totalLocations - 8} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" asChild>
                <Link href="/platform/admin/wms/locations">Cancel</Link>
              </Button>
              <Button onClick={handleBatchCreate} disabled={isPending || totalLocations === 0}>
                {isBatchPending ? (
                  <ButtonContent iconLeft={IconLoader2}>
                    <span className="animate-pulse">Creating...</span>
                  </ButtonContent>
                ) : (
                  <ButtonContent iconLeft={IconPlus}>
                    Create {totalLocations} Locations
                  </ButtonContent>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Special Location Form */}
            <Card>
              <div className="p-4 pb-3">
                <CardTitle>Special Location</CardTitle>
              </div>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Location Name</label>
                  <input
                    type="text"
                    value={specialName}
                    onChange={(e) => setSpecialName(e.target.value)}
                    placeholder="e.g., RECEIVING, SHIPPING, STAGING"
                    className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Location Type</label>
                  <select
                    value={specialType}
                    onChange={(e) =>
                      setSpecialType(e.target.value as 'receiving' | 'shipping' | 'floor')
                    }
                    className="w-full px-3 py-2 text-sm bg-fill-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="receiving">Receiving</option>
                    <option value="shipping">Shipping</option>
                    <option value="floor">Floor</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleCreateSpecial}
                    disabled={isPending || !specialName.trim()}
                    className="flex-1"
                  >
                    {isSpecialPending ? (
                      <ButtonContent iconLeft={IconLoader2}>
                        <span className="animate-pulse">Creating...</span>
                      </ButtonContent>
                    ) : (
                      <ButtonContent iconLeft={IconPlus}>Create Location</ButtonContent>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Create */}
            <Card>
              <div className="p-4 pb-3">
                <CardTitle>Quick Create Common Locations</CardTitle>
              </div>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSpecialName('RECEIVING');
                      setSpecialType('receiving');
                    }}
                  >
                    <ButtonContent iconLeft={IconMapPin}>RECEIVING</ButtonContent>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSpecialName('SHIPPING');
                      setSpecialType('shipping');
                    }}
                  >
                    <ButtonContent iconLeft={IconMapPin}>SHIPPING</ButtonContent>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateLocationsPage;
