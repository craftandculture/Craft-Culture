/**
 * Format price with currency symbol only (no currency code)
 * For USD: Shows $ symbol (e.g., "$1,234.56")
 * For AED: Shows number only (e.g., "1,234.56")
 *
 * @example
 *   formatPrice(1234.56, 'USD'); // returns "$1,234.56"
 *   formatPrice(1234.56, 'AED'); // returns "1,234.56"
 *
 * @param price - The price amount to format
 * @param currency - The currency code (USD or AED)
 * @returns The formatted price string
 */
const formatPrice = (price: number, currency?: string) => {
  if (currency === 'AED') {
    // For AED, show only the number without currency symbol or code
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  }

  // For USD (and default), show with $ symbol only
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
};

export default formatPrice;
