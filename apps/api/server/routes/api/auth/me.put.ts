import { eventHandler, readBody } from "h3";
import { requireAuth, resolvePrimaryRole } from "../../../utils/auth";
import { prisma } from "../../../utils/prisma";
import { updateMyProfileSchema } from "../../../validators/profile.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const body = await readBody(event);

  const parsed = updateMyProfileSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données de mise à jour du profil invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  const dataToUpdate: any = {};
  const allowed = [
    "nom",
    "prenom",
    "telephone",
    "adresse",
    "bio",
    "specialite",
    "avatar_url",
  ];

  for (const field of allowed) {
    if (parsed.data[field as keyof typeof parsed.data] !== undefined) {
      dataToUpdate[field] = parsed.data[field as keyof typeof parsed.data];
    }
  }

  if (parsed.data.date_naissance !== undefined) {
    dataToUpdate.date_naissance = parsed.data.date_naissance
      ? new Date(parsed.data.date_naissance)
      : null;
  }

  const updatedProfile = await prisma.profile.update({
    where: { id: auth.user.id },
    data: dataToUpdate,
  });

  return {
    user: updatedProfile,
    roles: auth.roles,
    role: resolvePrimaryRole(auth.roles),
  };
});
