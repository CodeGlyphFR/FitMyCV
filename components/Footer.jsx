import Link from 'next/link';
import packageInfo from '../package.json';

export default function Footer() {
  return (
    <footer className="w-full text-center text-gray-500 text-sm py-4 h-[56px] flex items-center justify-center">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <span>Version {packageInfo.version}</span>
        <span className="hidden sm:inline">•</span>
        <Link
          href="/cookies"
          className="hover:text-gray-700 dark:hover:text-gray-300 underline transition-colors"
        >
          Gestion des cookies
        </Link>
      </div>
    </footer>
  );
}