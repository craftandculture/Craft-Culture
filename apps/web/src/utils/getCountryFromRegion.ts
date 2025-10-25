/**
 * Maps wine regions to their corresponding countries
 *
 * @example
 *   getCountryFromRegion('Bordeaux'); // returns 'France'
 *   getCountryFromRegion('Napa Valley'); // returns 'USA'
 *
 * @param region - The wine region name
 * @param producer - Optional producer name for additional context
 * @returns The country name or null if unknown
 */
const getCountryFromRegion = (
  region: string | null | undefined,
  producer?: string | null,
) => {
  if (!region) {
    return null;
  }

  const normalizedRegion = region.toLowerCase().trim();
  const normalizedProducer = producer?.toLowerCase().trim() ?? '';

  // France
  if (
    normalizedRegion.includes('bordeaux') ||
    normalizedRegion.includes('burgundy') ||
    normalizedRegion.includes('bourgogne') ||
    normalizedRegion.includes('champagne') ||
    normalizedRegion.includes('rhone') ||
    normalizedRegion.includes('rhône') ||
    normalizedRegion.includes('loire') ||
    normalizedRegion.includes('alsace') ||
    normalizedRegion.includes('provence') ||
    normalizedRegion.includes('languedoc') ||
    normalizedRegion.includes('roussillon') ||
    normalizedRegion.includes('beaujolais') ||
    normalizedRegion.includes('jura') ||
    normalizedRegion.includes('savoie') ||
    normalizedRegion.includes('corsica') ||
    normalizedRegion.includes('corse') ||
    normalizedRegion.includes('france')
  ) {
    return 'France';
  }

  // Italy
  if (
    normalizedRegion.includes('tuscany') ||
    normalizedRegion.includes('toscana') ||
    normalizedRegion.includes('piedmont') ||
    normalizedRegion.includes('piemonte') ||
    normalizedRegion.includes('veneto') ||
    normalizedRegion.includes('sicily') ||
    normalizedRegion.includes('sicilia') ||
    normalizedRegion.includes('friuli') ||
    normalizedRegion.includes('umbria') ||
    normalizedRegion.includes('campania') ||
    normalizedRegion.includes('puglia') ||
    normalizedRegion.includes('lombardy') ||
    normalizedRegion.includes('lombardia') ||
    normalizedRegion.includes('abruzzo') ||
    normalizedRegion.includes('marche') ||
    normalizedRegion.includes('sardinia') ||
    normalizedRegion.includes('sardegna') ||
    normalizedRegion.includes('italy') ||
    normalizedRegion.includes('italia')
  ) {
    return 'Italy';
  }

  // Spain
  if (
    normalizedRegion.includes('rioja') ||
    normalizedRegion.includes('ribera del duero') ||
    normalizedRegion.includes('priorat') ||
    normalizedRegion.includes('catalonia') ||
    normalizedRegion.includes('catalunya') ||
    normalizedRegion.includes('galicia') ||
    normalizedRegion.includes('navarra') ||
    normalizedRegion.includes('jerez') ||
    normalizedRegion.includes('sherry') ||
    normalizedRegion.includes('andalusia') ||
    normalizedRegion.includes('valencia') ||
    normalizedRegion.includes('castilla') ||
    normalizedRegion.includes('spain') ||
    normalizedRegion.includes('españa')
  ) {
    return 'Spain';
  }

  // USA
  if (
    normalizedRegion.includes('napa') ||
    normalizedRegion.includes('sonoma') ||
    normalizedRegion.includes('california') ||
    normalizedRegion.includes('oregon') ||
    normalizedRegion.includes('washington') ||
    normalizedRegion.includes('willamette') ||
    normalizedRegion.includes('columbia valley') ||
    normalizedRegion.includes('paso robles') ||
    normalizedRegion.includes('santa barbara') ||
    normalizedRegion.includes('mendocino') ||
    normalizedRegion.includes('anderson valley') ||
    normalizedRegion.includes('usa') ||
    normalizedRegion.includes('united states')
  ) {
    return 'USA';
  }

  // Australia
  if (
    normalizedRegion.includes('barossa') ||
    normalizedRegion.includes('margaret river') ||
    normalizedRegion.includes('hunter valley') ||
    normalizedRegion.includes('yarra valley') ||
    normalizedRegion.includes('mclaren vale') ||
    normalizedRegion.includes('adelaide') ||
    normalizedRegion.includes('coonawarra') ||
    normalizedRegion.includes('tasmania') ||
    normalizedRegion.includes('australia')
  ) {
    return 'Australia';
  }

  // New Zealand
  if (
    normalizedRegion.includes('marlborough') ||
    normalizedRegion.includes('hawke') ||
    normalizedRegion.includes('central otago') ||
    normalizedRegion.includes('martinborough') ||
    normalizedRegion.includes('new zealand')
  ) {
    return 'New Zealand';
  }

  // Germany
  if (
    normalizedRegion.includes('mosel') ||
    normalizedRegion.includes('rheingau') ||
    normalizedRegion.includes('rheinhessen') ||
    normalizedRegion.includes('pfalz') ||
    normalizedRegion.includes('baden') ||
    normalizedRegion.includes('franken') ||
    normalizedRegion.includes('germany') ||
    normalizedRegion.includes('deutschland')
  ) {
    return 'Germany';
  }

  // Portugal
  if (
    normalizedRegion.includes('douro') ||
    normalizedRegion.includes('porto') ||
    normalizedRegion.includes('alentejo') ||
    normalizedRegion.includes('dao') ||
    normalizedRegion.includes('dão') ||
    normalizedRegion.includes('vinho verde') ||
    normalizedRegion.includes('portugal')
  ) {
    return 'Portugal';
  }

  // Argentina
  if (
    normalizedRegion.includes('mendoza') ||
    normalizedRegion.includes('salta') ||
    normalizedRegion.includes('patagonia') ||
    normalizedRegion.includes('argentina')
  ) {
    return 'Argentina';
  }

  // Chile
  if (
    normalizedRegion.includes('maipo') ||
    normalizedRegion.includes('colchagua') ||
    normalizedRegion.includes('casablanca') ||
    normalizedRegion.includes('cachapoal') ||
    normalizedRegion.includes('chile')
  ) {
    return 'Chile';
  }

  // South Africa
  if (
    normalizedRegion.includes('stellenbosch') ||
    normalizedRegion.includes('franschhoek') ||
    normalizedRegion.includes('paarl') ||
    normalizedRegion.includes('swartland') ||
    normalizedRegion.includes('south africa')
  ) {
    return 'South Africa';
  }

  // Austria
  if (
    normalizedRegion.includes('wachau') ||
    normalizedRegion.includes('kremstal') ||
    normalizedRegion.includes('kamptal') ||
    normalizedRegion.includes('burgenland') ||
    normalizedRegion.includes('austria') ||
    normalizedRegion.includes('österreich')
  ) {
    return 'Austria';
  }

  // Greece
  if (
    normalizedRegion.includes('santorini') ||
    normalizedRegion.includes('nemea') ||
    normalizedRegion.includes('naoussa') ||
    normalizedRegion.includes('greece') ||
    normalizedRegion.includes('greek')
  ) {
    return 'Greece';
  }

  // Lebanon
  if (
    normalizedRegion.includes('bekaa') ||
    normalizedRegion.includes('lebanon') ||
    normalizedRegion.includes('lebanese')
  ) {
    return 'Lebanon';
  }

  // Israel
  if (
    normalizedRegion.includes('galilee') ||
    normalizedRegion.includes('golan') ||
    normalizedRegion.includes('israel') ||
    normalizedRegion.includes('israeli')
  ) {
    return 'Israel';
  }

  // Hungary
  if (
    normalizedRegion.includes('tokaj') ||
    normalizedRegion.includes('eger') ||
    normalizedRegion.includes('hungary') ||
    normalizedRegion.includes('hungarian')
  ) {
    return 'Hungary';
  }

  // England/UK
  if (
    normalizedRegion.includes('england') ||
    normalizedRegion.includes('english') ||
    normalizedRegion.includes('kent') ||
    normalizedRegion.includes('sussex') ||
    normalizedRegion.includes('hampshire') ||
    normalizedRegion.includes('united kingdom') ||
    normalizedRegion.includes('uk')
  ) {
    return 'England';
  }

  // Check producer as fallback
  if (normalizedProducer) {
    // French producers
    if (
      normalizedProducer.includes('château') ||
      normalizedProducer.includes('chateau') ||
      normalizedProducer.includes('domaine')
    ) {
      return 'France';
    }

    // Italian producers
    if (
      normalizedProducer.includes('tenuta') ||
      normalizedProducer.includes('cantina') ||
      normalizedProducer.includes('fattoria')
    ) {
      return 'Italy';
    }

    // Spanish producers
    if (
      normalizedProducer.includes('bodega') ||
      normalizedProducer.includes('bodegas')
    ) {
      return 'Spain';
    }

    // German producers
    if (
      normalizedProducer.includes('weingut') ||
      normalizedProducer.includes('schloss')
    ) {
      return 'Germany';
    }
  }

  // Unknown region
  return null;
};

export default getCountryFromRegion;
