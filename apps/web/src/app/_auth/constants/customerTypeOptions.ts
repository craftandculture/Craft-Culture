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
      Two taxonomies, and they are not the same one.

      `customerType` says what kind of LOGIN this is. `partnerType` says what
      kind of ENTITY it acts for — Cru Wine and Cult Wine are `wine_partner`,
      Ihab Toma is `private_collector`. Both of those sign in as
      `private_clients`, which is a poor name for "acts for somebody who holds
      stock with us" and has caused this exact confusion twice.

      So the label names the function rather than borrowing a partner type:
      calling it "Wine Partner" hid collectors, and calling it "Wine Partner or
      Collector" implied Cru Wine is a private client. Neither is true. The
      distinction between the two lives on the partner record, where it belongs
      — putting it here as well would be two fields answering one question.
    */
    value: 'private_clients',
    label: 'Partner Account',
    description: 'Acts for a wine partner or a collector — link the record next',
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
