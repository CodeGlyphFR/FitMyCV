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
};

module.exports = nextConfig;
