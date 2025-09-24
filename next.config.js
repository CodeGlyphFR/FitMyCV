/** @type {import('next').NextConfig} */
const nextConfig = {
  // Autoriser explicitement les origines en développement
  allowedDevOrigins: [
    "http://localhost:3000",          // accès classique local
    "176.136.226.121:3000",    // ton IP publique avec port
  ],
};

module.exports = nextConfig;
