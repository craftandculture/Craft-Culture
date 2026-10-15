/** Where a member's wine is, as offered on the application */
const wineSources = [
  {
    value: 'uae_in_bond',
    label: 'Interested in wine available here in the UAE',
    hint: 'Browse wines held in bond in the UAE, and add any you choose to your cellar.',
    isTransfer: false,
  },
  {
    value: 'lcb',
    label: 'Wine held at LCB (UK bond)',
    hint: 'Should you wish, we can arrange a transfer into our account at LCB Burton.',
    isTransfer: true,
  },
  {
    value: 'uk_eu_cellar',
    label: 'Wine with another cellar or merchant in the UK or Europe',
    hint: 'Such as Berry Bros. & Rudd or Justerini & Brooks. Should you wish to bring it in, we can liaise with them on your behalf.',
    isTransfer: true,
  },
  {
    value: 'with_cc',
    label: 'Wine already with Craft & Culture',
    hint: 'We can show it in your cellar account.',
    isTransfer: false,
  },
  {
    value: 'starting_fresh',
    label: 'Just starting out',
    hint: 'We would be glad to help you build a collection, whenever you are ready.',
    isTransfer: false,
  },
] as const;

export type WineSource = (typeof wineSources)[number]['value'];

export const WINE_SOURCE_VALUES = wineSources.map((source) => source.value) as [
  WineSource,
  ...WineSource[],
];

export default wineSources;
