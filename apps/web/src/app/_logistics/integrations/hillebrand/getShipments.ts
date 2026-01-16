import { hillebrandFetch } from './client';

interface HillebrandLocation {
  cityName?: string;
  countryCode?: string;
  countryName?: string;
  unlocode?: string;
}

interface HillebrandReference {
  reference: string;
  role: string;
}

interface HillebrandEquipment {
  number?: string;
  type?: string;
  sealNumber?: string;
}

interface HillebrandEmission {
  value?: number;
  unit?: string;
  type?: string;
}

interface HillebrandCargoItem {
  id?: number;
  description?: string;
  productName?: string;
  quantity?: number;
  quantityUnit?: string;
  numberOfPackages?: number;
  packageType?: string;
  grossWeight?: number;
  grossWeightUnit?: string;
  netWeight?: number;
  volume?: number;
  volumeUnit?: string;
  hsCode?: string;
}

interface HillebrandMilestone {
  type: string;
  status: 'planned' | 'actual' | 'estimated';
  dateTime?: string;
  location?: HillebrandLocation;
  description?: string;
}

interface HillebrandEvent {
  id?: number;
  eventType: string;
  eventDateTime: string;
  location?: HillebrandLocation;
  description?: string;
  vessel?: {
    name?: string;
    imoNumber?: string;
    voyageNumber?: string;
  };
}

interface HillebrandDocument {
  id: number;
  documentType: string;
  documentNumber?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  downloadUrl?: string;
}

interface HillebrandShipment {
  id: number;
  status: string;
  shipFromPartyName?: string;
  shipFromLocation?: HillebrandLocation;
  shipToPartyName?: string;
  shipToLocation?: HillebrandLocation;
  mainModality?: string;
  references?: HillebrandReference[];
  equipment?: HillebrandEquipment;
  emission?: HillebrandEmission;
  createdAt?: string;
  updatedAt?: string;
  // Timeline dates
  estimatedDepartureDate?: string;
  actualDepartureDate?: string;
  estimatedArrivalDate?: string;
  actualArrivalDate?: string;
  deliveredDate?: string;
  // Alternative date field names
  etd?: string;
  atd?: string;
  eta?: string;
  ata?: string;
  // Cargo summary
  totalWeight?: number;
  totalWeightUnit?: string;
  totalVolume?: number;
  totalVolumeUnit?: string;
  numberOfPackages?: number;
  numberOfPieces?: number;
  // Detailed cargo
  cargo?: HillebrandCargoItem[];
  cargoItems?: HillebrandCargoItem[];
  items?: HillebrandCargoItem[];
  // Milestones and events
  milestones?: HillebrandMilestone[];
  events?: HillebrandEvent[];
  // Documents
  documents?: HillebrandDocument[];
  // Vessel info
  vessel?: {
    name?: string;
    imoNumber?: string;
    voyageNumber?: string;
    flag?: string;
  };
  // Bill of Lading
  billOfLadingNumber?: string;
  blNumber?: string;
  masterBillNumber?: string;
  houseBillNumber?: string;
}

interface ShipmentsResponse {
  shipments?: HillebrandShipment[];
  data?: HillebrandShipment[];
  items?: HillebrandShipment[];
  content?: HillebrandShipment[];
  total?: number;
  totalElements?: number;
  page?: number;
  pageSize?: number;
  size?: number;
}

interface GetShipmentsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  reference?: string;
  modifiedSinceTimeStamp?: string;
}

/**
 * Get shipments from Hillebrand API
 *
 * @example
 *   const shipments = await getHillebrandShipments();
 *   console.log(shipments.length); // 12
 */
const getHillebrandShipments = async (options: GetShipmentsOptions = {}) => {
  const { page = 1, pageSize = 50, status, reference, modifiedSinceTimeStamp } = options;

  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (status) {
    params.set('status', status);
  }

  if (reference) {
    params.set('reference', reference);
  }

  if (modifiedSinceTimeStamp) {
    params.set('modifiedSinceTimeStamp', modifiedSinceTimeStamp);
  }

  const endpoint = `/v6/shipments?${params.toString()}`;
  console.log('Hillebrand API request:', endpoint);

  const response = await hillebrandFetch<ShipmentsResponse | HillebrandShipment[]>(endpoint);

  // Handle different response structures
  let shipments: HillebrandShipment[] = [];

  if (Array.isArray(response)) {
    // Response is directly an array of shipments
    shipments = response;
    console.log('Hillebrand API response: direct array', {
      shipmentsCount: shipments.length,
    });
  } else {
    // Response is an object - try different property names
    shipments =
      response.shipments ??
      response.data ??
      response.items ??
      response.content ??
      [];

    console.log('Hillebrand API response:', {
      total: response.total ?? response.totalElements,
      page: response.page,
      pageSize: response.pageSize ?? response.size,
      shipmentsCount: shipments.length,
      responseKeys: Object.keys(response),
      rawResponse: JSON.stringify(response).slice(0, 2000),
    });
  }

  return shipments;
};

/**
 * Get shipments with specific statuses from Hillebrand API
 *
 * Tries multiple status values to ensure we get all active shipments.
 */
const getHillebrandShipmentsByStatus = async (statuses: string[]) => {
  const allShipments: HillebrandShipment[] = [];
  const seenIds = new Set<number>();

  for (const status of statuses) {
    console.log(`Fetching Hillebrand shipments with status: ${status}`);
    const shipments = await getHillebrandShipments({ status, pageSize: 100 });

    for (const shipment of shipments) {
      if (!seenIds.has(shipment.id)) {
        seenIds.add(shipment.id);
        allShipments.push(shipment);
      }
    }
  }

  return allShipments;
};

/**
 * Get all shipments from Hillebrand API with pagination
 *
 * Fetches all pages of shipments until no more are available.
 */
const getAllHillebrandShipments = async (options: Omit<GetShipmentsOptions, 'page'> = {}) => {
  const allShipments: HillebrandShipment[] = [];
  let page = 1;
  const pageSize = options.pageSize ?? 100;

  while (true) {
    const shipments = await getHillebrandShipments({ ...options, page, pageSize });
    allShipments.push(...shipments);

    if (shipments.length < pageSize) {
      break;
    }

    page++;
  }

  return allShipments;
};

/**
 * Get a single shipment by ID with full details
 *
 * The detail endpoint returns more data than the list endpoint including
 * cargo items, timeline dates, and tracking information.
 */
const getHillebrandShipment = async (shipmentId: number) => {
  const response = await hillebrandFetch<HillebrandShipment>(`/v6/shipments/${shipmentId}`);

  console.log('Hillebrand shipment detail:', {
    id: shipmentId,
    hasCargoItems: !!(response.cargo || response.cargoItems || response.items),
    hasMilestones: !!response.milestones,
    hasEvents: !!response.events,
    hasVessel: !!response.vessel,
    etd: response.etd || response.estimatedDepartureDate,
    eta: response.eta || response.estimatedArrivalDate,
    responseKeys: Object.keys(response),
    rawResponse: JSON.stringify(response).slice(0, 3000),
  });

  return response;
};

interface EventsResponse {
  events?: HillebrandEvent[];
  data?: HillebrandEvent[];
  items?: HillebrandEvent[];
}

/**
 * Get tracking events for a shipment
 */
const getHillebrandShipmentEvents = async (shipmentId: number) => {
  const response = await hillebrandFetch<EventsResponse | HillebrandEvent[]>(
    `/v6/shipments/${shipmentId}/events`,
  );

  let events: HillebrandEvent[] = [];
  if (Array.isArray(response)) {
    events = response;
  } else {
    events = response.events ?? response.data ?? response.items ?? [];
  }

  console.log('Hillebrand shipment events:', {
    id: shipmentId,
    eventsCount: events.length,
    events: events.slice(0, 5),
  });

  return events;
};

interface DocumentsResponse {
  documents?: HillebrandDocument[];
  data?: HillebrandDocument[];
  items?: HillebrandDocument[];
}

/**
 * Get documents attached to a shipment
 */
const getHillebrandShipmentDocuments = async (shipmentId: number) => {
  const response = await hillebrandFetch<DocumentsResponse | HillebrandDocument[]>(
    `/v6/shipments/${shipmentId}/documents`,
  );

  let documents: HillebrandDocument[] = [];
  if (Array.isArray(response)) {
    documents = response;
  } else {
    documents = response.documents ?? response.data ?? response.items ?? [];
  }

  console.log('Hillebrand shipment documents:', {
    id: shipmentId,
    documentsCount: documents.length,
    documents: documents.slice(0, 5),
  });

  return documents;
};

export {
  getAllHillebrandShipments,
  getHillebrandShipment,
  getHillebrandShipmentDocuments,
  getHillebrandShipmentEvents,
  getHillebrandShipments,
  getHillebrandShipmentsByStatus,
};

export type {
  HillebrandCargoItem,
  HillebrandDocument,
  HillebrandEvent,
  HillebrandMilestone,
  HillebrandShipment,
};
