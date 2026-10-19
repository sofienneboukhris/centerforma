import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../server/utils/prisma";

describe("Prisma ORM & PostgreSQL Local Integration", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("se connecte avec succès à la base PostgreSQL centerforma_dev", async () => {
    const count = await prisma.formationType.count();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("permet d'effectuer des opérations CRUD typées sans régression", async () => {
    const testCode = `TEST_${Date.now()}`;
    const created = await prisma.formationType.create({
      data: {
        code: testCode,
        nom: "Formation Test Prisma",
        description: "Test automatisé de validation",
      },
    });

    expect(created.id).toBeDefined();
    expect(created.code).toBe(testCode);

    const fetched = await prisma.formationType.findUnique({
      where: { code: testCode },
    });
    expect(fetched?.nom).toBe("Formation Test Prisma");

    await prisma.formationType.delete({
      where: { id: created.id },
    });

    const deleted = await prisma.formationType.findUnique({
      where: { id: created.id },
    });
    expect(deleted).toBeNull();
  });

  it("vérifie la présence et le typage des tables principales", async () => {
    const [profilesCount, matieresCount, absencesCount] = await Promise.all([
      prisma.profile.count(),
      prisma.matiere.count(),
      prisma.absence.count(),
    ]);

    expect(typeof profilesCount).toBe("number");
    expect(typeof matieresCount).toBe("number");
    expect(typeof absencesCount).toBe("number");
  });
});
