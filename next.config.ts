import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app runs entirely in the browser, so it ships as static files
  // served by Cloudflare (see wrangler.jsonc).
  output: "export",
};

export default nextConfig;
