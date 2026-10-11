import classifyHsCode from '@/app/_exportInvoices/utils/classifyHsCode';

/** Spirit headings on the HS menu, most specific word first */
const SPIRITS: [RegExp, string][] = [
  [/\b(tequila|mezcal)\b/, '22089090'],
  [/\b(cognac|armagnac|brandy)\b/, '22082000'],
  [/\brum\b/, '22084000'],
  [/\bgin\b|old tom/, '22085000'],
  [/\bvodka\b/, '22086000'],
  [/\bliqueur\b/, '22087000'],
  [/\b(whisky|whiskey|bourbon|scotch|single malt|blended malt)\b/, '22083000'],
];

/**
 * The HS menu code for an item, from its name, when no shipment assigned one
 *
 * Still and sparkling wine as the export invoices classify them; each spirit
 * under its own heading on the menu (rum 22084000, gin 22085000, …).
 *
 * @example
 *   hsCodeForName('Bandida, Mezcal - Blanco'); // '22089090'
 *   hsCodeForName('Taittinger Comtes de Champagne 2013'); // '22041000'
 *
 * @param name - Item or product name, producer included
 * @returns An eight-digit code from the HS menu
 */
const hsCodeForName = (name: string) => {
  const t = name.toLowerCase();
  const spirit = SPIRITS.find(([re]) => re.test(t));
  return spirit ? spirit[1] : classifyHsCode(name);
};

export default hsCodeForName;
