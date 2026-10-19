import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { CACHE_POLICIES, getCachePolicyForTable } from "@/lib/cache/cache-policies";
import { queryKeys } from "@/lib/cache/query-keys";
import { invalidateCacheDomain } from "@/lib/cache/invalidation";

describe("Frontend Cache System (TanStack Query)", () => {
  describe("1. Cache Policies (staleTime & gcTime)", () => {
    it("attribue la politique CONFIG aux paramètres système", () => {
      const policy = getCachePolicyForTable("annee_scolaire");
      expect(policy).toEqual(CACHE_POLICIES.CONFIG);
      expect(policy.staleTime).toBe(10 * 60 * 1000);
      expect(policy.gcTime).toBe(30 * 60 * 1000);
    });

    it("attribue la politique REFERENTIELS aux entités pédagogiques stables", () => {
      const tables = ["formations_types", "domaines", "programmes", "modules", "matieres", "salles"];
      for (const t of tables) {
        const policy = getCachePolicyForTable(t);
        expect(policy).toEqual(CACHE_POLICIES.REFERENTIELS);
        expect(policy.staleTime).toBe(5 * 60 * 1000);
      }
    });

    it("attribue la politique COURS_DOCUMENTS et CLASSES avec rétention 15 min", () => {
      expect(getCachePolicyForTable("cours")).toEqual(CACHE_POLICIES.COURS_DOCUMENTS);
      expect(getCachePolicyForTable("documents")).toEqual(CACHE_POLICIES.COURS_DOCUMENTS);
      expect(getCachePolicyForTable("classes")).toEqual(CACHE_POLICIES.CLASSES);
      expect(getCachePolicyForTable("classes").staleTime).toBe(2 * 60 * 1000);
    });

    it("attribue des durées courtes aux flux temps-réel et financiers", () => {
      expect(getCachePolicyForTable("emploi_du_temps").staleTime).toBe(45 * 1000);
      expect(getCachePolicyForTable("notes").staleTime).toBe(45 * 1000);
      expect(getCachePolicyForTable("absences").staleTime).toBe(30 * 1000);
      expect(getCachePolicyForTable("paiements").staleTime).toBe(20 * 1000);
      expect(getCachePolicyForTable("notifications").staleTime).toBe(30 * 1000);
    });

    it("interdit la mise en cache persistante des tables de sécurité", () => {
      const secTables = ["profiles", "user_roles", "audit_log", "login_audit"];
      for (const t of secTables) {
        const policy = getCachePolicyForTable(t);
        expect(policy.staleTime).toBe(0);
        expect(policy.gcTime).toBe(0);
      }
    });

    it("retourne la politique DEFAULT pour une table inconnue", () => {
      const policy = getCachePolicyForTable("table_inconnue");
      expect(policy).toEqual(CACHE_POLICIES.DEFAULT);
    });
  });

  describe("2. Query Key Factory", () => {
    it("génère des clés cohérentes pour les tables standard et filtrées", () => {
      expect(queryKeys.table("cours", { classeId: "c1" })).toEqual(["cours", { classeId: "c1" }]);
      expect(queryKeys.formationsTypes.all()).toEqual(["formations_types"]);
      expect(queryKeys.domaines.byFormationType("ft-1")).toEqual(["domaines", { typeId: "ft-1" }]);
    });

    it("génère des clés isolées pour l'espace enseignant", () => {
      expect(queryKeys.teacherSpace.matieres("u123")).toEqual(["ens-matieres", "u123"]);
      expect(queryKeys.teacherSpace.cours("u123")).toEqual(["ens-cours", "u123"]);
      expect(queryKeys.teacherSpace.edt("u123")).toEqual(["ens-edt", "u123"]);
    });

    it("génère des clés isolées pour l'espace étudiant", () => {
      expect(queryKeys.studentSpace.notes("stu-456")).toEqual(["etu-notes", "stu-456"]);
      expect(queryKeys.studentSpace.absences("stu-456")).toEqual(["etu-absences", "stu-456"]);
      expect(queryKeys.studentSpace.paiements("stu-456")).toEqual(["etu-paiements", "stu-456"]);
    });
  });

  describe("3. Invalidation en cascade (invalidateCacheDomain)", () => {
    it("invalide le domaine cours et ses requêtes dérivées (enseignant, étudiant, docs)", async () => {
      const qc = new QueryClient();

      qc.setQueryData(["cours", { classeId: "c1" }], [{ id: "1" }]);
      qc.setQueryData(["ens-cours", "prof-1"], [{ id: "1" }]);
      qc.setQueryData(["etu-cours", ["c1"]], [{ id: "1" }]);
      qc.setQueryData(["docs-cours", ["1"]], [{ id: "d1" }]);
      qc.setQueryData(["salles"], [{ id: "s1" }]); // indépendant

      expect(qc.getQueryState(["cours", { classeId: "c1" }])?.isInvalidated).toBe(false);
      expect(qc.getQueryState(["ens-cours", "prof-1"])?.isInvalidated).toBe(false);

      await invalidateCacheDomain(qc, "cours");

      expect(qc.getQueryState(["cours", { classeId: "c1" }])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["ens-cours", "prof-1"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["etu-cours", ["c1"]])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["docs-cours", ["1"]])?.isInvalidated).toBe(true);
      // Salles ne doit pas être invalidé
      expect(qc.getQueryState(["salles"])?.isInvalidated).toBe(false);
    });

    it("invalide le domaine classes et les inscriptions liées", async () => {
      const qc = new QueryClient();

      qc.setQueryData(["classes"], [{ id: "c1" }]);
      qc.setQueryData(["classe_etudiants", { classeId: "c1" }], [{ id: "ce1" }]);
      qc.setQueryData(["ens-classes", "prof-1"], [{ id: "c1" }]);
      qc.setQueryData(["etu-classes", "stu-1"], [{ id: "c1" }]);
      qc.setQueryData(["ens-etudiants", ["c1"]], [{ id: "stu-1" }]);

      await invalidateCacheDomain(qc, "classes");

      expect(qc.getQueryState(["classes"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["classe_etudiants", { classeId: "c1" }])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["ens-classes", "prof-1"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["etu-classes", "stu-1"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["ens-etudiants", ["c1"]])?.isInvalidated).toBe(true);
    });

    it("invalide les notes et les examens lors d'une mutation de notes", async () => {
      const qc = new QueryClient();

      qc.setQueryData(["notes"], [{ id: "n1" }]);
      qc.setQueryData(["etu-notes", "stu-1"], [{ id: "n1" }]);
      qc.setQueryData(["ens-notes-examens", ["ex1"]], [{ id: "n1" }]);

      await invalidateCacheDomain(qc, "notes");

      expect(qc.getQueryState(["notes"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["etu-notes", "stu-1"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["ens-notes-examens", ["ex1"]])?.isInvalidated).toBe(true);
    });

    it("invalide les absences lors d'une mutation d'absences", async () => {
      const qc = new QueryClient();

      qc.setQueryData(["absences"], [{ id: "a1" }]);
      qc.setQueryData(["etu-absences", "stu-1"], [{ id: "a1" }]);

      await invalidateCacheDomain(qc, "absences");

      expect(qc.getQueryState(["absences"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["etu-absences", "stu-1"])?.isInvalidated).toBe(true);
    });

    it("invalide les paiements étudiants et enseignants lors de mutations financières", async () => {
      const qc = new QueryClient();

      qc.setQueryData(["paiements"], [{ id: "p1" }]);
      qc.setQueryData(["etu-paiements", "stu-1"], [{ id: "p1" }]);

      await invalidateCacheDomain(qc, "paiements");

      expect(qc.getQueryState(["paiements"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["etu-paiements", "stu-1"])?.isInvalidated).toBe(true);

      qc.setQueryData(["paiements_enseignants"], [{ id: "pe1" }]);
      qc.setQueryData(["ens-paiements", "prof-1"], [{ id: "pe1" }]);

      await invalidateCacheDomain(qc, "paiements_enseignants");

      expect(qc.getQueryState(["paiements_enseignants"])?.isInvalidated).toBe(true);
      expect(qc.getQueryState(["ens-paiements", "prof-1"])?.isInvalidated).toBe(true);
    });
  });
});