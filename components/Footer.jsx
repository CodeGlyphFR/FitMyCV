import Link from 'next/link';
import packageInfo from '../package.json';

export default function Footer() {
  return (
    <footer className="w-full text-center text-gray-500 text-sm mb-0 pb-4">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-2">
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