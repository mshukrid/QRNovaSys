import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages hosts project sites below /<repository>.
  ...(process.env.GITHUB_ACTIONS
    ? {
        output: "export" as const,
        basePath: "/QRNovaSys",
        assetPrefix: "/QRNovaSys/",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
