import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listMatieresHandler from "../server/routes/api/matieres/index.get";
import listCoursHandler from "../server/routes/api/cours/index.get";
import listEmploiHandler from "../server/routes/api/emploi-du-temps/index.get";

describe("Sécurité Enseignant : Isolation des données du dashboard", () => {
  let teacherAProfile: any;
  let teacherBProfile: any;
  let teacherAToken: string;
  let teacherBToken: string;
  let adminToken: string;
  const ts = Date.now().toString().slice(-6);

  function makeEvent({
    method = "GET",
    token,
    query,
  }: {
    method?: string;
    token?: string;
    query?: Record<string, string>;
  }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }
    const req: any = {
      method,
      headers,
      url: query ? `/?${new URLSearchParams(query).toString()}` : "/",
    };
    const res: any = {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
    };
    const event = createEvent(req, res);
    if (query) {
      event.node.req.url = `/?${new URLSearchParams(query).toString()}`;
    }
    return event;
  }

  beforeAll(async () => {
    // 1. Super Admin
    const adminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (!adminRole?.user) throw new Error("Aucun administrateur trouvé");
    adminToken = signJwt({ sub: adminRole.user.id, email: adminRole.user.email || undefined });

    // 2. Enseignant A
    teacherAProfile = await prisma.profile.create({
      data: {
        nom: `ProfA_${ts}`,
        email: `profa_${ts}@test.tn`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherAToken = signJwt({ sub: teacherAProfile.id, email: teacherAProfile.email });

    // 3. Enseignant B
    teacherBProfile = await prisma.profile.create({
      data: {
        nom: `ProfB_${ts}`,
        email: `profb_${ts}@test.tn`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherBToken = signJwt({ sub: teacherBProfile.id, email: teacherBProfile.email });
  });

  afterAll(async () => {
    if (teacherAProfile?.id) {
      await prisma.userRole.deleteMany({ where: { user_id: teacherAProfile.id } });
      await prisma.profile.deleteMany({ where: { id: teacherAProfile.id } });
    }
    if (teacherBProfile?.id) {
      await prisma.userRole.deleteMany({ where: { user_id: teacherBProfile.id } });
      await prisma.profile.deleteMany({ where: { id: teacherBProfile.id } });
    }
    await prisma.$disconnect();
  });

  describe("1. Matières (/api/matieres)", () => {
    it("Un enseignant peut lister ses propres matières sans erreur", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherAProfile.id },
      });
      const res = await listMatieresHandler(event);
      expect(Array.isArray(res)).toBe(true);
    });

    it("Un enseignant NE PEUT PAS accéder aux matières d'un autre enseignant (403)", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherBProfile.id },
      });
      await expect(listMatieresHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas accéder aux matières d'un autre enseignant"),
      });
    });

    it("Un administrateur peut filtrer les matières par n'importe quel enseignant", async () => {
      const event = makeEvent({
        token: adminToken,
        query: { enseignant_id: teacherAProfile.id },
      });
      const res = await listMatieresHandler(event);
      expect(Array.isArray(res)).toBe(true);
    });
  });

  describe("2. Cours (/api/cours)", () => {
    it("Un enseignant peut lister ses propres cours sans erreur", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherAProfile.id },
      });
      const res = await listCoursHandler(event);
      expect(Array.isArray(res)).toBe(true);
    });

    it("Un enseignant NE PEUT PAS accéder aux cours d'un autre enseignant (403)", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherBProfile.id },
      });
      await expect(listCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas accéder aux cours d'un autre enseignant"),
      });
    });

    it("Un administrateur peut filtrer les cours par n'importe quel enseignant", async () => {
      const event = makeEvent({
        token: adminToken,
        query: { enseignant_id: teacherAProfile.id },
      });
      const res = await listCoursHandler(event);
      expect(Array.isArray(res)).toBe(true);
    });
  });

  describe("3. Emploi du temps (/api/emploi-du-temps)", () => {
    it("Un enseignant peut consulter son propre emploi du temps sans erreur", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherAProfile.id },
      });
      const res = await listEmploiHandler(event);
      expect(Array.isArray(res)).toBe(true);
    });

    it("Un enseignant NE PEUT PAS consulter l'emploi du temps d'un autre enseignant (403)", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherBProfile.id },
      });
      await expect(listEmploiHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas consulter l'emploi du temps d'un autre enseignant"),
      });
    });
  });
});
