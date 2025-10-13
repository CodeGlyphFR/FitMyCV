// Layout spécifique pour les pages d'authentification
// viewport-fit=cover permet au background de s'étendre sous les barres UI Safari iOS

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function AuthLayout({ children }) {
  return children;
}
