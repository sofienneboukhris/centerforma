import { describe, it, expect } from "vitest";
import { adminNav } from "@/components/app/nav-config";
import { routeTree } from "@/routeTree.gen";
import { Route as ParametresRoute } from "@/routes/admin.parametres";

import { getRouter } from "@/router";

describe("Validation de la route /admin/parametres et intégration au menu", () => {
  it("L'entrée 'Paramètres' est présente dans adminNav sous le groupe 'Système' et pointe vers /admin/parametres", () => {
    const item = adminNav.items.find((i) => i.to === "/admin/parametres");
    expect(item).toBeDefined();
    expect(item?.label).toBe("Paramètres");
    expect(item?.group).toBe("Système");
    expect(item?.icon).toBeDefined();
  });

  it("La route TanStack /admin/parametres est correctement définie et configurée", () => {
    expect(ParametresRoute).toBeDefined();
    expect(ParametresRoute.options.component).toBeDefined();

    // Vérifier les métadonnées de la page
    const head = ParametresRoute.options.head?.();
    expect(head?.meta?.some((m: { title?: string }) => m.title?.includes("Paramètres"))).toBe(true);
  });

  it("La route /admin/parametres est enregistrée et résolue par le routeur", () => {
    const router = getRouter();
    expect(router.routesByPath).toBeDefined();
    // La route /admin/parametres doit être présente et accessible
    expect(router.routesByPath["/admin/parametres"]).toBeDefined();
    expect(router.routesByPath["/admin/parametres"].fullPath).toBe("/admin/parametres");
  });
});
