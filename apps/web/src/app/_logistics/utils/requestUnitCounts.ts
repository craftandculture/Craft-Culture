/**
 * The bottle counts a request's quotes are priced against
 *
 * The request's own count wins. Requests raised from a shipment often carry
 * only pallets and weight, so the shipment's bottle count stands in. A shipment
 * has no 75cl equivalents, so the per-75cl figure stays empty then rather than
 * guessing at bottle sizes.
 *
 * @example
 *   requestUnitCounts(
 *     { totalBottles: null, total75clEquivalents: null },
 *     1188,
 *   );
 *   // { bottles: 1188, equivalents: null, bottlesFrom: 'shipment' }
 *
 * @param request - The request's own bottle and 75cl counts
 * @param shipmentBottles - Bottles on the shipment the request is for
 * @returns The counts to divide by, and where the bottle count came from
 */
const requestUnitCounts = (
  request: {
    totalBottles: number | null;
    total75clEquivalents: number | null;
  },
  shipmentBottles: number | null | undefined,
) => {
  if (request.totalBottles) {
    return {
      bottles: request.totalBottles,
      equivalents: request.total75clEquivalents,
      bottlesFrom: 'request' as const,
    };
  }

  if (shipmentBottles) {
    return {
      bottles: shipmentBottles,
      equivalents: null,
      bottlesFrom: 'shipment' as const,
    };
  }

  return {
    bottles: null,
    equivalents: request.total75clEquivalents,
    bottlesFrom: null,
  };
};

export default requestUnitCounts;
