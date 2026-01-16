'use client';

import {
  IconAnchor,
  IconBox,
  IconBuildingWarehouse,
  IconCheck,
  IconCircleDot,
  IconLoader2,
  IconMapPin,
  IconPackage,
  IconPackageExport,
  IconPlane,
  IconShip,
  IconTruck,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import Card from '@/app/_ui/components/Card/Card';
import CardContent from '@/app/_ui/components/Card/CardContent';
import Icon from '@/app/_ui/components/Icon/Icon';
import Typography from '@/app/_ui/components/Typography/Typography';
import useTRPC from '@/lib/trpc/browser';

interface TrackingEvent {
  id: string;
  eventType: string;
  description: string;
  location?: string;
  timestamp: Date;
  isCompleted: boolean;
}

export interface ShipmentTrackerProps {
  shipmentId: string;
  hillebrandShipmentId?: number | null;
  originCity?: string | null;
  originCountry?: string | null;
  destinationCity?: string | null;
  destinationWarehouse?: string | null;
  status: string;
  etd?: Date | null;
  atd?: Date | null;
  eta?: Date | null;
  ata?: Date | null;
  deliveredAt?: Date | null;
}

const eventIcons: Record<string, typeof IconShip> = {
  departure: IconPackageExport,
  departed: IconPackageExport,
  in_transit: IconShip,
  transit: IconShip,
  arrival: IconAnchor,
  arrived: IconAnchor,
  customs: IconBox,
  customs_clearance: IconBox,
  cleared: IconCheck,
  warehouse: IconBuildingWarehouse,
  at_warehouse: IconBuildingWarehouse,
  dispatched: IconTruck,
  delivery: IconMapPin,
  delivered: IconMapPin,
  air: IconPlane,
  sea: IconShip,
  road: IconTruck,
};

/**
 * Visual shipment tracker showing journey progress
 */
const ShipmentTracker = ({
  shipmentId,
  hillebrandShipmentId,
  originCity,
  originCountry,
  destinationCity,
  destinationWarehouse,
  status,
  etd,
  atd,
  eta,
  ata,
  deliveredAt,
}: ShipmentTrackerProps) => {
  const api = useTRPC();

  // Fetch Hillebrand events if available
  const { data: hillebrandEvents, isLoading } = useQuery({
    ...api.logistics.admin.getHillebrandEvents.queryOptions({ shipmentId }),
    enabled: !!hillebrandShipmentId,
  }) as { data: { events: unknown[] } | undefined; isLoading: boolean };

  // Build timeline from available data
  const buildTimeline = (): TrackingEvent[] => {
    const events: TrackingEvent[] = [];

    // Origin departure
    events.push({
      id: 'departure',
      eventType: 'departure',
      description: `Departed from ${originCity ?? originCountry ?? 'origin'}`,
      location: originCity ?? originCountry ?? undefined,
      timestamp: atd ?? etd ?? new Date(),
      isCompleted: !!atd || ['in_transit', 'arrived_port', 'customs_clearance', 'cleared', 'at_warehouse', 'dispatched', 'delivered'].includes(status),
    });

    // In transit
    if (atd) {
      events.push({
        id: 'transit',
        eventType: 'in_transit',
        description: 'In transit',
        timestamp: atd,
        isCompleted: ['arrived_port', 'customs_clearance', 'cleared', 'at_warehouse', 'dispatched', 'delivered'].includes(status),
      });
    }

    // Port arrival
    events.push({
      id: 'arrival',
      eventType: 'arrival',
      description: `Arrived at ${destinationCity ?? 'port'}`,
      location: destinationCity ?? undefined,
      timestamp: ata ?? eta ?? new Date(),
      isCompleted: !!ata || ['customs_clearance', 'cleared', 'at_warehouse', 'dispatched', 'delivered'].includes(status),
    });

    // Customs
    events.push({
      id: 'customs',
      eventType: 'customs_clearance',
      description: 'Customs clearance',
      location: destinationCity ?? undefined,
      timestamp: ata ?? eta ?? new Date(),
      isCompleted: ['cleared', 'at_warehouse', 'dispatched', 'delivered'].includes(status),
    });

    // Warehouse
    events.push({
      id: 'warehouse',
      eventType: 'at_warehouse',
      description: `At ${destinationWarehouse ?? 'warehouse'}`,
      location: destinationWarehouse ?? undefined,
      timestamp: ata ?? eta ?? new Date(),
      isCompleted: ['at_warehouse', 'dispatched', 'delivered'].includes(status),
    });

    // Delivered
    events.push({
      id: 'delivered',
      eventType: 'delivered',
      description: 'Delivered',
      location: destinationWarehouse ?? destinationCity ?? undefined,
      timestamp: deliveredAt ?? new Date(),
      isCompleted: status === 'delivered',
    });

    return events;
  };

  const timeline = buildTimeline();

  // If we have Hillebrand events, enhance the timeline
  const enhancedTimeline = hillebrandEvents?.events?.length
    ? [...timeline] // Could merge Hillebrand events here
    : timeline;

  if (isLoading && hillebrandShipmentId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Icon icon={IconLoader2} className="animate-spin" size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Typography variant="headingSm">Shipment Tracker</Typography>
          {hillebrandShipmentId && (
            <Typography variant="bodyXs" colorRole="muted">
              Hillebrand #{hillebrandShipmentId}
            </Typography>
          )}
        </div>

        {/* Route summary */}
        <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-surface-secondary">
          <div className="flex items-center gap-2">
            <Icon icon={IconPackage} size="md" className="text-text-muted" />
            <div>
              <Typography variant="bodyXs" colorRole="muted">From</Typography>
              <Typography variant="bodySm" className="font-medium">
                {originCity ?? originCountry ?? 'Origin'}
              </Typography>
            </div>
          </div>
          <div className="flex-1 mx-4 border-t-2 border-dashed border-border-muted" />
          <div className="flex items-center gap-2">
            <div className="text-right">
              <Typography variant="bodyXs" colorRole="muted">To</Typography>
              <Typography variant="bodySm" className="font-medium">
                {destinationWarehouse ?? destinationCity ?? 'Destination'}
              </Typography>
            </div>
            <Icon icon={IconMapPin} size="md" className="text-fill-brand" />
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {enhancedTimeline.map((event, index) => {
            const EventIcon = eventIcons[event.eventType] ?? IconCircleDot;
            const isLast = index === enhancedTimeline.length - 1;
            const isCurrent = event.isCompleted && (isLast || !enhancedTimeline[index + 1]?.isCompleted);

            return (
              <div key={event.id} className="relative flex gap-4 pb-6">
                {/* Vertical line */}
                {!isLast && (
                  <div
                    className={`absolute left-4 top-8 w-0.5 h-full -ml-px ${
                      event.isCompleted ? 'bg-fill-brand' : 'bg-border-muted'
                    }`}
                  />
                )}

                {/* Icon */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    event.isCompleted
                      ? 'border-fill-brand bg-fill-brand text-white'
                      : isCurrent
                        ? 'border-fill-brand bg-white dark:bg-surface-primary'
                        : 'border-border-muted bg-white dark:bg-surface-primary'
                  }`}
                >
                  {event.isCompleted ? (
                    <Icon icon={IconCheck} size="sm" />
                  ) : (
                    <Icon icon={EventIcon} size="sm" className={isCurrent ? 'text-fill-brand' : 'text-text-muted'} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center justify-between">
                    <Typography
                      variant="bodySm"
                      className={`font-medium ${!event.isCompleted && !isCurrent ? 'text-text-muted' : ''}`}
                    >
                      {event.description}
                    </Typography>
                    {event.isCompleted && event.timestamp && (
                      <Typography variant="bodyXs" colorRole="muted">
                        {format(new Date(event.timestamp), 'dd MMM, HH:mm')}
                      </Typography>
                    )}
                  </div>
                  {event.location && (
                    <Typography variant="bodyXs" colorRole="muted">
                      {event.location}
                    </Typography>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShipmentTracker;
