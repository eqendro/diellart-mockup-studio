import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Narrowly permits the reported Samsung LAN test host to request Next.js
  // development assets. This option does not broaden production origins.
  allowedDevOrigins: ["192.168.100.31"],
};

export default nextConfig;
