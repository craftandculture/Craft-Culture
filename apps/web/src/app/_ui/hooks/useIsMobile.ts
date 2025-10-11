import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

const useIsMobile = (mobileBreakpoint = MOBILE_BREAKPOINT) => {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();

    const mediaQueryList = window.matchMedia(
      `(max-width: ${mobileBreakpoint - 1}px)`,
    );

    mediaQueryList.addEventListener(
      'change',
      () => {
        setIsMobile(window.innerWidth < mobileBreakpoint);
      },
      {
        signal: controller.signal,
      },
    );

    setIsMobile(window.innerWidth < mobileBreakpoint);

    return () => {
      controller.abort();
    };
  }, [mobileBreakpoint]);

  return !!isMobile;
};

export default useIsMobile;
