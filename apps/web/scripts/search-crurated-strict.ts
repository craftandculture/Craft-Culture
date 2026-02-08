/* eslint-disable */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DB_URL!, { ssl: 'require' });

interface InvoiceItem {
  description: string;
  producer: string;
  wine: string;
  vintage: number | null;
  bottleSizeMl: number;
}

// Full CRURATED invoice - structured for strict matching
const invoiceItems: InvoiceItem[] = [
  // Original list
  { description: 'François Thienpont Terre Elysée 2021', producer: 'Thienpont', wine: 'Terre Elysee', vintage: 2021, bottleSizeMl: 750 },
  { description: 'RUM Dictador x Crurated 1999', producer: 'Dictador', wine: 'Single Cask', vintage: 1999, bottleSizeMl: 700 },
  { description: 'Davide Fregonese Barolo Prapò 2019', producer: 'Fregonese', wine: 'Prapo', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Masseria Alfano Fiano Gheppio 2020', producer: 'Masseria Alfano', wine: 'Gheppio', vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine Lafouge Meursault Meix-Chavaux 2022', producer: 'Lafouge', wine: 'Meix-Chavaux', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Theo Dancer Jurassic Savagnin 2023', producer: 'Theo Dancer', wine: 'Savagnin', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Masseria Alfano Fiano Gheppio 2021', producer: 'Masseria Alfano', wine: 'Gheppio', vintage: 2021, bottleSizeMl: 750 },
  { description: 'Étienne Calsac Les Revenants 2020', producer: 'Calsac', wine: 'Revenants', vintage: 2020, bottleSizeMl: 750 },
  { description: 'Sylvain Cathiard Hautes-Côtes de Nuits 2022', producer: 'Cathiard', wine: 'Hautes-Cotes', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Valentin Leflaive Grand Cru Avize', producer: 'Leflaive', wine: 'Avize', vintage: null, bottleSizeMl: 750 },
  { description: 'Vilmart Grand Cellier 1er Cru', producer: 'Vilmart', wine: 'Grand Cellier', vintage: null, bottleSizeMl: 750 },
  { description: 'Chavy-Chouet Bourgogne Rouge La Taupe 2023', producer: 'Chavy-Chouet', wine: 'Taupe', vintage: 2023, bottleSizeMl: 750 },
  { description: 'San Polo Brunello di Montalcino 2019', producer: 'San Polo', wine: 'Brunello', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Racines Sparkling Grand Reserve NV', producer: 'Racines', wine: 'Sparkling', vintage: null, bottleSizeMl: 750 },
  { description: 'Cantina dell\'Angelo Torrefavale 2022', producer: 'Cantina Angelo', wine: 'Torrefavale', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Racines Wenzlau Chardonnay 2022', producer: 'Racines', wine: 'Wenzlau', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Federico Graziani Etna Rosso di Mezzo 2021', producer: 'Graziani', wine: 'Rosso di Mezzo', vintage: 2021, bottleSizeMl: 750 },
  { description: 'Michel Naddef Fixin Vieille Vigne 2023', producer: 'Naddef', wine: 'Fixin', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Cantina del Barone Fiano d\'Avellino 2022', producer: 'Cantina del Barone', wine: 'Fiano', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Arnaud Mortet Gevrey-Chambertin Ma Cuvée 2020', producer: 'Mortet', wine: 'Ma Cuvee', vintage: 2020, bottleSizeMl: 750 },
  { description: 'Antonio Di Mauro Etna Bianco 2023', producer: 'Di Mauro', wine: 'Etna Bianco', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Domaine Lafouge Pommard Les Noizons 2022', producer: 'Lafouge', wine: 'Noizons', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Domaine Fourrier Gevrey-Chambertin 2023', producer: 'Fourrier', wine: 'Gevrey-Chambertin', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Pierre & Anne Boisson Murgey de Limozin 2020', producer: 'Boisson', wine: 'Murgey', vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine Fourrier Gevrey-Chambertin Champeaux 2023', producer: 'Fourrier', wine: 'Champeaux', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Domaine Lafouge Auxey-Duresses La Macabrée 2022', producer: 'Lafouge', wine: 'Macabree', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Pierre Girardin Savagnin Blanc 2021', producer: 'Girardin', wine: 'Savagnin', vintage: 2021, bottleSizeMl: 750 },
  { description: 'Domaine de Montille Bourgogne Blanc Clos du Château 2022', producer: 'Montille', wine: 'Clos du Chateau', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Vincent Dancer Bourgogne Blanc 2023', producer: 'Vincent Dancer', wine: 'Bourgogne Blanc', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Jane Eyre Bourgogne Rouge 2023', producer: 'Jane Eyre', wine: 'Bourgogne', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Hubert Lignier Grand Chaliot 2023', producer: 'Lignier', wine: 'Chaliot', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Poggio Di Sotto Brunello di Montalcino 2019', producer: 'Poggio Di Sotto', wine: 'Brunello', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Masseria Alfano Greco di Tufo Il Bosco 2022', producer: 'Masseria Alfano', wine: 'Bosco', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Tormaresca Primitivo di Manduria Carrubo 2019', producer: 'Tormaresca', wine: 'Carrubo', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Davide Fregonese Barolo Cerretta 2019', producer: 'Fregonese', wine: 'Cerretta', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Tormaresca Castel del Monte Bocca di Lupo 2019', producer: 'Tormaresca', wine: 'Bocca di Lupo', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Château Puygueraud Rouge 2019', producer: 'Puygueraud', wine: 'Rouge', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Bambinuto Greco di Tufo Rafilù 2019', producer: 'Bambinuto', wine: 'Rafilu', vintage: 2019, bottleSizeMl: 750 },
  { description: 'Di Meo Greco di Tufo Vittorio 2008', producer: 'Di Meo', wine: 'Vittorio', vintage: 2008, bottleSizeMl: 750 },
  { description: 'Armand Heitz Bourgogne Blanc 2023', producer: 'Armand Heitz', wine: 'Bourgogne Blanc', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Tormaresca Fiano Bocca di Lupo 2021', producer: 'Tormaresca', wine: 'Fiano', vintage: 2021, bottleSizeMl: 750 },
  { description: 'Tormaresca Fiano Bocca di Lupo 2020', producer: 'Tormaresca', wine: 'Fiano', vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine de Montille Chassagne-Montrachet 2022', producer: 'Montille', wine: 'Chassagne', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Antonio Di Mauro Etna Rosso 2020', producer: 'Di Mauro', wine: 'Etna Rosso', vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine de Montille Bourgogne Rouge 2021', producer: 'Montille', wine: 'Bourgogne Rouge', vintage: 2021, bottleSizeMl: 750 },
  { description: 'Armand Heitz Beaune Rouge 2021', producer: 'Armand Heitz', wine: 'Beaune', vintage: 2021, bottleSizeMl: 750 },
  { description: 'Vincent Dancer Hautes-Côtes Blanc 2023', producer: 'Vincent Dancer', wine: 'Hautes-Cotes', vintage: 2023, bottleSizeMl: 750 },
  { description: 'Giuseppe Cortese Barbaresco 2020', producer: 'Giuseppe Cortese', wine: 'Barbaresco', vintage: 2020, bottleSizeMl: 750 },
  { description: 'Dehours Maisoncelle Réserve Perpétuelle', producer: 'Dehours', wine: 'Maisoncelle', vintage: null, bottleSizeMl: 750 },
  { description: 'Valentin Leflaive Champagne Sigma 20', producer: 'Leflaive', wine: 'Sigma', vintage: null, bottleSizeMl: 750 },
  { description: 'Vincent Dancer Beaune 1er Cru Montrevenots 2023', producer: 'Vincent Dancer', wine: 'Montrevenots', vintage: 2023, bottleSizeMl: 750 },
  // Additional items from second image
  { description: 'Di Meo Greco di Tufo Riserva Vittorio 2008 (Magnum)', producer: 'Di Meo', wine: 'Vittorio', vintage: 2008, bottleSizeMl: 1500 },
  { description: 'Armand Heitz Saint Aubin 1er Cru Murgers des Dents de Chien 2018', producer: 'Armand Heitz', wine: 'Murgers Dents Chien', vintage: 2018, bottleSizeMl: 750 },
  { description: 'Dehours Brisefer Réserve Perpétuelle', producer: 'Dehours', wine: 'Brisefer', vintage: null, bottleSizeMl: 750 },
  { description: 'Racines Santa Rosa Hills Sainte-Rose Pinot Noir 2022', producer: 'Racines', wine: 'Sainte-Rose', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Hubert Lignier Morey-Saint-Denis Trilogie 2021', producer: 'Lignier', wine: 'Trilogie', vintage: 2021, bottleSizeMl: 750 },
  { description: 'Domaine Lafouge Meursault Clos de Rougeot 2022', producer: 'Lafouge', wine: 'Rougeot', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Domaine de Montille Bourgogne Blanc 2022', producer: 'Montille', wine: 'Bourgogne Blanc', vintage: 2022, bottleSizeMl: 750 },
  { description: 'Valentin Leflaive Grand Cru Verzenay 20', producer: 'Leflaive', wine: 'Verzenay', vintage: null, bottleSizeMl: 750 },
];

// Search for exact wine match
async function searchExactWine(producer: string, wine: string) {
  const producerPattern = `%${producer}%`;
  const winePattern = `%${wine}%`;

  const results = await sql`
    SELECT
      lwin,
      display_name,
      producer_name,
      wine as wine_name,
      country,
      region
    FROM lwin_wines
    WHERE status = 'live'
      AND producer_name ILIKE ${producerPattern}
      AND (wine ILIKE ${winePattern} OR display_name ILIKE ${winePattern})
    ORDER BY LENGTH(display_name)
    LIMIT 3
  `;

  return results;
}

// Search for producer only
async function searchProducerOnly(producer: string) {
  const producerPattern = `%${producer}%`;

  const results = await sql`
    SELECT
      lwin,
      display_name,
      producer_name,
      wine as wine_name,
      country,
      region
    FROM lwin_wines
    WHERE status = 'live'
      AND producer_name ILIKE ${producerPattern}
    ORDER BY LENGTH(display_name)
    LIMIT 5
  `;

  return results;
}

function buildLwin18(lwin7: string, vintage: number | null, caseSize: number, bottleSizeMl: number): string {
  const vintageStr = vintage ? String(vintage).padStart(4, '0') : '0000';
  const caseSizeStr = String(caseSize).padStart(2, '0');
  const bottleSizeStr = String(bottleSizeMl).padStart(5, '0');
  return `${lwin7}${vintageStr}${caseSizeStr}${bottleSizeStr}`;
}

interface Result {
  description: string;
  status: 'EXACT_MATCH' | 'PRODUCER_ONLY' | 'NOT_FOUND';
  lwin7?: string;
  lwin18?: string;
  matchedName?: string;
  producerWines?: string[];
}

async function main() {
  console.log('=== CRURATED Invoice - STRICT LWIN Matching ===\n');
  console.log('We will NOT guess. Only exact matches will be suggested.\n');

  const results: Result[] = [];

  for (const item of invoiceItems) {
    // First try exact match (producer + wine)
    const exactMatches = await searchExactWine(item.producer, item.wine);

    if (exactMatches.length > 0) {
      const match = exactMatches[0] as any;
      const lwin18 = buildLwin18(match.lwin, item.vintage, 6, item.bottleSizeMl);
      results.push({
        description: item.description,
        status: 'EXACT_MATCH',
        lwin7: match.lwin,
        lwin18,
        matchedName: match.display_name,
      });
    } else {
      // Check if producer exists at all
      const producerMatches = await searchProducerOnly(item.producer);

      if (producerMatches.length > 0) {
        results.push({
          description: item.description,
          status: 'PRODUCER_ONLY',
          producerWines: producerMatches.slice(0, 3).map((m: any) => m.display_name),
        });
      } else {
        results.push({
          description: item.description,
          status: 'NOT_FOUND',
        });
      }
    }
  }

  // Print results by category
  const exact = results.filter(r => r.status === 'EXACT_MATCH');
  const producerOnly = results.filter(r => r.status === 'PRODUCER_ONLY');
  const notFound = results.filter(r => r.status === 'NOT_FOUND');

  console.log('='.repeat(100));
  console.log(`SUMMARY: ${exact.length} exact | ${producerOnly.length} producer only | ${notFound.length} not found`);
  console.log('='.repeat(100));

  console.log('\n\n✅ EXACT MATCHES - Safe to use these LWIN18 codes');
  console.log('='.repeat(100));
  for (const r of exact) {
    console.log(`\n${r.description}`);
    console.log(`  LWIN7: ${r.lwin7}`);
    console.log(`  LWIN18: ${r.lwin18}`);
    console.log(`  Matched: "${r.matchedName}"`);
  }

  console.log('\n\n⚠️  PRODUCER EXISTS - Wine not in database (needs manual lookup or custom SKU)');
  console.log('='.repeat(100));
  for (const r of producerOnly) {
    console.log(`\n${r.description}`);
    console.log(`  Producer wines in Liv-ex:`);
    for (const wine of r.producerWines || []) {
      console.log(`    - ${wine}`);
    }
  }

  console.log('\n\n❌ NOT IN DATABASE - Producer not found (definitely needs custom SKU)');
  console.log('='.repeat(100));
  for (const r of notFound) {
    console.log(`  • ${r.description}`);
  }

  await sql.end();
  process.exit(0);
}

main().catch(console.error);
