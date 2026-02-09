'use client';

import { usePathname } from 'next/navigation';

interface LayoutModeProviderProps {
  children: React.ReactNode;
  wmsContent: React.ReactNode;
  standardContent: React.ReactNode;
}

/**
 * Client component that switches between WMS mode and standard layout
 * based on the current pathname
 */
const LayoutModeProvider = ({
  wmsContent,
  standardContent,
}: LayoutModeProviderProps) => {
  const pathname = usePathname();
  const isWMSMode = pathname.startsWith('/platform/admin/wms');

  if (isWMSMode) {
    return <>{wmsContent}</>;
  }

  return <>{standardContent}</>;
};

export default LayoutModeProvider;
