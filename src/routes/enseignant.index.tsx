import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/enseignant/")({
  component: () => <Navigate to="/enseignant/dashboard" replace />,
});
