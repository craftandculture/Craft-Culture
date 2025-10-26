/**
 * Format price with currency symbol only (no currency code)
 * For USD: Shows $ symbol (e.g., "$1,235")
 * For AED: Shows number only (e.g., "1,235")
 *
 * @example
 *   formatPrice(1234.56, 'USD'); // returns "$1,235"
 *   formatPrice(1234.56, 'AED'); // returns "1,235"
 *
 * @param price - The price amount to format
 * @param currency - The currency code (USD or AED)
 * @returns The formatted price string
 */
const formatPrice = (price: number, currency?: string) => {
  // Round to nearest whole number
  const roundedPrice = Math.round(price);

  if (currency === 'AED') {
    // For AED, show only the number without currency symbol or code
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(roundedPrice);
  }

  // For USD (and default), show with $ symbol only
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundedPrice);
};

export default formatPrice;
