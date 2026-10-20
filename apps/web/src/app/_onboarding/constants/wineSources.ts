/** Where a member's wine is, as offered on the application */
const wineSources = [
  {
    value: 'lcb',
    label: 'Wine held at LCB (UK bond)',
    hint: 'We can arrange a bonded transfer into your C&C-managed storage at LCB Burton.',
    isTransfer: true,
  },
  {
    value: 'uk_eu_cellar',
    label: 'Wine held elsewhere in the UK or Europe',
    hint: 'Whether with a merchant or bonded warehouse, we can coordinate the transfer on your behalf.',
    isTransfer: true,
  },
  {
    value: 'uae_bond',
    label: 'Wine held in bond elsewhere in the UAE',
    hint: 'Already in a UAE bonded or free zone warehouse? We can arrange an in-bond transfer into your private cellar, with duty and VAT still suspended.',
    isTransfer: true,
  },
  {
    value: 'investment_company',
    label: 'Wine held with a wine investment platform',
    hint: 'We can coordinate the transfer of your holdings into your private cellar.',
    isTransfer: true,
  },
  {
    value: 'multiple_locations',
    label: 'Wine held across multiple locations',
    hint: 'We can help consolidate your holdings and bring your collection together under C&C.',
    isTransfer: true,
  },
  {
    value: 'with_cc',
    label: 'Wine already with Craft & Culture',
    hint: 'We will add your existing holdings to your private cellar.',
    isTransfer: false,
  },
  {
    value: 'uae_in_bond',
    label: 'I would like to buy wine in the UAE',
    hint: 'Browse wines already held in bond with C&C and add them directly to your private cellar, with no international shipping required.',
    isTransfer: false,
  },
  {
    value: 'starting_fresh',
    label: 'I am starting a new collection',
    hint: 'We will help you build your collection, source wines and manage everything in one place.',
    isTransfer: false,
  },
] as const;

export type WineSource = (typeof wineSources)[number]['value'];

export const WINE_SOURCE_VALUES = wineSources.map((source) => source.value) as [
  WineSource,
  ...WineSource[],
];

export default wineSources;
