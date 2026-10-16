/** Where a member's wine is, as offered on the application */
const wineSources = [
  {
    value: 'lcb',
    label: 'Wine held at LCB (UK bond)',
    hint: 'We can arrange a transfer into your C&C account at LCB Burton.',
    isTransfer: true,
  },
  {
    value: 'uk_eu_cellar',
    label: 'Wine held elsewhere in the UK or Europe',
    hint: 'Whether with a merchant or bonded warehouse, we can coordinate the transfer on your behalf.',
    isTransfer: true,
  },
  {
    value: 'investment_company',
    label: 'Wine held with a wine investment company',
    hint: 'We can coordinate the transfer from your investment portfolio into your private cellar.',
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
    hint: 'Browse wines already held in bond with C&C and add them directly to your cellar.',
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
