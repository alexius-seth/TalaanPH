/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow local IP access during mobile development testing
  // Prevents cross-origin dev asset warnings when accessing from local network devices
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*', 'localhost:3000'],
};

export default nextConfig;
