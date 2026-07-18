import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev-only: lets the dev server serve /_next/* assets when accessed via an
  // ngrok tunnel. Ignored by production builds.
  allowedDevOrigins: ["*.ngrok-free.app"],
  // Dev-only: proxy API calls through the dev server to the local backend so
  // phones on an ngrok tunnel stay same-origin (no CORS). In production the
  // load balancer routes /api/* before Next ever sees it.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:8000/api/v1/:path*",
      },
      {
        // Growth Center lives in its own namespace outside /api/v1.
        source: "/api/super-admin/growth-center/:path*",
        destination: "http://localhost:8000/api/super-admin/growth-center/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/finance",
        destination: "/expenses",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
