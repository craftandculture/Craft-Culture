const WORD_NUMBERS: Record<string, number> = {
  seven: 7,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  'forty-five': 45,
  fortyfive: 45,
  sixty: 60,
  ninety: 90,
  'one hundred twenty': 120,
};

/**
 * Read payment terms into something two documents can be compared on
 *
 * Each party writes terms its own way: the client's LPO says "SIXTY (60) DAYS
 * CREDIT TERMS", Zoho's label says "Net 60" or "Due end of the month", and an
 * offer says "immediate, on collection". Compared as text they never agree;
 * compared as days they can.
 *
 * End of month is kept apart rather than turned into a number, because its
 * length depends on the invoice date; it never equals a fixed credit period.
 *
 * @example
 *   parseTermsDays('SIXTY (60) DAYS CREDIT TERMS'); // { days: 60, label: '60 days' }
 *   parseTermsDays('Due end of the month'); // { days: null, label: 'end of month', endOfMonth: true }
 *
 * @param text - Terms as any document states them
 * @returns Days of credit, a short label to show, or null when nothing is read
 */
const parseTermsDays = (text: string | null | undefined) => {
  const t = (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return null;

  if (/end of (the )?(next )?month|\beom\b/.test(t)) {
    return { days: null, label: 'end of month', endOfMonth: true };
  }

  if (/immediate|on receipt|on collection|cash on delivery|\bcod\b|advance|prepaid|pro ?forma/.test(t)) {
    return { days: 0, label: 'immediate', endOfMonth: false };
  }

  const figure = t.match(/\(?\b(\d{1,3})\)?\s*(?:days?|d\b)|net\s*(\d{1,3})/);
  const digits = figure ? Number(figure[1] ?? figure[2]) : null;
  if (digits !== null && Number.isFinite(digits)) {
    return { days: digits, label: `${digits} days`, endOfMonth: false };
  }

  const word = Object.keys(WORD_NUMBERS)
    .sort((a, b) => b.length - a.length)
    .find((w) => t.includes(w));
  if (word && /day/.test(t)) {
    const days = WORD_NUMBERS[word]!;
    return { days, label: `${days} days`, endOfMonth: false };
  }

  return null;
};

export default parseTermsDays;
