import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'standalone' output produces .next/standalone/server.js with only the
  // node_modules actually referenced at runtime. Deploy bundle drops from
  // ~500 MB to ~30 MB and Azure App Service cold starts get faster.
  //
  // See DEPLOYMENT.md for the GitHub Action that assembles the zip and the
  // App Service startup command (`node server.js`).
  output: "standalone",

  // App Service sits behind a reverse proxy that supplies X-Forwarded-* headers.
  // Next.js detects them automatically; we just need to NOT set a custom
  // `assetPrefix` so /next-static URLs work under the App Service hostname.
  reactStrictMode: true,
};

export default nextConfig;
