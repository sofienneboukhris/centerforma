import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/etudiant/")({
  component: () => <Navigate to="/etudiant/dashboard" replace />,
});
