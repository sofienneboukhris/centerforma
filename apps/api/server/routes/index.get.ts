import { eventHandler } from "h3";

export default eventHandler(() => {
  return {
    name: "FormaCenter API",
    status: "online",
    version: "1.0.0",
    description: "API REST FormaCenter (Nitro / H3 / Prisma)",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      formationsTypes: "/api/formations-types",
    },
  };
});
