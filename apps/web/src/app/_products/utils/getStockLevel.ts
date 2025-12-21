export type StockLevel = 'high' | 'medium' | 'low';

export interface StockInfo {
  level: StockLevel;
  label: string;
  colorClass: string;
}

/**
 * Determine stock level and formatting based on available quantity
 *
 * @param availableQuantity - Number of cases available (null means unknown quantity)
 * @returns Stock level information with label and color
 */
const getStockLevel = (availableQuantity: number | null): StockInfo => {
  if (availableQuantity === null) {
    return {
      level: 'high',
      label: 'In Stock',
      colorClass: 'text-green-600',
    };
  }

  if (availableQuantity === 0) {
    return {
      level: 'low',
      label: 'Out of Stock',
      colorClass: 'text-red-600',
    };
  }

  if (availableQuantity >= 5) {
    return {
      level: 'high',
      label: `In Stock (${availableQuantity} cases)`,
      colorClass: 'text-green-600',
    };
  }

  if (availableQuantity >= 2) {
    return {
      level: 'medium',
      label: `Low Stock (${availableQuantity} cases)`,
      colorClass: 'text-yellow-600',
    };
  }

  return {
    level: 'low',
    label: `Limited (1 case)`,
    colorClass: 'text-red-600',
  };
};

export default getStockLevel;
