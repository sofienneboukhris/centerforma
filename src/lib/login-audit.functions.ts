import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { buildAuditRow } from "./login-audit-identity";

const ROLES = [
  "super_admin",
  "directeur",
  "responsable_pedagogique",
  "comptable",
  "enseignant",
  "etudiant",
] as const;

const schema = z.object({
  email: z.string().trim().max(255),
  userId: z.string().uuid().optional().nullable(),
  role: z.enum(ROLES).optional().nullable(),
  success: z.boolean(),
  reason: z.string().trim().max(300).optional().nullable(),
});

/**
 * Journalise une tentative de connexion (succès ou échec).
 * Point d'entrée public : appelé depuis les pages de connexion, y compris
 * lorsqu'aucune session n'existe. Aucun mot de passe n'est transmis ni stocké.
 */
export const logLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let ip: string | null = null;
      try {
        ip = getRequestIP({ xForwardedFor: true }) ?? null;
      } catch {
        ip = null;
      }
      const userAgent = getRequestHeader("user-agent") ?? null;

      // Identité dérivée uniquement du jeton vérifié côté serveur —
      // les userId/role fournis par le client sont ignorés.
      let verifiedId: string | null = null;
      let verifiedEmail: string | null = null;
      let verifiedRole: (typeof ROLES)[number] | null = null;
      const authHeader = getRequestHeader("authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (token) {
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        if (u?.user) {
          verifiedId = u.user.id;
          verifiedEmail = u.user.email?.toLowerCase() ?? null;
          const { data: roles } = await supabaseAdmin
            .from("user_roles").select("role").eq("user_id", verifiedId);
          const list = (roles ?? []).map((r) => r.role as string);
          verifiedRole = (ROLES.find((r) => list.includes(r)) ?? null) as typeof verifiedRole;
        }
      }
      const row = buildAuditRow(
        data,
        verifiedId ? { id: verifiedId, email: verifiedEmail, role: verifiedRole } : null,
      );
      await supabaseAdmin.from("login_audit").insert({
        ...row,
        role: row.role as (typeof ROLES)[number] | null,
        ip,
        user_agent: userAgent ? userAgent.slice(0, 400) : null,
      });
    } catch {
      // La journalisation ne doit jamais bloquer la connexion.
    }
    return { ok: true };
  });
