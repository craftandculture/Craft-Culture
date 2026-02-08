/* eslint-disable */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DB_URL!, { ssl: 'require' });

interface InvoiceItem {
  description: string;
  searchTerms: string[];
  vintage: number | null;
  bottleSizeMl: number;
}

// Full CRURATED invoice list
const invoiceItems: InvoiceItem[] = [
  { description: 'François Thienpont Terre Elysée 2021', searchTerms: ['Thienpont', 'Terre Elysee'], vintage: 2021, bottleSizeMl: 750 },
  { description: 'RUM Dictador x Crurated 1999', searchTerms: ['Dictador'], vintage: 1999, bottleSizeMl: 700 },
  { description: 'Davide Fregonese Barolo DOCG Prapò 2019', searchTerms: ['Fregonese Barolo Prapo', 'Fregonese Prapo'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Masseria Alfano Fiano d\'Avellino Gheppio 2020', searchTerms: ['Masseria Alfano', 'Alfano Gheppio'], vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine Lafouge Meursault Les Meix-Chavaux 2022', searchTerms: ['Lafouge Meursault'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Theo Dancer Jurassic Savagnin 2023', searchTerms: ['Theo Dancer Savagnin', 'Theo Dancer'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Masseria Alfano Fiano d\'Avellino Gheppio 2021', searchTerms: ['Masseria Alfano', 'Alfano Gheppio'], vintage: 2021, bottleSizeMl: 750 },
  { description: 'Étienne Calsac Champagne Les Revenants 2020', searchTerms: ['Calsac Revenants'], vintage: 2020, bottleSizeMl: 750 },
  { description: 'Sylvain Cathiard Hautes-Côtes de Nuits 2022', searchTerms: ['Cathiard Hautes-Cotes', 'Sylvain Cathiard'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Valentin Leflaive Champagne Grand Cru Avize', searchTerms: ['Leflaive Avize', 'Valentin Leflaive'], vintage: null, bottleSizeMl: 750 },
  { description: 'Vilmart & Cie Grand Cellier 1er Cru', searchTerms: ['Vilmart Grand Cellier', 'Vilmart'], vintage: null, bottleSizeMl: 750 },
  { description: 'Domaine Chavy-Chouet Bourgogne Rouge La Taupe 2023', searchTerms: ['Chavy-Chouet', 'Chavy Chouet Taupe'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'San Polo Brunello di Montalcino 2019', searchTerms: ['San Polo Brunello'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Racines Sparkling Grand Reserve NV', searchTerms: ['Racines Sparkling', 'Racines'], vintage: null, bottleSizeMl: 750 },
  { description: 'Cantina dell\'Angelo Torrefavale 2022', searchTerms: ['Cantina Angelo', 'Torrefavale'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Racines Wenzlau Chardonnay 2022', searchTerms: ['Racines Wenzlau', 'Racines Chardonnay'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Federico Graziani Etna Rosso Rosso di Mezzo 2021', searchTerms: ['Graziani Etna', 'Federico Graziani'], vintage: 2021, bottleSizeMl: 750 },
  { description: 'Michel Naddef Fixin Vieille Vigne 2023', searchTerms: ['Naddef Fixin', 'Michel Naddef'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Cantina del Barone Fiano d\'Avellino 2022', searchTerms: ['Cantina Barone Fiano', 'Cantina del Barone'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Arnaud Mortet Gevrey-Chambertin Ma Cuvée 2020', searchTerms: ['Mortet Gevrey', 'Arnaud Mortet'], vintage: 2020, bottleSizeMl: 750 },
  { description: 'Antonio Di Mauro Etna DOC Bianco 2023', searchTerms: ['Di Mauro Etna', 'Antonio Di Mauro'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Domaine Lafouge Pommard Les Noizons 2022', searchTerms: ['Lafouge Pommard', 'Lafouge Noizons'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Domaine Fourrier Gevrey-Chambertin 2023', searchTerms: ['Fourrier Gevrey'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Domaine Pierre & Anne Boisson Bourgogne Blanc Murgey 2020', searchTerms: ['Boisson Murgey', 'Pierre Boisson'], vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine Fourrier Gevrey-Chambertin 1er Cru Champeaux 2023', searchTerms: ['Fourrier Champeaux'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Domaine Lafouge Auxey-Duresses La Macabrée 2022', searchTerms: ['Lafouge Auxey', 'Lafouge Macabree'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Pierre Girardin Savagnin Blanc 2021', searchTerms: ['Girardin Savagnin', 'Pierre Girardin'], vintage: 2021, bottleSizeMl: 750 },
  { description: 'Domaine de Montille Bourgogne Blanc Le Clos du Château 2022', searchTerms: ['Montille Clos Chateau', 'Montille Bourgogne Blanc'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Vincent Dancer Bourgogne Blanc 2023', searchTerms: ['Vincent Dancer Bourgogne Blanc'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Jane Eyre Bourgogne Rouge 2023', searchTerms: ['Jane Eyre Bourgogne', 'Jane Eyre'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Hubert Lignier Bourgogne Pinot Noir Grand Chaliot 2023', searchTerms: ['Lignier Chaliot', 'Hubert Lignier'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Poggio Di Sotto Brunello di Montalcino 2019', searchTerms: ['Poggio Di Sotto Brunello'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Masseria Alfano Greco di Tufo Il Bosco 2022', searchTerms: ['Masseria Alfano Greco', 'Alfano Bosco'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Tormaresca Primitivo di Manduria Carrubo 2019', searchTerms: ['Tormaresca Primitivo', 'Tormaresca Carrubo'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Davide Fregonese Barolo DOCG Cerretta 2019', searchTerms: ['Fregonese Cerretta', 'Fregonese Barolo'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Tormaresca Castel del Monte Bocca di Lupo 2019', searchTerms: ['Tormaresca Bocca Lupo', 'Bocca di Lupo'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Château Puygueraud Rouge 2019', searchTerms: ['Puygueraud'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Bambinuto Greco di Tufo Riserva Rafilù 2019', searchTerms: ['Bambinuto', 'Rafilu'], vintage: 2019, bottleSizeMl: 750 },
  { description: 'Di Meo Greco di Tufo Riserva Vittorio 2008', searchTerms: ['Di Meo Greco', 'Di Meo Vittorio'], vintage: 2008, bottleSizeMl: 1500 },
  { description: 'Armand Heitz Bourgogne Blanc 2023', searchTerms: ['Armand Heitz Bourgogne Blanc', 'Armand Heitz'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Tormaresca Puglia IGT Fiano Bocca di Lupo 2021', searchTerms: ['Tormaresca Fiano'], vintage: 2021, bottleSizeMl: 750 },
  { description: 'Tormaresca Puglia IGT Fiano Bocca di Lupo 2020', searchTerms: ['Tormaresca Fiano'], vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine de Montille Chassagne-Montrachet 2022', searchTerms: ['Montille Chassagne'], vintage: 2022, bottleSizeMl: 750 },
  { description: 'Antonio Di Mauro Etna DOC Rosso 2020', searchTerms: ['Di Mauro Etna Rosso'], vintage: 2020, bottleSizeMl: 750 },
  { description: 'Domaine de Montille Bourgogne Rouge 2021', searchTerms: ['Montille Bourgogne Rouge'], vintage: 2021, bottleSizeMl: 750 },
  { description: 'Armand Heitz Beaune Rouge 2021', searchTerms: ['Armand Heitz Beaune', 'Heitz Beaune'], vintage: 2021, bottleSizeMl: 750 },
  { description: 'Vincent Dancer Hautes-Côtes Blanc 2023', searchTerms: ['Vincent Dancer Hautes'], vintage: 2023, bottleSizeMl: 750 },
  { description: 'Giuseppe Cortese Barbaresco 2020', searchTerms: ['Giuseppe Cortese Barbaresco', 'Cortese Barbaresco'], vintage: 2020, bottleSizeMl: 750 },
  { description: 'Dehours & Fils Champagne Maisoncelle Réserve Perpétuelle', searchTerms: ['Dehours Maisoncelle', 'Dehours'], vintage: null, bottleSizeMl: 750 },
  { description: 'Valentin Leflaive Champagne Sigma 20', searchTerms: ['Leflaive Sigma', 'Valentin Leflaive'], vintage: null, bottleSizeMl: 750 },
  { description: 'Vincent Dancer Beaune 1er Cru Montrevenots 2023', searchTerms: ['Dancer Montrevenots', 'Dancer Beaune'], vintage: 2023, bottleSizeMl: 750 },
];

async function searchLwin(searchTerm: string) {
  const searchPattern = `%${searchTerm}%`;

  const results = await sql`
    SELECT
      lwin,
      display_name,
      producer_name,
      wine,
      country,
      region
    FROM lwin_wines
    WHERE status = 'live'
      AND (
        display_name ILIKE ${searchPattern}
        OR producer_name ILIKE ${searchPattern}
        OR wine ILIKE ${searchPattern}
      )
    ORDER BY LENGTH(display_name)
    LIMIT 1
  `;

  return results[0] || null;
}

function buildLwin18(lwin7: string, vintage: number | null, caseSize: number, bottleSizeMl: number): string {
  const vintageStr = vintage ? String(vintage).padStart(4, '0') : '0000';
  const caseSizeStr = String(caseSize).padStart(2, '0');
  const bottleSizeStr = String(bottleSizeMl).padStart(5, '0');
  return `${lwin7}${vintageStr}${caseSizeStr}${bottleSizeStr}`;
}

async function main() {
  console.log('=== CRURATED Full Invoice LWIN Lookup ===\n');

  const results: { description: string; status: string; lwin7?: string; lwin18?: string; matchedName?: string }[] = [];

  for (const item of invoiceItems) {
    let found = false;
    let matchResult: any = null;

    for (const term of item.searchTerms) {
      if (found) break;
      matchResult = await searchLwin(term);
      if (matchResult) {
        found = true;
      }
    }

    if (found && matchResult) {
      const lwin18 = buildLwin18(matchResult.lwin, item.vintage, 6, item.bottleSizeMl);
      results.push({
        description: item.description,
        status: '✓ FOUND',
        lwin7: matchResult.lwin,
        lwin18,
        matchedName: matchResult.display_name,
      });
    } else {
      results.push({
        description: item.description,
        status: '✗ NOT FOUND',
      });
    }
  }

  // Print summary
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(100));
  console.log('');

  const found = results.filter(r => r.status === '✓ FOUND');
  const notFound = results.filter(r => r.status === '✗ NOT FOUND');

  console.log(`MATCHED: ${found.length}/${results.length} (${Math.round(found.length/results.length*100)}%)`);
  console.log(`NOT FOUND: ${notFound.length}/${results.length}`);
  console.log('');

  console.log('='.repeat(100));
  console.log('MATCHED WINES - Ready to use LWIN18');
  console.log('='.repeat(100));
  for (const r of found) {
    console.log(`\n${r.description}`);
    console.log(`  → LWIN7: ${r.lwin7} | LWIN18: ${r.lwin18}`);
    console.log(`  → Matched: ${r.matchedName}`);
  }

  console.log('\n');
  console.log('='.repeat(100));
  console.log('NOT IN LIV-EX DATABASE - Need manual SKU');
  console.log('='.repeat(100));
  for (const r of notFound) {
    console.log(`  • ${r.description}`);
  }

  await sql.end();
  process.exit(0);
}

main().catch(console.error);
