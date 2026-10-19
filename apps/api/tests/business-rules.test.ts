import { describe, it, expect } from "vitest";
import {
  resolvePrimaryRole,
  matchesRoleGroup,
  ADMIN_ROLES,
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  hashToken,
  signJwt,
  verifyJwt,
  type AppRole,
} from "../server/utils/auth";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  adminCreateUserSchema,
} from "../server/validators/auth.schema";
import {
  createFormationTypeSchema,
  updateFormationTypeSchema,
  idParamSchema,
} from "../server/validators/formationType.schema";

describe("Règles Métier Unitaires : Rôles, Permissions & Sécurité", () => {
  describe("1. Hiérarchie et résolution des rôles (resolvePrimaryRole)", () => {
    it("privilégie super_admin sur les autres rôles subordonnés", () => {
      const roles: AppRole[] = ["etudiant", "enseignant", "super_admin", "comptable"];
      expect(resolvePrimaryRole(roles)).toBe("super_admin");
    });

    it("privilégie directeur si super_admin n'est pas présent", () => {
      const roles: AppRole[] = ["etudiant", "directeur", "enseignant"];
      expect(resolvePrimaryRole(roles)).toBe("directeur");
    });

    it("renvoie null pour une liste de rôles vide", () => {
      expect(resolvePrimaryRole([])).toBeNull();
    });

    it("vérifie l'appartenance aux groupes de portail (matchesRoleGroup)", () => {
      expect(matchesRoleGroup("super_admin", "admin")).toBe(true);
      expect(matchesRoleGroup("directeur", "admin")).toBe(true);
      expect(matchesRoleGroup("responsable_pedagogique", "admin")).toBe(true);
      expect(matchesRoleGroup("comptable", "admin")).toBe(true);

      // Étudiant ou enseignant ne font pas partie du groupe admin
      expect(matchesRoleGroup("etudiant", "admin")).toBe(false);
      expect(matchesRoleGroup("enseignant", "admin")).toBe(false);

      // Correspondances directes
      expect(matchesRoleGroup("enseignant", "enseignant")).toBe(true);
      expect(matchesRoleGroup("etudiant", "etudiant")).toBe(true);
      expect(matchesRoleGroup("super_admin", "etudiant")).toBe(false);
      expect(matchesRoleGroup(null, "admin")).toBe(false);
    });
  });

  describe("2. Cryptographie & Hachage sécurisé", () => {
    it("hache les mots de passe et empêche le stockage en clair", async () => {
      const password = "SecuredPassword2026!";
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword("WrongPassword123!", hash);
      expect(isInvalid).toBe(false);
    });

    it("génère des jetons de rafraîchissement aléatoires et hache de façon déterministe", () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(80); // 40 bytes hex

      const hash1a = hashToken(token1);
      const hash1b = hashToken(token1);
      expect(hash1a).toBe(hash1b); // SHA-256 déterministe
      expect(hash1a).not.toBe(hashToken(token2));
    });

    it("signe et vérifie les jetons JWT avec gestion d'expiration et intégrité", () => {
      const secret = "test_custom_secret_key_1234567890";
      const payload = { sub: "123e4567-e89b-12d3-a456-426614174000", email: "user@test.tn" };

      // Jeton valide
      const token = signJwt(payload, secret, 3600);
      const decoded = verifyJwt(token, secret);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe(payload.sub);
      expect(decoded?.email).toBe(payload.email);

      // Signature falsifiée
      const parts = token.split(".");
      const forgedToken = `${parts[0]}.${parts[1]}.badsignature`;
      expect(verifyJwt(forgedToken, secret)).toBeNull();

      // Signature avec un mauvais secret
      expect(verifyJwt(token, "autre_mauvais_secret")).toBeNull();

      // Jeton expiré (-10 secondes)
      const expiredToken = signJwt(payload, secret, -10);
      expect(verifyJwt(expiredToken, secret)).toBeNull();
    });
  });

  describe("3. Schémas de validation Zod (auth.schema)", () => {
    it("valide les identifiants de connexion conformes", () => {
      const valid = loginSchema.safeParse({
        email: "admin@centerforma.test",
        password: "MyPassword123!",
        portal: "admin",
      });
      expect(valid.success).toBe(true);
    });

    it("refuse un email invalide à la connexion", () => {
      const invalid = loginSchema.safeParse({
        email: "adresse_invalide_sans_arobase",
        password: "MyPassword123!",
      });
      expect(invalid.success).toBe(false);
    });

    it("refuse l'inscription si le mot de passe ne contient pas de chiffre", () => {
      const res = registerSchema.safeParse({
        nom: "Ben Salah",
        prenom: "Karim",
        email: "karim@test.tn",
        password: "NoNumberPassword!",
      });
      expect(res.success).toBe(false);
    });

    it("refuse l'inscription si le mot de passe fait moins de 8 caractères", () => {
      const res = registerSchema.safeParse({
        nom: "Ben Salah",
        email: "karim@test.tn",
        password: "Short1!",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("4. Schémas de validation Zod (formationType.schema)", () => {
    it("valide la création d'un type de formation conforme", () => {
      const res = createFormationTypeSchema.safeParse({
        code: "BTS",
        nom: "Brevet de Technicien Supérieur",
        description: "Formation professionnelle",
      });
      expect(res.success).toBe(true);
    });

    it("rejette un code de formation vide ou constitué uniquement d'espaces", () => {
      const res = createFormationTypeSchema.safeParse({
        code: "   ",
        nom: "Formation Test",
      });
      expect(res.success).toBe(false);
    });

    it("rejette un code dépassant 20 caractères", () => {
      const res = createFormationTypeSchema.safeParse({
        code: "CODE_BEAUCOUP_TROP_LONG_POUR_ETRE_VALIDE",
        nom: "Formation Trop Longue",
      });
      expect(res.success).toBe(false);
    });

    it("valide les identifiants UUID et rejette les chaînes quelconques (idParamSchema)", () => {
      expect(idParamSchema.safeParse({ id: "98e4567a-e89b-12d3-a456-426614174000" }).success).toBe(true);
      expect(idParamSchema.safeParse({ id: "non-uuid-string" }).success).toBe(false);
      expect(idParamSchema.safeParse({ id: "12345" }).success).toBe(false);
    });
  });
});
