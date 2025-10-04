const { version } = require("./package.json");

const SITE_NAME = "CV Builder";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_SITE_NAME: SITE_NAME,
  },
  // Autoriser explicitement les origines en développement
  allowedDevOrigins: [
    "http://localhost:3000",          // accès classique local
    "176.136.226.121:3000",    // ton IP publique avec port
  ],
  // Optimisations pour LCP et CLS
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  // Compiler les modules pour améliorer les performances
  transpilePackages: [],
  // Optimiser la compression
  compress: true,
  // Optimiser le chunking
  experimental: {
    optimizePackageImports: ['lucide-react', 'next-auth'],
    instrumentationHook: true,
  },
  // Optimiser le splitting des chunks
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk pour les dépendances communes
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // Auth chunk séparé
            auth: {
              name: 'auth',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]next-auth[\\/]/,
              priority: 35,
              enforce: true,
            },
            // Lib chunk pour le reste
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name: 'lib',
              chunks: 'all',
              priority: 30,
            },
            // Commons chunk pour le code partagé
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
          },
        },
      };
    }
    return config;
  },
};

module.exports = nextConfig;
