'use client';

import { useState, useEffect } from 'react';

/**
 * Detects whether the viewport width is below the given breakpoint.
 * Listens to window resize events and updates reactively.
 *
 * @param {number} breakpoint - Width threshold in pixels (default: 1024)
 * @returns {boolean} true when viewport width is strictly less than breakpoint
 */
export function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

export default useIsMobile;
