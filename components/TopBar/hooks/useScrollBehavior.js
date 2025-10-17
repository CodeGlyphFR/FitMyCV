import React from "react";

/**
 * Hook pour gérer le comportement de scroll de la TopBar (hide/show sur mobile)
 */
export function useScrollBehavior({ lastScrollY, setIsScrollingDown, setLastScrollY, listOpen, triggerRef, setDropdownRect }) {
  const scrollTimeoutRef = React.useRef(null);

  React.useEffect(() => {
    let scrollEndTimeout = null;
    let lastDirection = null;
    let isScrolling = false;

    function handleScroll() {
      // Only on mobile (width < 768px)
      if (window.innerWidth >= 768) {
        setIsScrollingDown(false);
        return;
      }

      // TEMPORARY: Disable hide/show on mobile to test
      setIsScrollingDown(false);
      return;

      // On mobile: don't close dropdown immediately, let user interaction handle it
      const currentScrollY = window.scrollY;
      isScrolling = true;

      if (scrollEndTimeout) {
        clearTimeout(scrollEndTimeout);
      }

      const scrollDelta = currentScrollY - lastScrollY;

      let currentDirection = null;
      if (scrollDelta > 5 && currentScrollY > 60) {
        currentDirection = 'down';
      } else if (scrollDelta < -5) {
        currentDirection = 'up';
      }

      if (currentDirection === 'down' && lastDirection !== 'down') {
        setIsScrollingDown(true);
        lastDirection = 'down';
      } else if (currentDirection === 'up' && lastDirection !== 'up') {
        setIsScrollingDown(false);
        lastDirection = 'up';
      }

      setLastScrollY(currentScrollY);

      scrollEndTimeout = setTimeout(() => {
        setIsScrollingDown(false);
        lastDirection = null;
        isScrolling = false;
      }, 150);
    }

    function updatePosition() {
      if (listOpen && triggerRef?.current) {
        setDropdownRect(triggerRef.current.getBoundingClientRect());
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollEndTimeout) {
        clearTimeout(scrollEndTimeout);
      }
    };
  }, [lastScrollY, listOpen, triggerRef, setIsScrollingDown, setLastScrollY, setDropdownRect]);
}
