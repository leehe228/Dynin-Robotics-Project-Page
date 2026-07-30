import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const pagesBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ?? "/Dynin-Robotics-Project-Page";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? pagesBasePath : "",
  assetPrefix: isGitHubPages ? pagesBasePath : undefined,
  trailingSlash: isGitHubPages,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
