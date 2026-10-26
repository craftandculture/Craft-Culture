import type { ExportLine } from '../schemas/exportDocumentSchema';

const ORIGIN_SENTENCE = /\s*The goods are of [^.]* origin\./g;

/**
 * Keep the declaration's countries of origin in step with the lines
 *
 * The declaration was written once, when the draft was built, so an origin
 * typed in afterwards never reached it and the invoice could not be issued.
 * The origin sentence is now rewritten from the lines every time the document
 * changes; the rest of the declaration is left as written.
 *
 * @example
 *   declareOrigins('We declare… The goods are of France origin.', lines);
 *   // 'We declare… The goods are of France, Spain origin.'
 *
 * @param declaration - The declaration as it stands
 * @param lines - The document's lines
 * @returns The declaration naming every origin on the lines
 */
const declareOrigins = (declaration: string, lines: ExportLine[]) => {
  const origins = [
    ...new Set(
      lines
        .flatMap((l) => (l.kind === 'mixedCase' ? l.components.map((c) => c.origin) : [l.origin]))
        .flatMap((o) => o.split(' / '))
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  ];
  const rest = declaration.replace(ORIGIN_SENTENCE, '').trim();
  return origins.length ? `${rest} The goods are of ${origins.join(', ')} origin.` : rest;
};

export default declareOrigins;
