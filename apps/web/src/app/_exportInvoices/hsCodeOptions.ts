/**
 * HS codes offered on an export invoice, with what each covers
 *
 * The same eleven the shipment page assigns, named for a customs reader.
 * Anything else can still be typed as a custom code.
 */
const hsCodeOptions = [
  { code: '22042100', name: 'Wine, still (≤ 2 L)' },
  { code: '22041000', name: 'Wine, sparkling' },
  { code: '22083000', name: 'Whisky' },
  { code: '22082000', name: 'Brandy / Cognac' },
  { code: '22084000', name: 'Rum' },
  { code: '22085000', name: 'Gin' },
  { code: '22086000', name: 'Vodka' },
  { code: '22087000', name: 'Liqueurs' },
  { code: '22089090', name: 'Tequila / other spirits' },
  { code: '22030000', name: 'Beer' },
  { code: '22060000', name: 'Cider / other fermented' },
] as const;

export default hsCodeOptions;
