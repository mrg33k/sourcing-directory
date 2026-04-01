import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: "https://www.aheadofmarket.com/sourcing/:path*",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
