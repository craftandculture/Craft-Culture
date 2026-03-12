import LocalServerProvider from '@/app/_wms/providers/LocalServerProvider';

/**
 * WMS layout — wraps all warehouse pages with the local server provider.
 * PrinterProvider is in the platform layout to cover both the WMS header and page content.
 */
const WMSLayout = ({ children }: React.PropsWithChildren) => {
  return <LocalServerProvider>{children}</LocalServerProvider>;
};

export default WMSLayout;
