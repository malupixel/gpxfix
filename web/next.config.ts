import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep social metadata in the initial HTML head for every crawler, including new bots.
  htmlLimitedBots: /.*/,
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
