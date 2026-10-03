export type DrinkCategory = 'wine' | 'sparkling' | 'spirits' | 'rtd';

/*
  Read from the product name because that is all the distributor's feed
  carries — no category field, and half its lines reach no product of ours to
  look one up on. Their names are descriptive enough: "Funkin Piña Colada
  Nitro (12-pack)", "Brother's Bond Bourbon", "Krug Grande Cuvée Brut".

  Checked in order, ready-to-drink first, because an RTD often names the
  spirit it is made with ("Passion Fruit Martini", "Gin & Tonic") and would
  otherwise read as that spirit.
*/
const RTD =
  /\b(funkin|nitro|cocktails?|spritz|seltzer|highball|rtd|ready[\s-]to[\s-]drink|cans?|\d+\s*-?\s*pack|margarita|mojito|daiquiri|martini|pi[ñn]a colada|g\s*&\s*t)\b/i;

const SPIRITS =
  /\b(whisk(e)?y|bourbon|scotch|single malt|blended malt|rye|gin|old tom|vodka|rum|rhum|tequila|mezcal|cognac|armagnac|calvados|brandy|grappa|liqueur|amaro|absinthe|baijiu|shochu)\b/i;

const SPARKLING =
  /\b(champagne|cr[ée]mant|prosecco|cava|franciacorta|sparkling|brut|extra brut|blanc de (blancs|noirs)|p[ée]t[\s-]nat|krug|dom p[ée]rignon|cristal|ruinart|bollinger|taittinger|billecart|piper[\s-]heidsieck|charles heidsieck|larmandier|vilmart|jacquesson|selosse|egly[\s-]ouriet|laurent[\s-]perrier|mo[eë]t|veuve clicquot|pol roger|philipponnat|deutz|gosset|henriot|perrier[\s-]jou[eë]t|salon)\b/i;

/**
 * Sort a drink into wine, sparkling, spirits or ready-to-drink by its name
 *
 * Anything not recognised as RTD, a spirit or sparkling is wine: fortified
 * wines, sweet wines and anything unusual land there, which is where a reader
 * filtering for "wine" would look for them.
 *
 * @example
 *   classifyDrink('Funkin Passion Fruit Martini Nitro (12-pack)'); // 'rtd'
 *   classifyDrink('Elio Grasso Barolo Ginestra Casa Mate 2020'); // 'wine'
 *
 * @param name - The product name as the outlet lists it
 * @returns The category
 */
const classifyDrink = (name: string): DrinkCategory => {
  if (RTD.test(name)) return 'rtd';
  if (SPIRITS.test(name)) return 'spirits';
  if (SPARKLING.test(name)) return 'sparkling';

  return 'wine';
};

export default classifyDrink;
