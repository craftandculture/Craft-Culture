/**
 * Customer type options used across signup and admin interfaces
 * Single source of truth to prevent label inconsistencies
 */

export type CustomerTypeValue = 'b2b' | 'b2c' | 'private_clients';

export interface CustomerTypeOption {
  value: CustomerTypeValue;
  label: string;
  description: string;
}

const customerTypeOptions: CustomerTypeOption[] = [
  {
    value: 'private_clients',
    label: 'Wine Partner',
    description: 'Manage private client orders and inventory',
  },
  {
    value: 'b2b',
    label: 'Distributor',
    description: 'Handle distribution and delivery operations',
  },
  {
    value: 'b2c',
    label: 'Sales Rep',
    description: 'Access pricing tools and generate quotes',
  },
];

/**
 * Get the display label for a customer type value
 */
export const getCustomerTypeLabel = (type: string | null | undefined) => {
  const option = customerTypeOptions.find((opt) => opt.value === type);
  return option?.label ?? type ?? '-';
};

export default customerTypeOptions;
