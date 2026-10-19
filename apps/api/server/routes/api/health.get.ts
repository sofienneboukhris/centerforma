import { eventHandler } from "h3";

export default eventHandler(() => {
  return {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
});
