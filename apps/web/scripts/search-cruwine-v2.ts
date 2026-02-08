/* eslint-disable */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DB_URL!, { ssl: 'require' });

interface InvoiceItem {
  description: string;
  vintage: number | null;
  caseSize: number;
  bottleSizeMl: number;
}

// CRU WINE invoice
const invoiceItems: InvoiceItem[] = [
  { description: 'Antinori (Castello della Sala), Bramito del Cervo, IGT', vintage: 2023, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Antinori (Guado Tasso), Bolgheri, Cont\'Ugo', vintage: 2013, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Antinori (Guado Tasso), Bolgheri, Cont\'Ugo', vintage: 2018, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Aromes de Pavie, Saint-Emilion Grand Cru', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Ata Rangi, Raranga Sauvignon Blanc, Martinborough', vintage: 2018, caseSize: 1, bottleSizeMl: 750 },
  { description: 'Baron\'Arques, Chardonnay, Limoux', vintage: 2016, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Bartolo Mascarello, Langhe, Nebbiolo delle', vintage: 2020, caseSize: 5, bottleSizeMl: 750 },
  { description: 'Bel Colle, Barbaresco', vintage: 2016, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Bertinga, Punta di Adine, Toscana', vintage: 2016, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Bertinga, Volta di Bertinga, Toscana', vintage: 2016, caseSize: 7, bottleSizeMl: 750 },
  { description: 'Bibi Graetz, Testamatta, IGT', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Brovia, Barbera d\'Alba, Sori Drago', vintage: 2016, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Bruno Giacosa, Nebbiolo d\'Alba', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Caiarossa, Caiarossa, IGT', vintage: 2018, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Carmes de Rieussec, Sauternes', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Castello Banfi, Brunello di Montalcino, Poggio Mura', vintage: 2016, caseSize: 3, bottleSizeMl: 750 },
  { description: 'Chateau Beauregard, Pomerol', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Beau-Sejour Becot, Saint-Emilion', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Bellefont-Belcier, Saint-Emilion', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Berliquet, Saint-Emilion Grand Cru', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Beychevelle, Saint-Julien', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Branaire-Ducru, Saint-Julien', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cantemerle, Haut-Medoc', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cantemerle, Haut-Medoc', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cantenac Brown, Margaux', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Chasse-Spleen, Moulis en Medoc', vintage: 2020, caseSize: 1, bottleSizeMl: 6000 },
  { description: 'Chateau Chasse-Spleen, Moulis en Medoc', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Chasse-Spleen, Moulis en Medoc', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cheval Blanc, Saint-Emilion', vintage: 2014, caseSize: 1, bottleSizeMl: 1500 },
  { description: 'Chateau Clerc Milon, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau d\'Armailhac, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau d\'Esclans, Whispering Angel, Rose', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau du Tertre, Margaux', vintage: 2011, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Figeac, Saint-Emilion', vintage: 2004, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Figeac, Saint-Emilion', vintage: 2016, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Figeac, Saint-Emilion', vintage: 2017, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Figeac, Saint-Emilion', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Fombrauge, Saint-Emilion Grand Cru', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Gazin, Pomerol', vintage: 2017, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Giscours, Margaux', vintage: 2018, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Grand-Puy Ducasse, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Grand-Puy-Lacoste, Pauillac', vintage: 2017, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Haut-Bages Liberal, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Haut-Batailley, Pauillac', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau La Gaffeliere, Saint-Emilion', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Labegorce, Margaux', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Lafon-Rochet, Saint-Estephe', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Lagrange, Saint-Julien', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Laroque, Saint-Emilion Grand Cru', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Lascombes, Margaux', vintage: 2018, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Latour-Martillac, Blanc, Pessac-Leognan', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Leoville Barton, Saint-Julien', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Leoville Barton, Saint-Julien', vintage: 2021, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Leoville Poyferre, Saint-Julien', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Les Carmes Haut-Brion, Pessac-Leognan', vintage: 2017, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Lilian Ladouys, Saint-Estephe', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Lynch-Bages, Pauillac', vintage: 2015, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Malartic Lagraviere, Pessac-Leognan', vintage: 2018, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Malescot St. Exupery, Margaux', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Marsau, Francs-Cotes de Bordeaux', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Meyney, Saint-Estephe', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Meyney, Saint-Estephe', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Nenin, Pomerol', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Nenin, Pomerol', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Ormes de Pez, Saint-Estephe', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Pedesclaux, Pauillac', vintage: 2018, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Pedesclaux, Pauillac', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Potensac, Medoc', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Prieure-Lichine, Margaux', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Quinault L\'Enclos, Saint-Emilion', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Gassies, Margaux', vintage: 2015, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Gassies, Margaux', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Gassies, Margaux', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Segla, Margaux', vintage: 2021, caseSize: 1, bottleSizeMl: 750 },
  { description: 'Chateau Rayas, Chateauneuf-du-Pape', vintage: 2012, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Rieussec, Sauternes', vintage: 2018, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rieussec, Sauternes', vintage: 2019, caseSize: 4, bottleSizeMl: 750 },
  { description: 'Chateau Rouget, Pomerol', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Saint-Pierre, Saint-Julien', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Saint-Pierre, Saint-Julien', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Siran, Margaux', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Soutard-Cadet, Saint-Emilion Grand Cru', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Talbot, Saint-Julien', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Troplong Mondot, Saint-Emilion', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Trotte Vieille, Saint-Emilion', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
];

// Extract château name for search
function extractChateauName(description: string): string {
  // For Chateau wines, extract "Chateau X" before the comma
  if (description.startsWith('Chateau ')) {
    const match = description.match(/^(Chateau [^,]+)/);
    if (match) return match[1];
  }
  // For non-château wines, use the producer name before first comma
  const parts = description.split(',');
  return parts[0].trim();
}

async function searchByName(name: string) {
  // Search with the exact name as a prefix
  const results = await sql`
    SELECT lwin, display_name, producer_name, region, country
    FROM lwin_wines
    WHERE status = 'live'
      AND display_name ILIKE ${name + '%'}
    ORDER BY LENGTH(display_name)
    LIMIT 1
  `;

  if (results.length > 0) return results[0];

  // Fallback: search with name anywhere
  const results2 = await sql`
    SELECT lwin, display_name, producer_name, region, country
    FROM lwin_wines
    WHERE status = 'live'
      AND display_name ILIKE ${'%' + name + '%'}
    ORDER BY
      CASE WHEN display_name ILIKE ${name + '%'} THEN 0 ELSE 1 END,
      LENGTH(display_name)
    LIMIT 1
  `;

  return results2[0] || null;
}

function buildLwin18(lwin7: string, vintage: number | null, caseSize: number, bottleSizeMl: number): string {
  const vintageStr = vintage ? String(vintage).padStart(4, '0') : '0000';
  const caseSizeStr = String(caseSize).padStart(2, '0');
  const bottleSizeStr = String(bottleSizeMl).padStart(5, '0');
  return `${lwin7}${vintageStr}${caseSizeStr}${bottleSizeStr}`;
}

async function main() {
  console.log('=== CRU WINE Invoice - LWIN Matching v2 ===\n');

  let matched = 0;
  let notFound = 0;
  const notFoundList: string[] = [];
  const matchedList: { desc: string; lwin7: string; lwin18: string; match: string }[] = [];

  for (const item of invoiceItems) {
    const searchName = extractChateauName(item.description);
    const result = await searchByName(searchName);

    if (result) {
      matched++;
      const r = result as any;
      const lwin18 = buildLwin18(r.lwin, item.vintage, item.caseSize, item.bottleSizeMl);
      matchedList.push({
        desc: `${item.description} (${item.vintage})`,
        lwin7: r.lwin,
        lwin18,
        match: r.display_name,
      });
    } else {
      notFound++;
      notFoundList.push(`${item.description} (${item.vintage}) - searched: "${searchName}"`);
    }
  }

  // Summary first
  console.log('='.repeat(100));
  console.log(`SUMMARY: ${matched}/${invoiceItems.length} matched (${Math.round(matched/invoiceItems.length*100)}%)`);
  console.log('='.repeat(100));

  if (notFoundList.length > 0) {
    console.log('\n❌ NOT FOUND (' + notFoundList.length + '):');
    for (const item of notFoundList) {
      console.log(`   • ${item}`);
    }
  }

  console.log('\n\n✅ MATCHED (' + matchedList.length + '):');
  for (const item of matchedList) {
    console.log(`\n${item.desc}`);
    console.log(`   LWIN7: ${item.lwin7} | LWIN18: ${item.lwin18}`);
    console.log(`   → ${item.match}`);
  }

  await sql.end();
  process.exit(0);
}

main().catch(console.error);
