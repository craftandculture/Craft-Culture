'use client';

import {
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconForklift,
  IconLoader2,
  IconMapPin,
  IconPackages,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import useTRPC from '@/lib/trpc/browser';

/**
 * Location edit page - modify location settings
 */
const LocationEditPage = () => {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;
  const api = useTRPC();
  const queryClient = useQueryClient();

  // Form state
  const [storageMethod, setStorageMethod] = useState<'pallet' | 'shelf' | 'mixed'>('shelf');
  const [position, setPosition] = useState('');
  const [capacityCases, setCapacityCases] = useState<string>('');
  const [requiresForklift, setRequiresForklift] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  const { data, isLoading, error } = useQuery({
    ...api.wms.admin.locations.getOne.queryOptions({ id: locationId }),
  });

  // Populate form when data loads
  useEffect(() => {
    if (data) {
      setStorageMethod((data.storageMethod as 'pallet' | 'shelf' | 'mixed') ?? 'shelf');
      setPosition(data.position ?? '');
      setCapacityCases(data.capacityCases?.toString() ?? '');
      setRequiresForklift(data.requiresForklift ?? false);
      setIsActive(data.isActive ?? true);
      setNotes(data.notes ?? '');
    }
  }, [data]);

  const updateMutation = useMutation({
    ...api.wms.admin.locations.update.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.locations.getOne.queryKey({ id: locationId }),
      });
      void queryClient.invalidateQueries({
        queryKey: api.wms.admin.locations.getMany.queryKey({}),
      });
      router.push(`/platform/admin/wms/locations/${locationId}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateMutation.mutate({
      id: locationId,
      storageMethod,
      position: position || null,
      capacityCases: capacityCases ? parseInt(capacityCases, 10) : null,
      requiresForklift,
      isActive,
      notes: notes || null,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <Icon icon={IconMapPin} size="xl" colorRole="muted" className="mx-auto mb-4" />
            <Typography variant="headingSm" className="mb-2">
              Location Not Found
            </Typography>
            <Typography variant="bodySm" colorRole="muted" className="mb-4">
              The requested location could not be found.
            </Typography>
            <Link href="/platform/admin/wms/locations">
              <Button variant="outline">
                <ButtonContent iconLeft={IconArrowLeft}>Back to Locations</ButtonContent>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/platform/admin/wms/locations/${locationId}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-fill-secondary text-text-muted hover:bg-fill-primary hover:text-text-primary"
          >
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <Typography variant="headingMd">Edit Location</Typography>
            <div className="mt-1">
              <LocationBadge
                locationCode={data.locationCode}
                locationType={data.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                requiresForklift={data.requiresForklift ?? false}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="divide-y divide-border-primary">
              {/* Storage Method */}
              <div className="p-4">
                <Typography variant="labelMd" className="mb-3">
                  Storage Method
                </Typography>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setStorageMethod('shelf')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                      storageMethod === 'shelf'
                        ? 'border-brand-primary bg-fill-brand-secondary'
                        : 'border-border-primary hover:border-border-brand'
                    }`}
                  >
                    <Icon
                      icon={IconBox}
                      size="lg"
                      colorRole={storageMethod === 'shelf' ? 'brand' : 'muted'}
                    />
                    <Typography
                      variant="labelSm"
                      colorRole={storageMethod === 'shelf' ? 'brand' : 'secondary'}
                    >
                      Shelf
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="text-center">
                      Pick cases
                    </Typography>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStorageMethod('pallet')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                      storageMethod === 'pallet'
                        ? 'border-brand-primary bg-fill-brand-secondary'
                        : 'border-border-primary hover:border-border-brand'
                    }`}
                  >
                    <Icon
                      icon={IconPackages}
                      size="lg"
                      colorRole={storageMethod === 'pallet' ? 'brand' : 'muted'}
                    />
                    <Typography
                      variant="labelSm"
                      colorRole={storageMethod === 'pallet' ? 'brand' : 'secondary'}
                    >
                      Pallet
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="text-center">
                      Full pallets
                    </Typography>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStorageMethod('mixed')}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                      storageMethod === 'mixed'
                        ? 'border-brand-primary bg-fill-brand-secondary'
                        : 'border-border-primary hover:border-border-brand'
                    }`}
                  >
                    <div className="flex">
                      <Icon
                        icon={IconBox}
                        size="md"
                        colorRole={storageMethod === 'mixed' ? 'brand' : 'muted'}
                      />
                      <Icon
                        icon={IconPackages}
                        size="md"
                        colorRole={storageMethod === 'mixed' ? 'brand' : 'muted'}
                        className="-ml-1"
                      />
                    </div>
                    <Typography
                      variant="labelSm"
                      colorRole={storageMethod === 'mixed' ? 'brand' : 'secondary'}
                    >
                      Mixed
                    </Typography>
                    <Typography variant="bodyXs" colorRole="muted" className="text-center">
                      Either type
                    </Typography>
                  </button>
                </div>
              </div>

              {/* Position */}
              <div className="p-4">
                <label htmlFor="position" className="block">
                  <Typography variant="labelMd" className="mb-1">
                    Position
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                    Optional sub-position within the bay (e.g., L, R, A, B, 01, 02)
                  </Typography>
                </label>
                <input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value.toUpperCase())}
                  placeholder="e.g., L, R, A, B"
                  maxLength={5}
                  className="w-full rounded-lg border border-border-primary bg-fill-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              {/* Capacity */}
              <div className="p-4">
                <label htmlFor="capacity" className="block">
                  <Typography variant="labelMd" className="mb-1">
                    Capacity (Cases)
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                    Maximum number of cases this location can hold
                  </Typography>
                </label>
                <input
                  id="capacity"
                  type="number"
                  value={capacityCases}
                  onChange={(e) => setCapacityCases(e.target.value)}
                  placeholder="e.g., 50"
                  min={1}
                  className="w-full rounded-lg border border-border-primary bg-fill-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              {/* Forklift Required */}
              <div className="p-4">
                <label className="flex cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon
                      icon={IconForklift}
                      size="md"
                      colorRole={requiresForklift ? 'warning' : 'muted'}
                    />
                    <div>
                      <Typography variant="labelMd">Requires Forklift</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Enable if this location is above ground level
                      </Typography>
                    </div>
                  </div>
                  <div
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      requiresForklift ? 'bg-amber-500' : 'bg-fill-tertiary'
                    }`}
                    onClick={() => setRequiresForklift(!requiresForklift)}
                  >
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        requiresForklift ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {/* Active Status */}
              <div className="p-4">
                <label className="flex cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon
                      icon={IconCheck}
                      size="md"
                      colorRole={isActive ? 'success' : 'muted'}
                    />
                    <div>
                      <Typography variant="labelMd">Active</Typography>
                      <Typography variant="bodyXs" colorRole="muted">
                        Inactive locations cannot receive stock
                      </Typography>
                    </div>
                  </div>
                  <div
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      isActive ? 'bg-emerald-500' : 'bg-fill-tertiary'
                    }`}
                    onClick={() => setIsActive(!isActive)}
                  >
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        isActive ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div className="p-4">
                <label htmlFor="notes" className="block">
                  <Typography variant="labelMd" className="mb-1">
                    Notes
                  </Typography>
                  <Typography variant="bodyXs" colorRole="muted" className="mb-2">
                    Optional notes about this location
                  </Typography>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this location..."
                  rows={3}
                  className="w-full rounded-lg border border-border-primary bg-fill-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <Link href={`/platform/admin/wms/locations/${locationId}`}>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={updateMutation.isPending}>
              <ButtonContent iconLeft={updateMutation.isPending ? IconLoader2 : IconCheck}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </ButtonContent>
            </Button>
          </div>

          {updateMutation.isError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              Failed to save changes. Please try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LocationEditPage;
