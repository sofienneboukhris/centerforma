import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = [
  "super_admin",
  "directeur",
  "responsable_pedagogique",
  "comptable",
  "enseignant",
  "etudiant",
] as const;

const createSchema = z.object({
  role: z.enum(ROLES),
  nom: z.string().trim().min(1).max(120),
  prenom: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(255),
  telephone: z.string().trim().max(40).optional().nullable(),
  password: z
    .string()
    .min(8, "8 caractères minimum")
    .max(72)
    .regex(/[A-Za-z]/, "Au moins une lettre")
    .regex(/[0-9]/, "Au moins un chiffre"),
});


async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_any_role", {
    _user_id: context.userId,
    _roles: ["super_admin", "directeur"],
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = data.password;
    const fullNom = [data.prenom?.trim(), data.nom.trim()].filter(Boolean).join(" ");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim(),
      password,
      email_confirm: true,
      user_metadata: { nom: fullNom },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    if (data.role !== "etudiant") {
      const { error: upRole } = await supabaseAdmin
        .from("user_roles")
        .update({ role: data.role })
        .eq("user_id", uid);
      if (upRole) throw new Error(upRole.message);
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        nom: fullNom || data.nom.trim(),
        email: data.email.trim(),
        telephone: data.telephone?.trim() || null,
      })
      .eq("id", uid);

    return { userId: uid };
  });

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        password: z
          .string()
          .min(8, "8 caractères minimum")
          .max(72)
          .regex(/[A-Za-z]/, "Au moins une lettre")
          .regex(/[0-9]/, "Au moins un chiffre"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
