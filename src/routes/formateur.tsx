import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/formateur")({
  component: () => <Navigate to="/enseignant/dashboard" replace />,
});
