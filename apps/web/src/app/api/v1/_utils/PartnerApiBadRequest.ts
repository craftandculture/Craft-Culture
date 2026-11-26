/**
 * Thrown by an account route for a bad request, so `withPartnerKey` answers 400
 *
 * @example
 *   throw new PartnerApiBadRequest('limit must be between 1 and 500');
 */
class PartnerApiBadRequest extends Error {}

export default PartnerApiBadRequest;
