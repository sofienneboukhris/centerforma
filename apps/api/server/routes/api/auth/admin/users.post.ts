import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../../utils/error";
import { prisma } from "../../../../utils/prisma";
import { requireRoles, hashPassword, type AppRole } from "../../../../utils/auth";
import { adminCreateUserSchema } from "../../../../validators/auth.schema";

export default eventHandler(async (event) => {
  // 1. Contrôle RBAC strict : seuls super_admin et directeur
  const auth = await requireRoles(event, ["super_admin", "directeur"]);

  // 2. Lecture et validation
  const body = await readBody(event).catch(() => ({}));
  const parseResult = adminCreateUserSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de création de compte invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const { role, nom, prenom, email, telephone, password, diplome, specialite, adresse, tarif_horaire } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Contrôle de non-élévation de privilèges : seul un super_admin peut créer un autre super_admin
  if (role === "super_admin" && !auth.roles.includes("super_admin")) {
    throw createError({
      statusCode: 403,
      message: "Seul un super administrateur peut créer un autre compte super administrateur.",
    });
  }

  // 3. Vérification d'unicité
  const existing = await prisma.userCredential.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw createError({
      statusCode: 409,
      message: "Un compte existe déjà avec cette adresse e-mail.",
    });
  }

  // 4. Hachage sécurisé
  const passwordHash = await hashPassword(password);

  // 5. Création transactionnelle
  const created = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.create({
      data: {
        nom: nom.trim(),
        prenom: prenom?.trim() || null,
        email: normalizedEmail,
        telephone: telephone?.trim() || null,
      },
    });

    await tx.userCredential.create({
      data: {
        user_id: profile.id,
        email: normalizedEmail,
        password_hash: passwordHash,
        email_verified: true, // Créé par l'administration -> certifié
      },
    });

    await tx.userRole.create({
      data: {
        user_id: profile.id,
        role: role as AppRole,
      },
    });

    if (role === "enseignant") {
      await tx.enseignantInfo.create({
        data: {
          profile_id: profile.id,
          diplome: diplome?.trim() || null,
          specialite: specialite?.trim() || null,
          adresse: adresse?.trim() || null,
          tarif_horaire: tarif_horaire != null ? tarif_horaire : 0,
        },
      });
    } else if (role === "etudiant") {
      await tx.etudiantInfo.create({
        data: {
          profile_id: profile.id,
        },
      });
    }

    return profile;
  });

  setResponseStatus(event, 201);
  return {
    userId: created.id,
    nom: created.nom,
    prenom: created.prenom,
    email: created.email,
    role,
  };
});
