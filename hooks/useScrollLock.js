import { useEffect, useRef } from 'react';

// Reference counter for nested modals
let lockCount = 0;
let savedScrollTop = 0;

// iOS detection (cached at module level, safe for SSR)
const _isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

// iOS file picker recovery state
let iosListenerAttached = false;
let fileInputActivated = false;
let recoveryInProgress = false;

function getScrollContainer() {
  return document.getElementById('scroll-container');
}

/**
 * iOS file picker fix (WebKit bug #160953).
 *
 * After the native file picker is dismissed, WebKit's compositor loses
 * track of position:fixed elements. The TopBar is now in normal flow
 * (not position:fixed) so it doesn't need recovery. Only bottom fixed
 * buttons (FeedbackButton, LanguageSwitcher, Admin) need CSS recovery.
 *
 * Recovery mechanism: body.ios-recovering hides all .fixed-button-layer
 * elements via display:none, then fades them back in.
 */
function recoverFixedElements() {
  if (recoveryInProgress) return;
  recoveryInProgress = true;

  document.body.classList.add('ios-recovering');

  setTimeout(() => {
    document.body.classList.remove('ios-recovering');
    document.body.classList.add('ios-fadein');

    setTimeout(() => {
      document.body.classList.remove('ios-fadein');
      recoveryInProgress = false;
    }, 200);
  }, 100);
}

/**
 * Schedule recovery after a file picker closes.
 * Only recovers bottom fixed buttons — TopBar is in normal flow.
 */
function scheduleFilePickerRecovery() {
  setTimeout(recoverFixedElements, 300);
  setTimeout(recoverFixedElements, 2000);
}

function attachIOSFilePickerListener() {
  if (iosListenerAttached || !_isIOS || typeof document === 'undefined') return;
  iosListenerAttached = true;

  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type === 'file') {
      fileInputActivated = true;
    }
    return nativeClick.apply(this, arguments);
  };

  document.addEventListener('click', (e) => {
    if (e.target?.type === 'file') {
      fileInputActivated = true;
    }
  }, true);

  document.addEventListener('change', (e) => {
    if (e.target?.type === 'file') {
      fileInputActivated = false;
      scheduleFilePickerRecovery();
    }
  }, true);

  window.addEventListener('focus', () => {
    if (fileInputActivated) {
      fileInputActivated = false;
      scheduleFilePickerRecovery();
    }
  });
}

function lockScroll() {
  if (lockCount === 0) {
    const container = getScrollContainer();
    if (container) {
      savedScrollTop = container.scrollTop;
      container.style.overflow = 'hidden';
    }
  }
  lockCount++;
}

function unlockScroll() {
  lockCount--;
  if (lockCount <= 0) {
    lockCount = 0;
    const container = getScrollContainer();
    if (container) {
      container.style.overflow = '';
      container.scrollTop = savedScrollTop;
    }
  }
}

/**
 * Hook to lock scroll when a modal/overlay is active.
 * Locks the #scroll-container overflow instead of body position:fixed.
 * Supports nested modals via reference counting.
 *
 * On iOS, detects native file picker usage and recovers the WebKit
 * compositor bug for bottom fixed buttons (.fixed-button-layer).
 *
 * @param {boolean} isActive - Whether scroll should be locked
 */
export function useScrollLock(isActive) {
  const wasActiveRef = useRef(false);

  useEffect(() => {
    attachIOSFilePickerListener();
  }, []);

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      lockScroll();
      wasActiveRef.current = true;
    }

    return () => {
      if (wasActiveRef.current) {
        unlockScroll();
        wasActiveRef.current = false;
      }
    };
  }, [isActive]);
}
