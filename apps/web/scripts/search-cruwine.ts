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

// CRU WINE invoice - established wines that should be in Liv-ex
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
  { description: 'Chateau Beau-Sejour Becot Premier Grand Cru Classe B, Saint-Emilion', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Bellefont-Belcier Grand Cru Classe, Saint-Emilion', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Berliquet Grand Cru Classe, Saint-Emilion Grand Cru', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Beychevelle', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Branaire-Ducru 4eme Cru Classe, Saint-Julien', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cantemerle 5eme Cru Classe, Haut-Medoc', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cantemerle 5eme Cru Classe, Haut-Medoc', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cantenac Brown 3eme Cru Classe, Margaux', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Chasse-Spleen, Moulis en Medoc', vintage: 2020, caseSize: 1, bottleSizeMl: 6000 },
  { description: 'Chateau Chasse-Spleen, Moulis en Medoc', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Chasse-Spleen, Moulis en Medoc', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Cheval Blanc Premier Grand Cru Classe A, Saint-Emilion', vintage: 2014, caseSize: 1, bottleSizeMl: 1500 },
  { description: 'Chateau Clerc Milon 5eme Cru Classe, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau d\'Armailhac 5eme Cru Classe, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau d\'Esclans, Rose Whispering Angel, Cotes de Provence', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau du Tertre 5eme Cru Classe, Margaux', vintage: 2011, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Figeac Premier Grand Cru Classe B, Saint-Emilion', vintage: 2004, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Figeac Premier Grand Cru Classe B, Saint-Emilion', vintage: 2016, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Figeac Premier Grand Cru Classe B, Saint-Emilion', vintage: 2017, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Figeac Premier Grand Cru Classe B, Saint-Emilion', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Fombrauge Grand Cru Classe, Saint-Emilion Grand Cru', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Gazin, Pomerol', vintage: 2017, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Giscours 3eme Cru Classe, Margaux', vintage: 2018, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Grand-Puy Ducasse 5eme Cru Classe, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Grand-Puy-Lacoste 5eme Cru Classe, Pauillac', vintage: 2017, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Haut-Bages Liberal 5eme Cru Classe, Pauillac', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Haut-Batailley 5eme Cru Classe, Pauillac', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau La Gaffeliere Premier Grand Cru Classe B, Saint-Emilion', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Labegorce, Margaux', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Lafon-Rochet 4eme Cru Classe, Saint-Estephe', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Lagrange 3eme Cru Classe, Saint-Julien', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Laroque Grand Cru Classe, Saint-Emilion Grand Cru', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Lascombes 2eme Cru Classe, Margaux', vintage: 2018, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Latour-Martillac, Blanc Cru Classe, Pessac-Leognan', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Leoville Barton 2eme Cru Classe, Saint-Julien', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Leoville Barton 2eme Cru Classe, Saint-Julien', vintage: 2021, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Leoville Poyferre 2eme Cru Classe, Saint-Julien', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Les Carmes Haut-Brion, Pessac-Leognan', vintage: 2017, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Lilian Ladouys, Saint-Estephe', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Lynch Bages 5eme Cru Classe, Pauillac', vintage: 2015, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Malartic Lagraviere Cru Classe, Pessac-Leognan', vintage: 2018, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Malescot St. Exupery 3eme Cru Classe, Margaux', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Marsau, Francs-Cotes de Bordeaux', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Meyney, Saint-Estephe', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Meyney, Saint-Estephe', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Nenin, Pomerol', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Nenin, Pomerol', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Ormes de Pez, Saint-Estephe', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Pedesclaux 5eme Cru Classe, Pauillac', vintage: 2018, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Pedesclaux 5eme Cru Classe, Pauillac', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Potensac, Medoc', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Prieure-Lichine 4eme Cru Classe, Margaux', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Quinault L\'Enclos Grand Cru Classe, Saint-Emilion', vintage: 2019, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Gassies 2eme Cru Classe, Margaux', vintage: 2015, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Gassies 2eme Cru Classe, Margaux', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Gassies 2eme Cru Classe, Margaux', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rauzan-Segla 2eme Cru Classe, Margaux', vintage: 2021, caseSize: 1, bottleSizeMl: 750 },
  { description: 'Chateau Rayas, Chateauneuf-du-Pape', vintage: 2012, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Rieussec Premier Cru Classe, Sauternes', vintage: 2018, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Rieussec Premier Cru Classe, Sauternes', vintage: 2019, caseSize: 4, bottleSizeMl: 750 },
  { description: 'Chateau Rouget, Pomerol', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Saint-Pierre 4eme Cru Classe, Saint-Julien', vintage: 2020, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Saint-Pierre 4eme Cru Classe, Saint-Julien', vintage: 2022, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Siran, Margaux', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Soutard-Cadet, Saint-Emilion Grand Cru', vintage: 2022, caseSize: 12, bottleSizeMl: 750 },
  { description: 'Chateau Talbot 4eme Cru Classe, Saint-Julien', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Troplong Mondot Premier Grand Cru Classe B, Saint-Emilion', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
  { description: 'Chateau Trotte Vieille Premier Grand Cru Classe B, Saint-Emilion', vintage: 2021, caseSize: 6, bottleSizeMl: 750 },
];

async function searchLwin(description: string) {
  // Extract the main château/producer name
  let searchTerm = description;

  // Clean up common patterns
  searchTerm = searchTerm.replace(/Premier Grand Cru Classe [AB],?/gi, '');
  searchTerm = searchTerm.replace(/Grand Cru Classe,?/gi, '');
  searchTerm = searchTerm.replace(/\d+eme Cru Classe,?/gi, '');
  searchTerm = searchTerm.replace(/Cru Classe,?/gi, '');
  searchTerm = searchTerm.replace(/, IGT$/i, '');
  searchTerm = searchTerm.replace(/, Toscana$/i, '');
  searchTerm = searchTerm.trim();

  const searchPattern = `%${searchTerm}%`;

  const results = await sql`
    SELECT
      lwin,
      display_name,
      producer_name,
      country,
      region
    FROM lwin_wines
    WHERE status = 'live'
      AND display_name ILIKE ${searchPattern}
    ORDER BY LENGTH(display_name)
    LIMIT 1
  `;

  return results[0] || null;
}

// More targeted search for châteaux
async function searchChateau(name: string) {
  // Extract just the château name
  let chateauName = name;

  // Remove classification info
  chateauName = chateauName.replace(/Premier Grand Cru Classe [AB],?/gi, '');
  chateauName = chateauName.replace(/Grand Cru Classe,?/gi, '');
  chateauName = chateauName.replace(/\d+eme Cru Classe,?/gi, '');
  chateauName = chateauName.replace(/Cru Classe,?/gi, '');

  // Remove appellation at end
  chateauName = chateauName.replace(/, Saint-Emilion.*$/i, '');
  chateauName = chateauName.replace(/, Pauillac.*$/i, '');
  chateauName = chateauName.replace(/, Margaux.*$/i, '');
  chateauName = chateauName.replace(/, Saint-Julien.*$/i, '');
  chateauName = chateauName.replace(/, Saint-Estephe.*$/i, '');
  chateauName = chateauName.replace(/, Pomerol.*$/i, '');
  chateauName = chateauName.replace(/, Haut-Medoc.*$/i, '');
  chateauName = chateauName.replace(/, Medoc.*$/i, '');
  chateauName = chateauName.replace(/, Pessac-Leognan.*$/i, '');
  chateauName = chateauName.replace(/, Sauternes.*$/i, '');
  chateauName = chateauName.replace(/, Cotes de Provence.*$/i, '');
  chateauName = chateauName.replace(/, Francs-Cotes de Bordeaux.*$/i, '');
  chateauName = chateauName.replace(/, Chateauneuf-du-Pape.*$/i, '');
  chateauName = chateauName.replace(/, Moulis en Medoc.*$/i, '');
  chateauName = chateauName.replace(/, Limoux.*$/i, '');

  chateauName = chateauName.trim();

  const searchPattern = `%${chateauName}%`;

  const results = await sql`
    SELECT
      lwin,
      display_name,
      producer_name,
      country,
      region
    FROM lwin_wines
    WHERE status = 'live'
      AND display_name ILIKE ${searchPattern}
    ORDER BY
      CASE WHEN display_name ILIKE ${chateauName + '%'} THEN 0 ELSE 1 END,
      LENGTH(display_name)
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
  console.log('=== CRU WINE Invoice - LWIN Matching ===\n');
  console.log('Testing against established Bordeaux/Italian wines that should be in Liv-ex\n');

  let matched = 0;
  let notFound = 0;
  const notFoundList: string[] = [];

  for (const item of invoiceItems) {
    // Try château search first
    let result = await searchChateau(item.description);

    // If not found, try full description
    if (!result) {
      result = await searchLwin(item.description);
    }

    if (result) {
      matched++;
      const r = result as any;
      const lwin18 = buildLwin18(r.lwin, item.vintage, item.caseSize, item.bottleSizeMl);
      console.log(`✅ ${item.description} (${item.vintage})`);
      console.log(`   → LWIN7: ${r.lwin} | LWIN18: ${lwin18}`);
      console.log(`   → Matched: "${r.display_name}"`);
      console.log('');
    } else {
      notFound++;
      notFoundList.push(`${item.description} (${item.vintage})`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log(`SUMMARY: ${matched}/${invoiceItems.length} matched (${Math.round(matched/invoiceItems.length*100)}%)`);
  console.log('='.repeat(100));

  if (notFoundList.length > 0) {
    console.log('\n❌ NOT FOUND:');
    for (const item of notFoundList) {
      console.log(`   • ${item}`);
    }
  }

  await sql.end();
  process.exit(0);
}

main().catch(console.error);
