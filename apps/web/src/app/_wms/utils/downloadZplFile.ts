/**
 * Download ZPL content as a file for printing via Printer Setup Utility
 *
 * This is the current print workflow for TC27 → ZD421:
 * 1. Generate ZPL code
 * 2. Download as .zpl file
 * 3. Open file with "Printer Setup Utility" app on TC27
 * 4. Printer receives ZPL and prints
 *
 * @example
 *   downloadZplFile(zplContent, 'case-labels-2026-02-07');
 */
const downloadZplFile = (zplContent: string, filename: string) => {
  // Create blob with ZPL content
  const blob = new Blob([zplContent], { type: 'application/x-zpl' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.zpl`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default downloadZplFile;
