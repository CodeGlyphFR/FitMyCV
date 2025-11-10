'use client';

import { useCallback } from 'react';
import {
  trackEvent,
  trackPageView,
  trackButtonClick,
  trackModalOpened,
  trackModalClosed,
  trackFormSubmitted
} from '@/lib/telemetry/client';

/**
 * Hook for telemetry tracking in React components
 */
export function useTelemetry() {
  const track = useCallback((type, metadata) => {
    trackEvent(type, metadata);
  }, []);

  const pageView = useCallback((path, metadata) => {
    trackPageView(path, metadata);
  }, []);

  const buttonClick = useCallback((buttonName, metadata) => {
    trackButtonClick(buttonName, metadata);
  }, []);

  const modalOpened = useCallback((modalName, metadata) => {
    trackModalOpened(modalName, metadata);
  }, []);

  const modalClosed = useCallback((modalName, metadata) => {
    trackModalClosed(modalName, metadata);
  }, []);

  const formSubmitted = useCallback((formName, metadata) => {
    trackFormSubmitted(formName, metadata);
  }, []);

  return {
    track,
    pageView,
    buttonClick,
    modalOpened,
    modalClosed,
    formSubmitted,
  };
}
