import type { LabelSize } from '../providers/PrinterProvider';

/**
 * Generate a minimal ZPL test label to verify printer connectivity.
 *
 * @param printerName - Display name of the printer
 * @param ip - IP address of the printer
 * @param labelSize - Label size variant ('4x2' or '4x6')
 * @returns ZPL string for a test label
 */
const generateTestLabelZpl = (printerName: string, ip: string, labelSize: LabelSize) => {
  const timestamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (labelSize === '4x6') {
    return `^XA
^MTD^JUS
^PR3
^FO50,40^ADN,46,24^FDTEST PRINT^FS
^FO50,100^A0N,32,32^FD${printerName}^FS
^FO50,150^A0N,28,28^FD${ip}^FS
^FO50,200^A0N,24,24^FD${timestamp}^FS
^FO50,260^GB710,0,3^FS
^FO50,290^A0N,24,24^FDPrinter is working!^FS
^XZ`;
  }

  return `^XA
^MTD^JUS
^PR3
^FO30,20^ADN,36,20^FDTEST PRINT^FS
^FO30,65^A0N,24,24^FD${printerName}^FS
^FO30,95^A0N,20,20^FD${ip}^FS
^FO30,125^A0N,18,18^FD${timestamp}^FS
^FO30,155^GB750,0,2^FS
^FO30,170^A0N,20,20^FDPrinter is working!^FS
^XZ`;
};

export default generateTestLabelZpl;
