import type { NextConfig } from "next";

// Detect code-server proxy: VSCODE_PROXY_URI=https://host:port/proxy/{{port}}/
// The proxy strips /proxy/{port} before forwarding, so basePath stays empty.
// But asset URLs need the prefix so the browser fetches them through the proxy.
const proxyUri = process.env.VSCODE_PROXY_URI;
const port = process.env.PORT || "3003";
const assetPrefix = proxyUri ? `/proxy/${port}` : "";

// Derive allowed dev origins from proxy URI instead of hardcoding IPs
const allowedDevOrigins = ["localhost", "0.0.0.0"];
if (proxyUri) {
  try {
    const host = new URL(proxyUri).hostname;
    if (host && !allowedDevOrigins.includes(host)) {
      allowedDevOrigins.push(host);
    }
  } catch {}
}

const nextConfig: NextConfig = {
  assetPrefix: assetPrefix || undefined,
  env: {
    NEXT_PUBLIC_ASSET_PREFIX: assetPrefix,
  },
  allowedDevOrigins,
  devIndicators: false,
};

export default nextConfig;
