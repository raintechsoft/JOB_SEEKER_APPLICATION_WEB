import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keeps development screenshots comparable with the prototype.
  devIndicators: false,
};

export default nextConfig;
