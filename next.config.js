const { version } = require("./package.json");

const SITE_NAME = "CV Builder";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_SITE_NAME: SITE_NAME,
  },
  // Autoriser explicitement les origines en développement
  // IMPORTANT: Pour autoriser des IPs/domaines spécifiques, utilisez la variable d'environnement
  // ALLOWED_ORIGINS="http://localhost:3000,http://your-ip:3000" dans .env.local
  allowedDevOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ["http://localhost:3000", "http://localhost:3001"],
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
    instrumentationHook: true, // Activer le hook instrumentation.js
    serverComponentsExternalPackages: ['puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],
  },
  // Optimiser le splitting des chunks
  webpack: (config, { isServer }) => {
    // Exclure puppeteer du bundling côté client
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'puppeteer-extra': false,
        'puppeteer-extra-plugin-stealth': false,
        'puppeteer': false,
      };

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
