import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { prisma } from "../app/lib/db.server";
import { runOneJob } from "../app/lib/visualisations/worker.server";
import { ProviderError } from "../app/lib/visualisations/provider.server";
let companyId: string,
  buildingId: string,
  floorId: string,
  apartmentId: string,
  source: string,
  image: Buffer;
const email = `${randomUUID()}@e2e.invalid`,
  slug = `e2e-${randomUUID()}`;
test.beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("vizor_visualisations_test"))
    throw new Error(
      "Use an isolated vizor_visualisations_test database for E2E",
    );
  const company = await prisma.company.create({
    data: { name: "E2E company", slug },
  });
  companyId = company.id;
  const project = await prisma.project.create({
    data: { companyId, name: "E2E project", slug: "test" },
  });
  buildingId = (
    await prisma.building.create({
      data: { projectId: project.id, name: "E2E building", slug: "building" },
    })
  ).id;
  floorId = (await prisma.floor.create({ data: { buildingId, number: 0 } })).id;
  // Architectural fixture, not an AI-generated result or quality pilot.
  image = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/><path d="M20 20H580V380H20ZM300 20V380M20 250H300" fill="none" stroke="black" stroke-width="8"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  source = `/uploads/${randomUUID()}.png`;
  await mkdir("public/uploads", { recursive: true });
  await writeFile(`public${source}`, image);
  apartmentId = (
    await prisma.apartment.create({
      data: {
        floorId,
        number: "A-101",
        area: 60,
        rooms: 2,
        floorPlanUrl: source,
      },
    })
  ).id;
  await prisma.user.create({
    data: {
      companyId,
      email,
      password: await bcrypt.hash("e2e-password", 4),
      name: "Test admin",
      role: "COMPANY_ADMIN",
    },
  });
});
test.afterAll(async () => {
  if (companyId)
    await prisma.visualisationUsage.deleteMany({ where: { companyId } });
  if (companyId) await prisma.company.delete({ where: { id: companyId } });
  if (apartmentId)
    await prisma.visualisationAudit.deleteMany({ where: { apartmentId } });
  if (source) await rm(`public${source}`, { force: true });
  await prisma.$disconnect();
});
test("generate whole apartment, retry failure, publish and view gallery", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "en"));
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("e2e-password");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/admin");
  await page.goto(
    `/admin/buildings/${buildingId}/visualisations?floor=${floorId}&apartment=${apartmentId}`,
  );
  await expect(
    page.getByRole("heading", { name: "Interior visualisations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Apartment interior", exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await expect(
    page.getByRole("button", { name: "Suggest rooms with AI" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add room", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "Scandinavian", exact: true }).check();
  await page
    .getByRole("button", { name: "Generate apartment image", exact: true })
    .click();
  await expect(page.getByText("Queued", { exact: true })).toHaveCount(1);
  let calls = 0;
  const fake = {
    generateImage: async (references: Buffer[], prompt: string) => {
      calls++;
      expect(references).toHaveLength(1);
      expect(prompt).toContain("apartment as a whole");
      expect(prompt).toContain("pale oak");
      if (calls === 1) throw new ProviderError("PROVIDER_OUTCOME_UNKNOWN");
      return { bytes: image, usage: {}, requestId: "e2e" };
    },
  };
  await runOneJob(fake);
  await expect(page.getByText("Failed", { exact: true })).toBeVisible({
    timeout: 12000,
  });
  await page
    .getByRole("button", { name: "Retry generation", exact: true })
    .click();
  await expect(page.getByText("Queued", { exact: true })).toHaveCount(1);
  await runOneJob(fake);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 12000,
  });
  expect(calls).toBe(2);
  expect(
    await prisma.visualisationJob.count({
      where: { batch: { apartmentId }, kind: "ANALYSIS" },
    }),
  ).toBe(0);
  await page
    .getByRole("checkbox", {
      name: "I reviewed this apartment visualisation against the plan.",
    })
    .check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toBeVisible();
  await page.goto(`/view/${slug}/test/apartment/${apartmentId}`);
  await expect(
    page.getByRole("heading", { name: "Interior visualisations" }),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "AI-generated design visualisations. Refer to the 2D plan for the layout.",
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByText("No images available", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/admin/buildings/${buildingId}/visualisations?floor=${floorId}&apartment=${apartmentId}`,
  );
  await expect(
    page.getByRole("heading", { name: "Interior visualisations" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/vizor-visualisations-mobile.png",
    fullPage: true,
  });
});
