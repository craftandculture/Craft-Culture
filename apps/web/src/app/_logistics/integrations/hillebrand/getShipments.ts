import { hillebrandFetch } from './client';

interface HillebrandLocation {
  cityName?: string;
  countryCode?: string;
  countryName?: string;
}

interface HillebrandReference {
  reference: string;
  role: string;
}

interface HillebrandEquipment {
  number?: string;
  type?: string;
}

interface HillebrandEmission {
  value?: number;
  unit?: string;
  type?: string;
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
 */
const getHillebrandShipment = async (shipmentId: number) => {
  return hillebrandFetch<HillebrandShipment>(`/v6/shipments/${shipmentId}`);
};

/**
 * Get tracking events for a shipment
 */
const getHillebrandShipmentEvents = async (shipmentId: number) => {
  return hillebrandFetch<{ events: unknown[] }>(`/v6/shipments/${shipmentId}/events`);
};

/**
 * Get documents attached to a shipment
 */
const getHillebrandShipmentDocuments = async (shipmentId: number) => {
  return hillebrandFetch<{ documents: unknown[] }>(`/v6/shipments/${shipmentId}/documents`);
};

export {
  getAllHillebrandShipments,
  getHillebrandShipment,
  getHillebrandShipmentDocuments,
  getHillebrandShipmentEvents,
  getHillebrandShipments,
  getHillebrandShipmentsByStatus,
};

export type { HillebrandShipment };
