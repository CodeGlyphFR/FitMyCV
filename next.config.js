const { version } = require("./package.json");

const SITE_NAME = "FitMyCV.io";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_SITE_NAME: SITE_NAME,
  },

  // Optimisations pour LCP et CLS
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Compiler les modules pour améliorer les performances
  transpilePackages: ['swiper'],

  // Optimiser la compression
  compress: true,

  // Next.js 16: Autoriser les requêtes cross-origin en développement
  allowedDevOrigins: ['dev.fitmycv.io'],

  // Next.js 16: serverComponentsExternalPackages déplacé hors de experimental
  serverExternalPackages: ['puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth'],

  // Next.js 16: Turbopack est le bundler par défaut
  // Config vide pour accepter Turbopack (la config webpack ci-dessous est ignorée)
  turbopack: {},

  experimental: {
    optimizePackageImports: ['lucide-react', 'next-auth'],
    // instrumentationHook supprimé (plus nécessaire en Next.js 16)
  },

  // Config Webpack (ignorée avec Turbopack, conservée pour compatibilité --webpack)
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
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
              priority: 40,
              enforce: true,
            },
            auth: {
              name: 'auth',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]next-auth[\\/]/,
              priority: 35,
              enforce: true,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name: 'lib',
              chunks: 'all',
              priority: 30,
            },
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
