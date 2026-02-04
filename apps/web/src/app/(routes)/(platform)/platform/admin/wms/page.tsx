import WMSDashboardContent from './WMSDashboardContent';

/**
 * WMS Dashboard - overview of warehouse locations, stock, and quick actions
 *
 * DEBUG MODE: SSR prefetch disabled to test client-side fetching
 * If data loads correctly with this version, the issue is in SSR/hydration.
 * If data still shows zeros, the issue is in the client fetch or the query itself.
 */
const WMSDashboardPage = () => {
  // SSR prefetch temporarily disabled for debugging
  // Pure client-side fetching will be used by WMSDashboardContent
  return <WMSDashboardContent />;
};

export default WMSDashboardPage;
