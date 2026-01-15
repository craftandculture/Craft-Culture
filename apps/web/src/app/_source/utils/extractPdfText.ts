import { PDFParse } from 'pdf-parse';

import logger from '@/utils/logger';

/**
 * Extract text content from a PDF buffer
 *
 * @example
 *   const text = await extractPdfText(pdfBuffer);
 *
 * @param buffer - PDF file as a Buffer
 * @returns Extracted text content from all pages
 */
const extractPdfText = async (buffer: Buffer): Promise<string> => {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    if (!result.text || result.text.trim().length === 0) {
      throw new Error(
        'No text content could be extracted. The PDF may be scanned/image-based.'
      );
    }

    logger.dev(`Extracted ${result.pages.length} pages from PDF`);

    return result.text;
  } catch (error) {
    logger.error('PDF extraction error:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to extract text from PDF');
  } finally {
    await parser.destroy();
  }
};

export default extractPdfText;
