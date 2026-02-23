import LocalServerProvider from '@/app/_wms/providers/LocalServerProvider';
import PrinterProvider from '@/app/_wms/providers/PrinterProvider';

/**
 * WMS layout — wraps all warehouse pages with providers for
 * local server routing and multi-printer management.
 */
const WMSLayout = ({ children }: React.PropsWithChildren) => {
  return (
    <LocalServerProvider>
      <PrinterProvider>{children}</PrinterProvider>
    </LocalServerProvider>
  );
};

export default WMSLayout;
