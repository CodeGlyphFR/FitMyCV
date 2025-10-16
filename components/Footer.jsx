"use client";
import Link from 'next/link';
import packageInfo from '../package.json';

export default function Footer() {
  return (
    <footer className="w-full text-center text-xs pt-4 pb-20 min-h-[56px] flex items-center justify-center">
      <div className="text-white/70 space-y-2">
        <div>© 2025 FitMyCv.ai (v{packageInfo.version})</div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 leading-none -space-y-3 sm:space-y-0">
          <div className="flex items-baseline justify-center gap-1 leading-none">
            <Link href="/about" className="hover:text-white transition-colors">
              À propos
            </Link>
            <span className="text-white/40">•</span>
            <Link href="/cookies" className="hover:text-white transition-colors">
              Cookies
            </Link>
            <span className="text-white/40 hidden sm:inline">•</span>
          </div>
          <div className="flex items-baseline justify-center gap-1 leading-none">
            <Link href="/terms" className="hover:text-white transition-colors">
              Conditions générales
            </Link>
            <span className="text-white/40">•</span>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}