import type { NextConfig } from "next";

/**
 * Public marketing site for nivaasos.com. Fully static — every page is
 * prerendered at build time so crawlers receive complete HTML. No API
 * access, no auth, no cookies. The authenticated application is a separate
 * deployment and is never bundled here.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
