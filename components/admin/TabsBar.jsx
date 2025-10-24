'use client';

import { useRef, useState, useEffect } from 'react';

export function TabsBar({ tabs, activeTab, onTabChange }) {
  const scrollContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Handle mouse down to start dragging
  const handleMouseDown = (e) => {
    if (!scrollContainerRef.current) return;

    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  // Handle mouse move during drag
  const handleMouseMove = (e) => {
    if (!isDragging || !scrollContainerRef.current) return;

    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Multiply by 2 for faster scroll
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Handle mouse up or leave to stop dragging
  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Prevent click event when dragging
  const handleTabClick = (tabId, e) => {
    if (isDragging) {
      e.preventDefault();
      return;
    }
    onTabChange(tabId);
  };

  // Update cursor style based on drag state
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
  }, [isDragging]);

  return (
    <div
      ref={scrollContainerRef}
      className="flex space-x-4 md:space-x-6 overflow-x-auto scrollbar-hidden touch-pan-x px-4 md:px-0 select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={(e) => handleTabClick(tab.id, e)}
          className={`
            flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border-b-2 font-medium text-xs md:text-sm transition whitespace-nowrap flex-shrink-0
            ${
              activeTab === tab.id
                ? 'border-blue-400 text-white'
                : 'border-transparent text-white/60 hover:text-white hover:border-white/20'
            }
          `}
        >
          <span className="text-base md:text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
