const isUae = (country: string | null | undefined) =>
  !!country && /^(ae|uae|united arab emirates)$/i.test(country.trim());

/**
 * The kind of job a freight request most likely is, from its route
 *
 * Into the UAE is inbound; out of the UAE is a re-export; within the UAE is a
 * transfer; anything else (a UK move, say) is treated as outbound. Staff can
 * change it on the form.
 *
 * @example
 *   defaultJobType('United Kingdom', 'United Arab Emirates'); // 'inbound'
 *   defaultJobType('United Arab Emirates', 'Oman'); // 're_export'
 *
 * @param originCountry - Where the goods are collected
 * @param destinationCountry - Where they are delivered
 * @returns The shipment type to open the job as
 */
const defaultJobType = (
  originCountry: string | null | undefined,
  destinationCountry: string | null | undefined,
) => {
  if (isUae(destinationCountry))
    return isUae(originCountry)
      ? ('mainland_transfer' as const)
      : ('inbound' as const);
  if (isUae(originCountry)) return 're_export' as const;

  return 'outbound' as const;
};

export default defaultJobType;
