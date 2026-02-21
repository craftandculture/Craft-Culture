import LocalServerProvider from '@/app/_wms/providers/LocalServerProvider';

/**
 * WMS layout — wraps all warehouse pages with local server provider
 * so scanner-critical operations route through the NUC when available.
 */
const WMSLayout = ({ children }: React.PropsWithChildren) => {
  return <LocalServerProvider>{children}</LocalServerProvider>;
};

export default WMSLayout;
