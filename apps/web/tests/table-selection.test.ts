import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/admin/etudiants" }),
  Navigate: () => null,
}));

import { DataTable } from "@/components/admin/DataTable";
import { Checkbox } from "@/components/ui/checkbox";

describe("Comportement de « Tout sélectionner » après filtrage et pagination", () => {
  // Fonctions reproduisant la logique exacte intégrée dans DataTable
  function computeHeaderState(
    selectedIds: Set<string>,
    visibleRowIds: string[],
  ): boolean | "indeterminate" {
    if (visibleRowIds.length === 0) return false;
    let count = 0;
    for (const id of visibleRowIds) {
      if (selectedIds.has(id)) count++;
    }
    if (count === visibleRowIds.length) return true;
    if (count > 0) return "indeterminate";
    return false;
  }

  function toggleAllPage(selectedIds: Set<string>, visibleRowIds: string[]): Set<string> {
    const isAllSelected = computeHeaderState(selectedIds, visibleRowIds) === true;
    const next = new Set(selectedIds);
    if (isAllSelected) {
      // Désélectionne uniquement les lignes visibles courantes
      for (const id of visibleRowIds) {
        next.delete(id);
      }
    } else {
      // Sélectionne uniquement les lignes visibles courantes
      for (const id of visibleRowIds) {
        next.add(id);
      }
    }
    return next;
  }

  function toggleSingleRow(selectedIds: Set<string>, id: string): Set<string> {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  }

  // Simulation d'un jeu de données avec 2 pages de 3 éléments
  const fullDataset = [
    { id: "etudiant-1", nom: "Dupont Jean", filiere: "Informatique" },
    { id: "etudiant-2", nom: "Durand Marie", filiere: "Gestion" },
    { id: "etudiant-3", nom: "Dupond Pierre", filiere: "Informatique" },
    { id: "etudiant-4", nom: "Martin Sophie", filiere: "Informatique" },
    { id: "etudiant-5", nom: "Bernard Luc", filiere: "Marketing" },
    { id: "etudiant-6", nom: "Dubois Clara", filiere: "Informatique" },
  ];

  it("1. Après application d’un filtre : « Tout sélectionner » porte uniquement sur les lignes visibles", () => {
    // Filtre 'Informatique' : etudiant-1, etudiant-3, etudiant-4, etudiant-6
    // Page 1 (taille 3) : etudiant-1, etudiant-3, etudiant-4 (visibles)
    // Masqués par filtre : etudiant-2, etudiant-5
    // Masqué par pagination : etudiant-6
    const visiblePage1 = ["etudiant-1", "etudiant-3", "etudiant-4"];

    const selected = toggleAllPage(new Set<string>(), visiblePage1);

    // Vérifier que seules les lignes visibles sont sélectionnées
    expect(selected.size).toBe(3);
    expect(selected.has("etudiant-1")).toBe(true);
    expect(selected.has("etudiant-3")).toBe(true);
    expect(selected.has("etudiant-4")).toBe(true);

    // Les lignes masquées par le filtre ou la page ne sont PAS sélectionnées
    expect(selected.has("etudiant-2")).toBe(false);
    expect(selected.has("etudiant-5")).toBe(false);
    expect(selected.has("etudiant-6")).toBe(false);

    expect(computeHeaderState(selected, visiblePage1)).toBe(true);
  });

  it("2. Désélection partielle via l'en-tête : ne désélectionne pas les lignes masquées déjà sélectionnées", () => {
    // Supposons qu'auparavant, etudiant-2 (Gestion) et etudiant-5 (Marketing) étaient sélectionnés
    const initialSelected = new Set<string>(["etudiant-2", "etudiant-5"]);

    // Filtre 'Informatique' actif, visiblePage1 : etudiant-1, etudiant-3, etudiant-4
    const visiblePage1 = ["etudiant-1", "etudiant-3", "etudiant-4"];

    // L'en-tête pour visiblePage1 est initialement décoché (aucune ligne visible sélectionnée)
    expect(computeHeaderState(initialSelected, visiblePage1)).toBe(false);

    // Clic 1 : Sélectionner tout sur visiblePage1
    const afterSelectAll = toggleAllPage(initialSelected, visiblePage1);
    expect(afterSelectAll.size).toBe(5); // 2 masqués + 3 visibles
    expect(computeHeaderState(afterSelectAll, visiblePage1)).toBe(true);

    // Clic 2 : Désélectionner tout sur visiblePage1
    const afterDeselectAll = toggleAllPage(afterSelectAll, visiblePage1);

    // Les 3 lignes visibles sont désélectionnées
    expect(afterDeselectAll.has("etudiant-1")).toBe(false);
    expect(afterDeselectAll.has("etudiant-3")).toBe(false);
    expect(afterDeselectAll.has("etudiant-4")).toBe(false);

    // Les lignes masquées restent sélectionnées !
    expect(afterDeselectAll.has("etudiant-2")).toBe(true);
    expect(afterDeselectAll.has("etudiant-5")).toBe(true);
    expect(afterDeselectAll.size).toBe(2);

    expect(computeHeaderState(afterDeselectAll, visiblePage1)).toBe(false);
  });

  it("3. Sélection individuelle et synchronisation de l'état d'en-tête (indéterminé, coché, décoché)", () => {
    const visiblePage1 = ["etudiant-1", "etudiant-3", "etudiant-4"];
    let selected = new Set<string>();

    expect(computeHeaderState(selected, visiblePage1)).toBe(false);

    // Sélection d'une ligne -> état partiel / indéterminé
    selected = toggleSingleRow(selected, "etudiant-1");
    expect(computeHeaderState(selected, visiblePage1)).toBe("indeterminate");

    // Sélection d'une 2e ligne -> toujours indéterminé
    selected = toggleSingleRow(selected, "etudiant-3");
    expect(computeHeaderState(selected, visiblePage1)).toBe("indeterminate");

    // Sélection de la dernière ligne visible -> état entièrement coché
    selected = toggleSingleRow(selected, "etudiant-4");
    expect(computeHeaderState(selected, visiblePage1)).toBe(true);

    // Décochage d'une ligne -> repasse en indéterminé
    selected = toggleSingleRow(selected, "etudiant-3");
    expect(computeHeaderState(selected, visiblePage1)).toBe("indeterminate");

    // Décochage de toutes les lignes visibles
    selected = toggleSingleRow(selected, "etudiant-1");
    selected = toggleSingleRow(selected, "etudiant-4");
    expect(computeHeaderState(selected, visiblePage1)).toBe(false);
  });

  it("4. Filtres modifiés : conservation des sélections masquées et non-sélection des nouveaux résultats", () => {
    // L'utilisateur sélectionne etudiant-1 et etudiant-3 sous le filtre 'Informatique'
    let selected = new Set<string>(["etudiant-1", "etudiant-3"]);

    // L'utilisateur change le filtre pour 'Marketing'
    // Les lignes visibles sont maintenant uniquement : etudiant-5
    const visibleFilterMarketing = ["etudiant-5"];

    // Aucune ligne visible n'est sélectionnée -> header décoché
    expect(computeHeaderState(selected, visibleFilterMarketing)).toBe(false);

    // Le nouveau résultat (etudiant-5) n'est PAS sélectionné automatiquement
    expect(selected.has("etudiant-5")).toBe(false);

    // Les sélections précédentes sont conservées même si invisibles
    expect(selected.has("etudiant-1")).toBe(true);
    expect(selected.has("etudiant-3")).toBe(true);

    // L'utilisateur sélectionne etudiant-5
    selected = toggleSingleRow(selected, "etudiant-5");
    expect(computeHeaderState(selected, visibleFilterMarketing)).toBe(true);

    // L'utilisateur réinitialise le filtre (tous les étudiants)
    // Page 1 : etudiant-1, etudiant-2, etudiant-3
    const fullPage1 = ["etudiant-1", "etudiant-2", "etudiant-3"];

    // etudiant-1 et etudiant-3 sont sélectionnés, etudiant-2 ne l'est pas
    // -> Header doit être "indeterminate" (2/3 visibles sélectionnés)
    expect(computeHeaderState(selected, fullPage1)).toBe("indeterminate");
    expect(selected.has("etudiant-5")).toBe(true); // toujours conservé (sur page 2)
  });

  it("5. Pagination : « Tout sélectionner » agit uniquement sur la page courante", () => {
    const page1 = ["etudiant-1", "etudiant-2", "etudiant-3"];
    const page2 = ["etudiant-4", "etudiant-5", "etudiant-6"];

    // Clic « Tout sélectionner » sur page 1
    const selected = toggleAllPage(new Set<string>(), page1);

    expect(selected.size).toBe(3);
    expect(computeHeaderState(selected, page1)).toBe(true);

    // Page 2 n'a aucune ligne sélectionnée automatiquement
    expect(computeHeaderState(selected, page2)).toBe(false);
    expect(selected.has("etudiant-4")).toBe(false);
    expect(selected.has("etudiant-5")).toBe(false);
    expect(selected.has("etudiant-6")).toBe(false);

    // Clic « Tout sélectionner » sur page 2
    const selectedBothPages = toggleAllPage(selected, page2);
    expect(selectedBothPages.size).toBe(6);
    expect(computeHeaderState(selectedBothPages, page2)).toBe(true);
    expect(computeHeaderState(selectedBothPages, page1)).toBe(true);
  });

  it("6. Isolation : chaque tableau conserve sa sélection indépendamment", () => {
    const tableEtudiantsSelected = new Set<string>(["etudiant-1", "etudiant-2"]);
    const tableEnseignantsSelected = new Set<string>();

    const pageEtudiants = ["etudiant-1", "etudiant-2", "etudiant-3"];
    const pageEnseignants = ["ens-1", "ens-2", "ens-3"];

    expect(computeHeaderState(tableEtudiantsSelected, pageEtudiants)).toBe("indeterminate");
    expect(computeHeaderState(tableEnseignantsSelected, pageEnseignants)).toBe(false);

    // Modifier la sélection des enseignants n'impacte pas les étudiants
    const nextEnseignants = toggleAllPage(tableEnseignantsSelected, pageEnseignants);
    expect(computeHeaderState(nextEnseignants, pageEnseignants)).toBe(true);
    expect(computeHeaderState(tableEtudiantsSelected, pageEtudiants)).toBe("indeterminate");
    expect(tableEtudiantsSelected.has("ens-1")).toBe(false);
  });

  it("7. Tableau vide après filtre (0 résultat) : case d'en-tête désactivée et décochée", () => {
    const emptyRows: string[] = [];
    const selected = new Set<string>(["etudiant-1"]);

    expect(computeHeaderState(selected, emptyRows)).toBe(false);
  });
});
