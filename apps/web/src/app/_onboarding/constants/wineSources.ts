/** Where a member's wine is, as offered on the application */
const wineSources = [
  {
    value: 'uae_in_bond',
    label: 'Build my cellar from wine in bond here in the UAE',
    hint: 'Select from wine already held in bond in the UAE.',
    isTransfer: false,
  },
  {
    value: 'lcb',
    label: 'At LCB (UK bond)',
    hint: 'We arrange the transfer into our account at LCB Burton.',
    isTransfer: true,
  },
  {
    value: 'uk_eu_cellar',
    label: 'Another cellar or merchant in the UK or Europe',
    hint: 'Berry Bros. & Rudd, Justerini & Brooks or another bonded warehouse. We liaise with them directly.',
    isTransfer: true,
  },
  {
    value: 'with_cc',
    label: 'Already with Craft & Culture',
    hint: 'We will link it to your cellar account.',
    isTransfer: false,
  },
  {
    value: 'starting_fresh',
    label: 'Starting from scratch',
    hint: 'We will help you build your collection.',
    isTransfer: false,
  },
] as const;

export type WineSource = (typeof wineSources)[number]['value'];

export const WINE_SOURCE_VALUES = wineSources.map((source) => source.value) as [
  WineSource,
  ...WineSource[],
];

export default wineSources;
