/**
 * Format vintage year for display
 *
 * @param year - Vintage year (0 for non-vintage)
 * @returns Formatted vintage string
 */
const formatVintage = (year: number | null) => {
  if (!year || year === 0) {
    return 'NV';
  }
  return year.toString();
};

export default formatVintage;
