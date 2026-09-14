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
    /*
      One value, two kinds of account. A wine partner and a private collector
      are both `private_clients`; what separates them is the partner record
      they are linked to afterwards. Labelling this "Wine Partner" meant
      somebody onboarding a collector could not find an option that described
      them, and reasonably concluded there wasn't one.
    */
    value: 'private_clients',
    label: 'Wine Partner or Collector',
    description: 'Owns stock with us — link them to a partner record next',
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
