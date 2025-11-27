'use client';

import { Lightbulb } from 'lucide-react';

/**
 * TipBox - Reusable amber-colored tip/hint box with lightbulb icon
 * Used in onboarding modals and tutorial screens
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Tip text content
 * @param {string} [props.className] - Optional additional classes
 */
export default function TipBox({ children, className = '' }) {
  return (
    <div className={`p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <p className="text-white/80 text-sm leading-relaxed text-left">
          {children}
        </p>
      </div>
    </div>
  );
}
