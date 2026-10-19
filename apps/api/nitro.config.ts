import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  scanDirs: ["server"],
  preset: "node-server",
  compatibilityDate: "2026-10-12",
  routeRules: {
    "/api/**": {
      cors: true,
      headers: {
        "cache-control": "private, no-cache",
        "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization, x-cache-bypass",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=()",
      },
    },
  },
  experimental: {
    asyncContext: true,
  },
});
