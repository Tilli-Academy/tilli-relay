import type { NextConfig } from "next";

// Detect code-server proxy: VSCODE_PROXY_URI=https://host:port/proxy/{{port}}/
// The proxy strips /proxy/{port} before forwarding, so basePath stays empty.
// But asset URLs need the prefix so the browser fetches them through the proxy.
const proxyUri = process.env.VSCODE_PROXY_URI;
const port = process.env.PORT || "3002";
const assetPrefix = proxyUri ? `/proxy/${port}` : "";

const nextConfig: NextConfig = {
  assetPrefix: assetPrefix || undefined,
  env: {
    NEXT_PUBLIC_ASSET_PREFIX: assetPrefix,
  },
  allowedDevOrigins: ["10.10.0.36", "localhost", "0.0.0.0"],
  devIndicators: false,
};

export default nextConfig;
