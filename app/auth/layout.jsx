// Layout spécifique pour les pages d'authentification
// viewport-fit=cover permet au background de s'étendre sous les barres UI Safari iOS

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#020617", // rgb(2, 6, 23) en hex - couleur des barres iOS
};

export default function AuthLayout({ children }) {
  return children;
}
