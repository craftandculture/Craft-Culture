/** Where a member's wine is, as offered on the application */
const wineSources = [
  {
    value: 'uae_in_bond',
    label: 'Build my cellar from wine in bond here in the UAE',
    hint: 'Choose from what we already hold — nothing has to travel.',
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
    hint: 'BBR, Justerini & Brooks, a bonded warehouse — we contact them for you.',
    isTransfer: true,
  },
  {
    value: 'with_cc',
    label: 'Already with Craft & Culture',
    hint: 'We link it to your cellar.',
    isTransfer: false,
  },
  {
    value: 'starting_fresh',
    label: 'Starting from scratch',
    hint: 'We will help you build it.',
    isTransfer: false,
  },
] as const;

export type WineSource = (typeof wineSources)[number]['value'];

export const WINE_SOURCE_VALUES = wineSources.map((source) => source.value) as [
  WineSource,
  ...WineSource[],
];

export default wineSources;
