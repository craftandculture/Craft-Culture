/**
 * The free-text name sent to Wine Labs to identify a wine we hold
 *
 * Product names often already carry the producer or the vintage, so each is
 * added only when missing. 1000 is the LWIN placeholder for non-vintage.
 *
 * @example
 *   buildMatchQuery({ producer: 'Tormaresca', name: 'Bocca di Lupo', vintage: '2019' });
 *   // 'Tormaresca Bocca di Lupo 2019'
 *
 * @param wine - Producer, product name and four-digit vintage
 * @returns The query text
 */
const buildMatchQuery = ({
  producer,
  name,
  vintage,
}: {
  producer: string | null;
  name: string;
  vintage: string | null;
}) => {
  const parts = [name.trim()];
  const lower = name.toLowerCase();
  if (producer?.trim() && !lower.includes(producer.trim().toLowerCase())) {
    parts.unshift(producer.trim());
  }
  if (vintage && vintage !== '1000' && !name.includes(vintage)) {
    parts.push(vintage);
  }
  return parts.join(' ').replace(/\s+/g, ' ');
};

export default buildMatchQuery;
