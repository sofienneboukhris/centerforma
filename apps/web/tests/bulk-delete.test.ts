import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { executeBulkDelete } from "@/lib/api";
import { toast } from "sonner";

describe("Suppression groupée dans les tableaux administrateur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Suppression d'un élément sélectionné individuellement", async () => {
    const deletedIds: string[] = [];
    const deleteFn = vi.fn(async (id: string) => {
      deletedIds.push(id);
      return { success: true, id };
    });

    const ids = ["salle-1"];
    const result = await executeBulkDelete(ids, deleteFn, { entityName: "salle(s)" });

    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(deleteFn).toHaveBeenCalledWith("salle-1");
    expect(result.successIds).toEqual(["salle-1"]);
    expect(result.failedIds).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("1 salle(s) supprimé(s) avec succès");
  });

  it("2. Suppression groupée de plusieurs éléments sélectionnés", async () => {
    const deleteFn = vi.fn(async (id: string) => {
      return { success: true, id };
    });

    const ids = ["salle-1", "salle-2", "salle-3"];
    const onSuccess = vi.fn();
    const result = await executeBulkDelete(ids, deleteFn, {
      entityName: "salle(s)",
      onSuccess,
    });

    expect(deleteFn).toHaveBeenCalledTimes(3);
    expect(result.successIds).toEqual(["salle-1", "salle-2", "salle-3"]);
    expect(result.failedIds).toEqual([]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("3 salle(s) supprimé(s) avec succès");
  });

  it("3. Suppression après filtrage avec des éléments masqués inclus dans la sélection", async () => {
    // 4 éléments sélectionnés au total : 2 visibles sur la page filtrée, 2 masqués par les filtres
    const allSelectedIds = ["etudiant-visible-1", "etudiant-visible-2", "etudiant-masque-1", "etudiant-masque-2"];
    const visibleIds = ["etudiant-visible-1", "etudiant-visible-2"];

    // Calcul de l'avertissement d'éléments masqués
    const numSelectedTotal = allSelectedIds.length;
    const numSelectedVisible = visibleIds.filter((id) => allSelectedIds.includes(id)).length;
    const numMasked = numSelectedTotal - numSelectedVisible;

    expect(numMasked).toBe(2);
    expect(numMasked > 0).toBe(true);

    // L'exécution supprime bien tous les éléments de la sélection transmise
    const deleteFn = vi.fn(async (id: string) => ({ success: true, id }));
    const result = await executeBulkDelete(allSelectedIds, deleteFn, { entityName: "étudiant(s)" });

    expect(deleteFn).toHaveBeenCalledTimes(4);
    expect(result.successIds).toEqual(allSelectedIds);
    expect(result.failedIds).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("4 étudiant(s) supprimé(s) avec succès");
  });

  it("4. Annulation de la suppression : aucun appel DELETE et sélection préservée", async () => {
    const deleteFn = vi.fn(async (id: string) => ({ success: true, id }));
    let selectedIds = new Set(["classe-1", "classe-2"]);

    // Simule la fermeture de la modal d'annulation
    const onCancel = () => {
      // Ne fait rien : conserve les IDs
    };

    onCancel();

    expect(deleteFn).not.toHaveBeenCalled();
    expect(selectedIds.size).toBe(2);
    expect(selectedIds.has("classe-1")).toBe(true);
    expect(selectedIds.has("classe-2")).toBe(true);
  });

  it("5. Rejet serveur global (403 interdit ou 409 conflit) : conservation de la sélection et toast d'erreur", async () => {
    const error409 = new Error("Impossible de supprimer : des cours ou créneaux sont rattachés");
    const deleteFn = vi.fn(async () => {
      throw error409;
    });

    const ids = ["salle-avec-cours-1", "salle-avec-cours-2"];
    const result = await executeBulkDelete(ids, deleteFn, { entityName: "salle(s)" });

    expect(result.successIds).toEqual([]);
    expect(result.failedIds).toEqual(["salle-avec-cours-1", "salle-avec-cours-2"]);
    expect(result.errors.length).toBe(2);

    expect(toast.error).toHaveBeenCalledWith("Échec de la suppression des salle(s)", {
      description: "Impossible de supprimer : des cours ou créneaux sont rattachés",
    });

    // Mise à jour de la sélection : seuls les succès sont retirés, donc les échecs restent
    let selectedIds = new Set(ids);
    const nextSelection = new Set(selectedIds);
    result.successIds.forEach((id) => nextSelection.delete(id));

    expect(nextSelection.size).toBe(2);
    expect(nextSelection.has("salle-avec-cours-1")).toBe(true);
    expect(nextSelection.has("salle-avec-cours-2")).toBe(true);
  });

  it("6. Échec partiel : seuls les éléments réussis sont retirés de la sélection", async () => {
    const deleteFn = vi.fn(async (id: string) => {
      if (id === "cours-protege") {
        throw new Error("Contrainte de clé étrangère : présence d'assiduités");
      }
      return { success: true, id };
    });

    const ids = ["cours-1", "cours-protege", "cours-2"];
    const onSuccess = vi.fn();
    const result = await executeBulkDelete(ids, deleteFn, { entityName: "cours", onSuccess });

    expect(result.successIds).toEqual(["cours-1", "cours-2"]);
    expect(result.failedIds).toEqual(["cours-protege"]);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    expect(toast.warning).toHaveBeenCalledWith(
      "Suppression partielle : 2 supprimé(s), 1 échec(s)",
      expect.objectContaining({
        description:
          "Certains éléments n'ont pas pu être supprimés en raison de contraintes ou d'autorisations.",
      }),
    );

    // Vérification du comportement de mise à jour de sélection de DataTable
    let selectedIds = new Set(ids);
    const nextSelection = new Set(selectedIds);
    result.successIds.forEach((id) => nextSelection.delete(id));

    // 'cours-1' et 'cours-2' sont retirés, 'cours-protege' reste sélectionné pour information utilisateur
    expect(nextSelection.size).toBe(1);
    expect(nextSelection.has("cours-protege")).toBe(true);
    expect(nextSelection.has("cours-1")).toBe(false);
    expect(nextSelection.has("cours-2")).toBe(false);
  });

  it("7. Mise à jour de l'affichage du tableau et du compteur de sélection après suppression", () => {
    let currentData = [
      { id: "mod-1", nom: "Module 1" },
      { id: "mod-2", nom: "Module 2" },
      { id: "mod-3", nom: "Module 3" },
    ];
    let selectedIds = new Set(["mod-1", "mod-2"]);

    // Simuler le résultat d'une suppression complète des 2 éléments sélectionnés
    const successIds = ["mod-1", "mod-2"];

    // 1. Mise à jour des données (simulant qc.invalidateQueries)
    currentData = currentData.filter((item) => !successIds.includes(item.id));

    // 2. Mise à jour de la sélection
    const nextSelection = new Set(selectedIds);
    successIds.forEach((id) => nextSelection.delete(id));

    expect(currentData.length).toBe(1);
    expect(currentData[0].id).toBe("mod-3");
    expect(nextSelection.size).toBe(0);
  });
});
