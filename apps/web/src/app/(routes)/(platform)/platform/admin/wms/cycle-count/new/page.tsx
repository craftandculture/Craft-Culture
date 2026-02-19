'use client';

import {
  IconArrowLeft,
  IconClipboardCheck,
  IconLoader2,
  IconMapPin,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import ScanInput from '@/app/_wms/components/ScanInput';
import { useTRPCClient } from '@/lib/trpc/browser';

interface LocationInfo {
  id: string;
  locationCode: string;
  locationType: string | null;
}

interface StockSummary {
  totalCases: number;
  totalAvailable: number;
  stockCount: number;
}

/**
 * Create a new cycle count — scan a location to begin
 */
const NewCycleCountPage = () => {
  const router = useRouter();
  const trpcClient = useTRPCClient();

  const [isScanning, setIsScanning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [notes, setNotes] = useState('');

  const handleLocationScan = useCallback(
    async (barcode: string) => {
      setIsScanning(true);
      setError(null);
      setLocation(null);
      setStockSummary(null);

      try {
        const result = await trpcClient.wms.admin.operations.getLocationByBarcode.mutate({
          barcode,
        });

        setLocation({
          id: result.id,
          locationCode: result.locationCode,
          locationType: result.locationType,
        });

        // Get stock at this location
        const stockResult = await trpcClient.wms.admin.operations.getStockAtLocation.query({
          locationId: result.id,
        });

        setStockSummary({
          totalCases: stockResult.totalCases,
          totalAvailable: stockResult.totalAvailable,
          stockCount: stockResult.stock.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to look up location';
        setError(message);
      } finally {
        setIsScanning(false);
      }
    },
    [trpcClient],
  );

  const handleCreateCount = useCallback(async () => {
    if (!location) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = await trpcClient.wms.admin.cycleCounts.create.mutate({
        locationId: location.id,
        notes: notes || undefined,
      });

      router.push(`/platform/admin/wms/cycle-count/${result.cycleCount.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create cycle count';
      setError(message);
      setIsCreating(false);
    }
  }, [location, notes, trpcClient, router]);

  return (
    <div className="container mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/platform/admin/wms/cycle-count">
            <Button variant="ghost" size="sm">
              <ButtonContent iconLeft={IconArrowLeft}>Back</ButtonContent>
            </Button>
          </Link>
          <div>
            <Typography variant="h4">New Cycle Count</Typography>
            <Typography variant="bodySm" colorRole="muted">
              Scan a location to start counting
            </Typography>
          </div>
        </div>

        {/* Scan Location */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Icon icon={IconMapPin} size="sm" className="text-text-muted" />
              <Typography variant="bodySm" className="font-medium">
                Step 1: Scan Location Barcode
              </Typography>
            </div>
            <ScanInput
              onScan={handleLocationScan}
              isLoading={isScanning}
              placeholder="Scan location barcode (LOC-...)..."
              error={error ?? undefined}
            />
          </CardContent>
        </Card>

        {/* Location Found */}
        {location && stockSummary && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Icon icon={IconClipboardCheck} size="sm" className="text-emerald-600" />
                <Typography variant="bodySm" className="font-medium">
                  Location Found
                </Typography>
              </div>

              <div className="rounded-lg bg-fill-secondary p-3">
                <Typography variant="bodySm" className="font-mono font-semibold">
                  {location.locationCode}
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  {location.locationType ?? 'Unknown type'}
                </Typography>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-fill-secondary p-3 text-center">
                  <Typography variant="h4" className="text-brand-teal">
                    {stockSummary.stockCount}
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Products
                  </Typography>
                </div>
                <div className="rounded-lg bg-fill-secondary p-3 text-center">
                  <Typography variant="h4" className="text-brand-teal">
                    {stockSummary.totalCases}
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Cases
                  </Typography>
                </div>
                <div className="rounded-lg bg-fill-secondary p-3 text-center">
                  <Typography variant="h4" className="text-brand-teal">
                    {stockSummary.totalAvailable}
                  </Typography>
                  <Typography variant="bodySm" colorRole="muted">
                    Available
                  </Typography>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <Typography variant="bodySm" colorRole="muted" className="mb-1">
                  Notes (optional)
                </Typography>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Monthly count for Aisle A..."
                  className="w-full rounded-lg border border-border-muted bg-fill-primary p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-border-brand focus:outline-none"
                  rows={2}
                />
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreateCount}
                disabled={isCreating}
                className="w-full"
              >
                <ButtonContent
                  iconLeft={isCreating ? IconLoader2 : IconClipboardCheck}
                  iconLeftClassName={isCreating ? 'animate-spin' : undefined}
                >
                  {isCreating ? 'Creating...' : 'Start Count'}
                </ButtonContent>
              </Button>

              {stockSummary.stockCount === 0 && (
                <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                  <Typography variant="bodySm" className="text-yellow-800 dark:text-yellow-300">
                    This location has no stock. A count will still be created to confirm the location is empty.
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NewCycleCountPage;
