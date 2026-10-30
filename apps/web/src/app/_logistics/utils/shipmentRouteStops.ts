/** The few fields a shipment's route is drawn from */
export interface ShipmentRouteInput {
  status: string;
  type: string;
  transportMode: string;
  originCity: string | null;
  originCountry: string | null;
  originWarehouse?: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  destinationWarehouse: string | null;
  carrierName?: string | null;
  etd: Date | string | null;
  atd: Date | string | null;
  eta: Date | string | null;
  ata: Date | string | null;
  etaConfirmed?: boolean | null;
  deliveredAt?: Date | string | null;
  createdAt: Date | string;
}

export interface ShipmentRouteStop {
  step: string;
  place: string;
  country: string | null;
  date: string;
  done: boolean;
  late: boolean;
}

/** How far along each status is: 0 opened … 4 at the warehouse or delivered */
const PROGRESS: Record<string, number> = {
  draft: 0,
  booked: 1,
  picked_up: 1,
  in_transit: 2,
  arrived_port: 3,
  customs_clearance: 3,
  cleared: 3,
  at_warehouse: 4,
  partially_received: 4,
  dispatched: 4,
  delivered: 4,
  cancelled: 0,
};

const MODE_LABEL: Record<string, string> = {
  air: 'Air freight',
  sea_fcl: 'Sea, full container',
  sea_lcl: 'Sea, shared container',
  road: 'Road',
};

const day = (date: Date | string) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * A shipment's four stops, Origin → Departure → Arrival → Warehouse
 *
 * Drawn from dates and status the team already keeps: a stop is done once its
 * actual date is logged or the status has passed it, and the arrival is late
 * when its ETA has passed with no arrival logged.
 *
 * @example
 *   shipmentRouteStops(shipment)[2]; // { step: 'Arrival', place: 'Ras al Khaimah', date: 'Est. arrival 1 Nov', … }
 */
const shipmentRouteStops = (s: ShipmentRouteInput, now = new Date()): ShipmentRouteStop[] => {
  const progress = PROGRESS[s.status] ?? 0;
  const inbound = s.type === 'inbound';
  const departed = !!s.atd || progress >= 2;
  const arrived = !!s.ata || progress >= 3;
  const finished = progress >= 4;
  const arrivalLate = !arrived && !!s.eta && new Date(s.eta) < now && s.status !== 'cancelled';

  return [
    {
      step: 'Origin',
      place: s.originWarehouse ?? s.originCity ?? s.originCountry ?? 'Origin not set',
      country: s.originCountry,
      date: `Opened ${day(s.createdAt)}`,
      done: progress >= 1,
      late: false,
    },
    {
      step: 'Departure',
      place: s.carrierName ?? MODE_LABEL[s.transportMode] ?? 'Departure',
      country: s.originCountry,
      date: s.atd
        ? `Departed ${day(s.atd)}`
        : s.etd
          ? `Est. departure ${day(s.etd)}`
          : departed
            ? 'Departed'
            : 'Departure not set',
      done: departed,
      late: false,
    },
    {
      step: 'Arrival',
      place: s.destinationCity ?? s.destinationCountry ?? 'Destination',
      country: s.destinationCountry,
      date: s.ata
        ? `Arrived ${day(s.ata)}`
        : s.eta
          ? `${arrivalLate ? 'Was due' : s.etaConfirmed ? 'Arrives' : 'Est. arrival'} ${day(s.eta)}`
          : arrived
            ? 'Arrived'
            : 'ETA not set',
      done: arrived,
      late: arrivalLate,
    },
    {
      step: inbound ? 'Warehouse' : 'Delivery',
      place: s.destinationWarehouse ?? (inbound ? 'C&C bond, RAK' : 'Client'),
      country: s.destinationCountry,
      date: finished
        ? s.deliveredAt
          ? `${inbound ? 'Received' : 'Delivered'} ${day(s.deliveredAt)}`
          : inbound
            ? 'Received'
            : 'Delivered'
        : inbound
          ? 'Not received'
          : 'Not delivered',
      done: finished,
      late: false,
    },
  ];
};

export default shipmentRouteStops;
