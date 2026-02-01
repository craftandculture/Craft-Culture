'use client';

import {
  IconArrowLeft,
  IconBox,
  IconEdit,
  IconForklift,
  IconLoader2,
  IconMapPin,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import Button from '@/app/_ui/components/Button/Button';
import ButtonContent from '@/app/_ui/components/Button/ButtonContent';
import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import CapacityBar from '@/app/_wms/components/CapacityBar';
import ExpiryBadge from '@/app/_wms/components/ExpiryBadge';
import LocationBadge from '@/app/_wms/components/LocationBadge';
import OwnerBadge from '@/app/_wms/components/OwnerBadge';
import useTRPC from '@/lib/trpc/browser';

/**
 * Location detail page showing all stock at a specific warehouse location
 */
const LocationDetailPage = () => {
  const params = useParams();
  const locationId = params.id as string;
  const api = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...api.wms.admin.locations.getOne.queryOptions({ id: locationId }),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center p-12">
          <Icon icon={IconLoader2} className="animate-spin" colorRole="muted" size="lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
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

  const totalCases = data.stock.reduce((sum, s) => sum + s.quantityCases, 0);
  const totalAvailable = data.stock.reduce((sum, s) => sum + s.availableCases, 0);
  const totalReserved = data.stock.reduce((sum, s) => sum + s.reservedCases, 0);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Link
                href="/platform/admin/wms/stock"
                className="text-text-muted hover:text-text-primary"
              >
                <Typography variant="bodySm">Stock</Typography>
              </Link>
              <Typography variant="bodySm" colorRole="muted">
                /
              </Typography>
              <Typography variant="bodySm">Location</Typography>
            </div>

            <div className="flex items-center gap-3">
              <LocationBadge
                locationCode={data.locationCode}
                locationType={data.locationType as 'rack' | 'floor' | 'receiving' | 'shipping'}
                requiresForklift={data.requiresForklift ?? false}
                size="lg"
              />
              {data.requiresForklift && (
                <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                  <IconForklift className="h-3 w-3" />
                  Forklift
                </span>
              )}
            </div>

            <Typography variant="bodySm" colorRole="muted" className="mt-2">
              Aisle {data.aisle} / Bay {data.bay} / Level {data.level}
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/platform/admin/wms/locations/${locationId}/edit`}>
              <Button variant="outline" size="sm">
                <ButtonContent iconLeft={IconEdit}>Edit</ButtonContent>
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-blue-600">
                {totalCases}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Total Cases
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-emerald-600">
                {totalAvailable}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Available
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg" className="text-amber-600">
                {totalReserved}
              </Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Reserved
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Typography variant="headingLg">{data.stock.length}</Typography>
              <Typography variant="bodyXs" colorRole="muted">
                Products
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Capacity */}
        {data.capacityCases && (
          <Card>
            <CardContent className="p-4">
              <Typography variant="bodySm" colorRole="muted" className="mb-2">
                Capacity
              </Typography>
              <CapacityBar
                currentCases={totalCases}
                maxCapacity={data.capacityCases}
                showPercent
              />
            </CardContent>
          </Card>
        )}

        {/* Stock List */}
        <div>
          <Typography variant="headingSm" className="mb-4">
            Stock at this Location
          </Typography>

          {data.stock.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Icon icon={IconBox} size="xl" colorRole="muted" className="mx-auto mb-4" />
                <Typography variant="headingSm" className="mb-2">
                  No Stock
                </Typography>
                <Typography variant="bodySm" colorRole="muted">
                  This location is currently empty
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.stock.map((item) => (
                <Card key={item.id} className="hover:border-border-brand">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <Typography variant="headingSm">{item.productName}</Typography>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                          {item.producer && <span>{item.producer}</span>}
                          {item.vintage && <span>• {item.vintage}</span>}
                          <span>
                            • {item.caseConfig}x{item.bottleSize}
                          </span>
                        </div>
                        <Typography variant="bodyXs" colorRole="muted" className="mt-1 font-mono">
                          {item.lwin18}
                        </Typography>
                        {item.lotNumber && (
                          <Typography variant="bodyXs" colorRole="muted" className="mt-1">
                            Lot: {item.lotNumber}
                          </Typography>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <OwnerBadge ownerName={item.ownerName} size="sm" />

                        <div className="text-right">
                          <Typography variant="headingMd" className="text-blue-600">
                            {item.quantityCases}
                          </Typography>
                          <Typography variant="bodyXs" colorRole="muted">
                            cases
                          </Typography>
                        </div>

                        {item.reservedCases > 0 && (
                          <div className="text-right">
                            <Typography variant="headingMd" className="text-amber-600">
                              {item.reservedCases}
                            </Typography>
                            <Typography variant="bodyXs" colorRole="muted">
                              reserved
                            </Typography>
                          </div>
                        )}

                        {item.isPerishable && (
                          <ExpiryBadge
                            expiryDate={item.expiryDate}
                            isPerishable={item.isPerishable}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Back button */}
        <div className="pt-4">
          <Link href="/platform/admin/wms/stock">
            <Button variant="outline">
              <ButtonContent iconLeft={IconArrowLeft}>Back to Stock Overview</ButtonContent>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LocationDetailPage;
