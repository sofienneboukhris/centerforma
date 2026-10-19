import { eventHandler } from "h3";
import { prisma } from "../../../../utils/prisma";
import { requireRoles } from "../../../../utils/auth";

export default eventHandler(async (event) => {
  // Contrôle RBAC : réservé aux administrateurs (super_admin et directeur)
  await requireRoles(event, ["super_admin", "directeur"]);

  const totalProfiles = await prisma.profile.count();

  // Profils nécessitant une intervention (sans rôle attribué ou sans e-mail valide)
  const attentionRequiredList = await prisma.profile.findMany({
    where: {
      OR: [
        { email: null },
        { email: "" },
        { roles: { none: {} } },
      ],
    },
    select: { id: true },
  });
  const accountsRequiringAttention = attentionRequiredList.length;

  // Profils avec identifiants locaux configurés
  const migratedProfiles = await prisma.userCredential.count();
  const eligibleProfiles = Math.max(0, totalProfiles - accountsRequiringAttention);
  const unmigratedProfiles = Math.max(0, eligibleProfiles - migratedProfiles);

  const percentage =
    eligibleProfiles > 0
      ? Math.round((migratedProfiles / eligibleProfiles) * 1000) / 10
      : 100;

  // Répartition des profils non migrés par rôle (agrégation stricte, aucune fuite de PII)
  const unmigratedUsers = await prisma.profile.findMany({
    where: {
      credential: null,
    },
    select: {
      id: true,
      roles: {
        select: { role: true },
      },
    },
  });

  const unmigratedByRole: Record<string, number> = {};
  for (const u of unmigratedUsers) {
    if (!u.roles || u.roles.length === 0) {
      unmigratedByRole["sans_role"] = (unmigratedByRole["sans_role"] || 0) + 1;
    } else {
      for (const r of u.roles) {
        unmigratedByRole[r.role] = (unmigratedByRole[r.role] || 0) + 1;
      }
    }
  }

  // Répartition des profils migrés par rôle
  const migratedUsers = await prisma.profile.findMany({
    where: {
      credential: { isNot: null },
    },
    select: {
      roles: {
        select: { role: true },
      },
    },
  });

  const migratedByRole: Record<string, number> = {};
  for (const u of migratedUsers) {
    for (const r of u.roles) {
      migratedByRole[r.role] = (migratedByRole[r.role] || 0) + 1;
    }
  }

  return {
    status: unmigratedProfiles === 0 ? "completed" : "in_progress",
    summary: {
      totalProfiles,
      eligibleProfiles,
      migratedProfiles,
      unmigratedProfiles,
      accountsRequiringAttention,
      completionPercentage: percentage,
    },
    breakdown: {
      unmigratedByRole,
      migratedByRole,
    },
    recommendation:
      unmigratedProfiles === 0
        ? "Tous les comptes éligibles sont migrés avec succès vers Nitro/Prisma. Le client @supabase/supabase-js peut être retiré en toute sécurité dès que les comptes nécessitant une intervention sont résolus."
        : "Des comptes historiques subsistent. Maintenir le fallback de transition actif jusqu'à complétion.",
  };
});
