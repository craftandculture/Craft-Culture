'use client';

import { useCallback, useMemo } from 'react';

import useTRPC, { useTRPCClient } from '@/lib/trpc/browser';

import { useLocalServer } from '../providers/LocalServerProvider';

/**
 * Fetch helper that calls the local NUC server with JSON body.
 * Throws on non-ok responses so callers get consistent error handling.
 */
const localFetch = async <T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Local server error: ${res.status}`);
  }

  return data as T;
};

/**
 * Hook providing WMS API methods that route through the local NUC server
 * when available, falling back to cloud tRPC when not.
 *
 * Returns imperative methods for scan handlers + mutation/query option factories
 * for React Query hooks.
 */
const useWmsApi = () => {
  const { isAvailable, baseUrl } = useLocalServer();
  const trpcClient = useTRPCClient();
  const api = useTRPC();

  /** Scan a location barcode — returns { location, stock, totalCases } */
  const scanLocation = useCallback(
    async (barcode: string) => {
      if (isAvailable && baseUrl) {
        try {
          return await localFetch<{
            location: {
              id: string;
              locationCode: string;
              barcode: string;
              aisle: string;
              bay: string;
              level: string;
              locationType: string;
              requiresForklift: boolean | null;
              capacityCases: number | null;
            };
            stock: Array<{
              id: string;
              lwin18: string;
              productName: string;
              ownerName: string;
              quantityCases: number;
              availableCases: number;
              lotNumber: string | null;
              caseConfig: number | null;
              bottleSize: string | null;
            }>;
            totalCases: number;
          }>(baseUrl, '/api/wms/scan-location', {
            method: 'POST',
            body: JSON.stringify({ barcode }),
          });
        } catch {
          // Fall through to cloud
        }
      }
      return trpcClient.wms.admin.operations.getLocationByBarcode.mutate({ barcode });
    },
    [isAvailable, baseUrl, trpcClient],
  );

  /** Scan a case barcode — returns { caseLabel, currentLocation, stockInfo } */
  const scanCase = useCallback(
    async (barcode: string) => {
      if (isAvailable && baseUrl) {
        try {
          return await localFetch<{
            caseLabel: {
              id: string;
              barcode: string;
              lwin18: string;
              productName: string;
              lotNumber: string | null;
              shipmentId: string | null;
            };
            currentLocation: {
              id: string;
              locationCode: string;
              locationType: string;
              aisle: string;
              bay: string;
              level: string;
            } | null;
            stockInfo: {
              ownerId: string;
              ownerName: string;
              producer: string | null;
              vintage: number | null;
              bottleSize: string | null;
              caseConfig: number | null;
              expiryDate: null;
            } | null;
          }>(baseUrl, '/api/wms/scan-case', {
            method: 'POST',
            body: JSON.stringify({ barcode }),
          });
        } catch {
          // Fall through to cloud
        }
      }
      return trpcClient.wms.admin.operations.getCaseByBarcode.query({ barcode });
    },
    [isAvailable, baseUrl, trpcClient],
  );

  /** Transfer mutation options for useMutation */
  const transferMutationOptions = useCallback(() => {
    if (isAvailable && baseUrl) {
      return {
        mutationFn: async (input: {
          stockId: string;
          quantityCases: number;
          toLocationId: string;
          notes?: string;
        }) => {
          return localFetch<{
            success: true;
            quantityCases: number;
            fromLocation: { id: string; locationCode: string };
            toLocation: { id: string; locationCode: string };
            productName: string;
            movementNumber: string;
            destStockId: string;
            sourceStockId: string | null;
            sourceRemaining: number;
          }>(baseUrl, '/api/wms/transfer', {
            method: 'POST',
            body: JSON.stringify(input),
          });
        },
      };
    }
    return api.wms.admin.operations.transfer.mutationOptions();
  }, [isAvailable, baseUrl, api]);

  /** Putaway mutation options for useMutation */
  const putawayMutationOptions = useCallback(() => {
    if (isAvailable && baseUrl) {
      return {
        mutationFn: async (input: {
          caseBarcode: string;
          toLocationId: string;
          notes?: string;
        }) => {
          return localFetch<{
            success: true;
            caseBarcode: string;
            fromLocation: { id: string; locationCode: string } | null;
            toLocation: { id: string; locationCode: string };
            productName: string;
            movementNumber: string;
          }>(baseUrl, '/api/wms/putaway', {
            method: 'POST',
            body: JSON.stringify(input),
          });
        },
      };
    }
    return api.wms.admin.operations.putaway.mutationOptions();
  }, [isAvailable, baseUrl, api]);

  /** Pick item mutation options for useMutation */
  const pickItemMutationOptions = useCallback(() => {
    if (isAvailable && baseUrl) {
      return {
        mutationFn: async (input: {
          pickListItemId: string;
          pickedFromLocationId: string;
          pickedQuantity: number;
          notes?: string;
        }) => {
          return localFetch<{
            success: true;
            item: Record<string, unknown>;
            message: string;
          }>(baseUrl, '/api/wms/pick-item', {
            method: 'POST',
            body: JSON.stringify(input),
          });
        },
      };
    }
    return api.wms.admin.picking.pickItem.mutationOptions();
  }, [isAvailable, baseUrl, api]);

  /** Complete pick list mutation options for useMutation */
  const pickCompleteMutationOptions = useCallback(() => {
    if (isAvailable && baseUrl) {
      return {
        mutationFn: async (input: { pickListId: string; notes?: string }) => {
          return localFetch<{
            success: true;
            pickList: Record<string, unknown>;
            message: string;
          }>(baseUrl, '/api/wms/pick-complete', {
            method: 'POST',
            body: JSON.stringify(input),
          });
        },
      };
    }
    return api.wms.admin.picking.complete.mutationOptions();
  }, [isAvailable, baseUrl, api]);

  /** Pick list query options for useQuery */
  const pickListQueryOptions = useCallback(
    (pickListId: string) => {
      if (isAvailable && baseUrl) {
        return {
          queryKey: ['wms', 'pickList', pickListId, 'local', baseUrl],
          queryFn: async () => {
            return localFetch<{
              id: string;
              pickListNumber: string;
              status: string | null;
              orderId: string;
              orderNumber: string;
              totalItems: number;
              pickedItems: number;
              assignedTo: string | null;
              assignedToName: string | null;
              startedAt: string | null;
              completedAt: string | null;
              completedBy: string | null;
              notes: string | null;
              createdAt: string;
              items: Array<{
                id: string;
                lwin18: string;
                productName: string;
                quantityCases: number;
                suggestedLocationId: string | null;
                suggestedLocationCode: string | null;
                pickedFromLocationId: string | null;
                pickedQuantity: number | null;
                pickedAt: string | null;
                pickedBy: string | null;
                isPicked: boolean | null;
                notes: string | null;
              }>;
              progress: {
                totalItems: number;
                pickedItems: number;
                totalCases: number;
                pickedCases: number;
                percent: number;
              };
            }>(baseUrl, `/api/wms/pick-list/${pickListId}`);
          },
        };
      }
      return api.wms.admin.picking.getOne.queryOptions({ pickListId });
    },
    [isAvailable, baseUrl, api],
  );

  /** Pick lists query options for useQuery */
  const pickListsQueryOptions = useCallback(
    (filters?: { status?: string; limit?: number; offset?: number }) => {
      if (isAvailable && baseUrl) {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.limit) params.set('limit', String(filters.limit));
        if (filters?.offset) params.set('offset', String(filters.offset));
        const qs = params.toString();

        return {
          queryKey: ['wms', 'pickLists', filters, 'local', baseUrl],
          queryFn: async () => {
            return localFetch<{
              pickLists: Array<Record<string, unknown>>;
              pagination: { total: number; limit: number; offset: number };
              summary: {
                pendingCount: number;
                inProgressCount: number;
                byStatus: Array<{ status: string | null; count: number }>;
              };
            }>(baseUrl, `/api/wms/pick-lists${qs ? `?${qs}` : ''}`);
          },
        };
      }
      return api.wms.admin.picking.getMany.queryOptions({
        status: filters?.status as 'pending' | 'in_progress' | 'completed' | 'cancelled' | undefined,
        limit: filters?.limit,
        offset: filters?.offset,
      });
    },
    [isAvailable, baseUrl, api],
  );

  /** Location scan mutation options (for useMutation pattern) */
  const scanLocationMutationOptions = useCallback(() => {
    if (isAvailable && baseUrl) {
      return {
        mutationFn: async (input: { barcode: string }) => {
          return localFetch<{
            location: {
              id: string;
              locationCode: string;
              barcode: string;
              aisle: string;
              bay: string;
              level: string;
              locationType: string;
              requiresForklift: boolean | null;
              capacityCases: number | null;
            };
            stock: Array<{
              id: string;
              lwin18: string;
              productName: string;
              ownerName: string;
              quantityCases: number;
              availableCases: number;
              lotNumber: string | null;
              caseConfig: number | null;
              bottleSize: string | null;
            }>;
            totalCases: number;
          }>(baseUrl, '/api/wms/scan-location', {
            method: 'POST',
            body: JSON.stringify(input),
          });
        },
      };
    }
    return api.wms.admin.operations.getLocationByBarcode.mutationOptions();
  }, [isAvailable, baseUrl, api]);

  return useMemo(
    () => ({
      scanLocation,
      scanCase,
      transferMutationOptions,
      putawayMutationOptions,
      pickItemMutationOptions,
      pickCompleteMutationOptions,
      pickListQueryOptions,
      pickListsQueryOptions,
      scanLocationMutationOptions,
    }),
    [
      scanLocation,
      scanCase,
      transferMutationOptions,
      putawayMutationOptions,
      pickItemMutationOptions,
      pickCompleteMutationOptions,
      pickListQueryOptions,
      pickListsQueryOptions,
      scanLocationMutationOptions,
    ],
  );
};

export default useWmsApi;
