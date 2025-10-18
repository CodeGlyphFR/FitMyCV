'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { startPageTimer, stopPageTimer } from '@/lib/telemetry/client';

/**
 * Telemetry Provider
 * Auto-tracks page views and navigation
 */
export function TelemetryProvider({ children }) {
  const pathname = usePathname();

  // Track page views on navigation
  useEffect(() => {
    if (pathname) {
      startPageTimer(pathname);
    }

    return () => {
      stopPageTimer();
    };
  }, [pathname]);

  return <>{children}</>;
}
