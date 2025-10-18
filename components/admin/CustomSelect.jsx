'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export function CustomSelect({ value, onChange, options, className = '', placeholder = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState(null);
  const [portalReady, setPortalReady] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownRect(rect);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-xl flex items-center justify-between ${className}`}
        >
          <span className={`truncate ${selectedOption ? '' : 'text-white/40'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span className="text-xs opacity-60 ml-2 flex-shrink-0">▾</span>
        </button>
      </div>

      {isOpen && portalReady && dropdownRect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownRect.bottom + 4,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 10003,
          }}
          className="rounded-lg border border-white/30 bg-gray-900/95 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-h-60 overflow-y-auto"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange({ target: { value: option.value } });
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-white/25 text-white transition-colors ${
                option.value === value ? 'bg-white/20 border-l-2 border-blue-400' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
