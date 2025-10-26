/**
 * Format price for mobile display without currency code
 * For USD: Shows $ symbol only (e.g., "$1,234.56")
 * For AED: Shows number only without symbol (e.g., "1,234.56")
 *
 * @example
 *   formatPriceMobile(1234.56, 'USD'); // returns "$1,234.56"
 *   formatPriceMobile(1234.56, 'AED'); // returns "1,234.56"
 *
 * @param price - The price amount to format
 * @param currency - The currency code (USD or AED)
 * @returns The formatted price string
 */
const formatPriceMobile = (price: number, currency?: string) => {
  if (currency === 'AED') {
    // For AED, show only the number without currency symbol or code
    return new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  }

  // For USD (and default), show with $ symbol
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
};

export default formatPriceMobile;
