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
  shipments: HillebrandShipment[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface GetShipmentsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

/**
 * Get shipments from Hillebrand API
 *
 * @example
 *   const shipments = await getHillebrandShipments();
 *   console.log(shipments.length); // 12
 */
const getHillebrandShipments = async (options: GetShipmentsOptions = {}) => {
  const { page = 1, pageSize = 50, status } = options;

  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (status) {
    params.set('status', status);
  }

  const endpoint = `/v6/shipments?${params.toString()}`;
  console.log('Hillebrand API request:', endpoint);

  const response = await hillebrandFetch<ShipmentsResponse>(endpoint);

  console.log('Hillebrand API response:', {
    total: response.total,
    page: response.page,
    pageSize: response.pageSize,
    shipmentsCount: response.shipments?.length ?? 0,
    rawResponse: JSON.stringify(response).slice(0, 500),
  });

  return response.shipments ?? [];
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
  getHillebrandShipment,
  getHillebrandShipmentDocuments,
  getHillebrandShipmentEvents,
  getHillebrandShipments,
};

export type { HillebrandShipment };
