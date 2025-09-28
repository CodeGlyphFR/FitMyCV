import packageInfo from '../package.json';

export default function Footer() {
  return (
    <footer className="w-full text-center text-gray-500 text-sm mb-0 pb-0">
      Version {packageInfo.version}
    </footer>
  );
}