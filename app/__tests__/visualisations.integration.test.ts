import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "../lib/db.server";
import { createUserSession } from "../lib/auth.server";
import {
  authorizeApartment,
  apartmentInclude,
} from "../lib/visualisations/source.server";
import {
  preparePlan,
  enqueue,
  publish,
  publicVisualisations,
} from "../lib/visualisations/service.server";
import { runOneJob, reconcileJobs } from "../lib/visualisations/worker.server";
import { ProviderError } from "../lib/visualisations/provider.server";
import { loader as privateAsset } from "../routes/api.visualisations.$visualisationId.asset";
import { loader as publicAsset } from "../routes/api.apartments.$apartmentId.visualisation";
import { loader as batchStatus } from "../routes/api.visualisation-batches.$batchId";
const enabled = process.env.VISUALISATION_INTEGRATION === "1";
describe.runIf(enabled)("visualisation PostgreSQL workflow", () => {
  let companyId: string,
    otherCompanyId: string,
    buildingId: string,
    apartmentId: string,
    adminId: string,
    viewerId: string,
    otherId: string;
  let image: Buffer,
    source: string,
    planId: string,
    revision: number,
    cookie: string;
  let successJob: string, failedJob: string, batchId: string;
  const fake = {
    generateImage: vi.fn(async () => ({
      bytes: image,
      usage: { total_tokens: 1 },
      requestId: "test",
    })),
  };
  const request = (path: string, c = cookie) =>
    new Request(`http://localhost${path}`, { headers: { Cookie: c } });
  async function cookieFor(id: string) {
    return (await createUserSession(id, "/")).headers
      .get("Set-Cookie")!
      .split(";")[0];
  }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes("vizor_visualisations_test"))
      throw new Error(
        "Integration tests require an isolated vizor_visualisations_test database",
      );
    vi.stubEnv("OPENAI_API_KEY", "integration-test-never-sent");
    vi.stubEnv("VISUALISATION_DAILY_IMAGE_LIMIT", "10");
    image = await sharp({
      create: { width: 256, height: 256, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    source = `/uploads/${randomUUID()}.png`;
    await mkdir("public/uploads", { recursive: true });
    await writeFile(`public${source}`, image);
    const company = await prisma.company.create({
      data: { name: "Test", slug: `test-${randomUUID()}` },
    });
    companyId = company.id;
    otherCompanyId = (
      await prisma.company.create({
        data: { name: "Other", slug: `test-${randomUUID()}` },
      })
    ).id;
    const project = await prisma.project.create({
      data: { name: "Test", slug: "test", companyId },
    });
    buildingId = (
      await prisma.building.create({
        data: { name: "Test", slug: "test", projectId: project.id },
      })
    ).id;
    const floor = await prisma.floor.create({
      data: { number: 0, buildingId },
    });
    apartmentId = (
      await prisma.apartment.create({
        data: {
          floorId: floor.id,
          number: "A",
          rooms: 2,
          area: 50,
          floorPlanUrl: source,
        },
      })
    ).id;
    adminId = (
      await prisma.user.create({
        data: {
          email: `${randomUUID()}@test.invalid`,
          password: "unused",
          name: "Admin",
          role: "COMPANY_ADMIN",
          companyId,
        },
      })
    ).id;
    viewerId = (
      await prisma.user.create({
        data: {
          email: `${randomUUID()}@test.invalid`,
          password: "unused",
          name: "Viewer",
          role: "VIEWER",
          companyId,
        },
      })
    ).id;
    otherId = (
      await prisma.user.create({
        data: {
          email: `${randomUUID()}@test.invalid`,
          password: "unused",
          name: "Other",
          role: "COMPANY_ADMIN",
          companyId: otherCompanyId,
        },
      })
    ).id;
    cookie = await cookieFor(adminId);
  });
  afterAll(async () => {
    if (companyId)
      await prisma.visualisationUsage.deleteMany({ where: { companyId } });
    if (companyId) await prisma.company.delete({ where: { id: companyId } });
    if (otherCompanyId)
      await prisma.company.delete({ where: { id: otherCompanyId } });
    if (source) await rm(`public${source}`, { force: true });
    if (apartmentId)
      await prisma.visualisationAudit.deleteMany({ where: { apartmentId } });
    vi.unstubAllEnvs();
    await prisma.$disconnect();
  });
  it("isolates tenant/role and route building ownership", async () => {
    await expect(
      authorizeApartment(request("/"), apartmentId, buildingId),
    ).resolves.toBeTruthy();
    await expect(
      authorizeApartment(request("/", await cookieFor(viewerId)), apartmentId),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      authorizeApartment(request("/", await cookieFor(otherId)), apartmentId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      authorizeApartment(request("/"), apartmentId, "other-building"),
    ).rejects.toMatchObject({ status: 404 });
  });

  const args = (styleId = "scandinavian") => ({
    clientRequestId: randomUUID(),
    planRevision: revision,
    styleId,
  });
  it("prepares a whole plan without creating room records", async () => {
    const a = await prisma.apartment.findUniqueOrThrow({
      where: { id: apartmentId },
      include: apartmentInclude,
    });
    const p = await preparePlan(a);
    planId = p.id;
    revision = p.revision;
    expect(await prisma.visualisationRoom.count({ where: { planId } })).toBe(0);
  });
  it("deduplicates concurrent posts and creates exactly one image job", async () => {
    const input = args();
    const [a, b] = await Promise.all([
      enqueue(apartmentId, adminId, input),
      enqueue(apartmentId, adminId, input),
    ]);
    expect(a.id).toBe(b.id);
    batchId = a.id;
    expect(await prisma.visualisationJob.count({ where: { batchId } })).toBe(1);
    expect(await prisma.visualisationRoom.count({ where: { planId } })).toBe(0);
    await expect(enqueue(apartmentId, adminId, args())).rejects.toThrow(
      "ALREADY_RUNNING",
    );
    await expect(
      enqueue(apartmentId, adminId, { ...input, styleId: "japandi" }),
    ).rejects.toThrow("REQUEST_CONFLICT");
  });
  it("never retries ambiguous provider calls automatically", async () => {
    fake.generateImage.mockRejectedValueOnce(
      new ProviderError("PROVIDER_OUTCOME_UNKNOWN"),
    );
    await runOneJob(fake);
    expect(await runOneJob(fake)).toBe(false);
    expect(fake.generateImage).toHaveBeenCalledTimes(1);
    failedJob = (
      await prisma.visualisationJob.findFirstOrThrow({ where: { batchId } })
    ).id;
    expect(await publicVisualisations(apartmentId)).toEqual([]);
  });
  it("retries with the original settings and a single full-plan reference", async () => {
    vi.stubEnv("VISUALISATION_IMAGE_QUALITY", "high");
    const b = await enqueue(apartmentId, adminId, {
      ...args(),
      retryOfId: batchId,
    });
    expect(b.settings).toMatchObject({ quality: "medium", size: "1024x1024" });
    await runOneJob(fake);
    expect(fake.generateImage).toHaveBeenCalledTimes(2);
    const call = fake.generateImage.mock.calls[1] as unknown as [
      Buffer[],
      string,
    ];
    expect(call[0]).toHaveLength(1);
    expect(call[1]).toContain("apartment as a whole");
    const job = await prisma.visualisationJob.findFirstOrThrow({
      where: { batchId: b.id },
    });
    expect(job.roomId).toBeNull();
    expect(job.state).toBe("SUCCEEDED");
    successJob = job.id;
  });
  it("protects drafts and status, and requires review for apartment publication", async () => {
    await expect(
      privateAsset({
        request: request("/", await cookieFor(otherId)),
        params: { visualisationId: successJob },
        context: {},
      }),
    ).rejects.toMatchObject({ status: 404 });
    const response = await privateAsset({
      request: request("/"),
      params: { visualisationId: successJob },
      context: {},
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const status = await batchStatus({
      request: request("/"),
      params: { batchId },
      context: {},
    });
    expect(JSON.stringify(await status.json())).not.toContain("prompt");
    await expect(
      publish(apartmentId, adminId, successJob, false),
    ).rejects.toThrow("REVIEW_REQUIRED");
    await publish(apartmentId, adminId, successJob, true);
    const gallery = await publicVisualisations(apartmentId);
    expect(gallery).toHaveLength(1);
    expect(gallery[0].id).toBe(successJob);
    expect(JSON.stringify(gallery)).not.toMatch(/imageKey|prompt|claimToken/);
    expect(
      (
        await publicAsset({
          request: request(`/?v=${successJob}`),
          params: { apartmentId },
          context: {},
        })
      ).status,
    ).toBe(200);
    await publish(apartmentId, adminId, successJob, false, true);
    await expect(
      publicAsset({
        request: request(`/?v=${successJob}`),
        params: { apartmentId },
        context: {},
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("replaces the apartment publication without deleting history", async () => {
    await publish(apartmentId, adminId, successJob, true);
    const b = await enqueue(apartmentId, adminId, args("japandi"));
    await runOneJob(fake);
    const j = await prisma.visualisationJob.findFirstOrThrow({
      where: { batchId: b.id },
    });
    await publish(apartmentId, adminId, j.id, true);
    expect((await publicVisualisations(apartmentId)).map((x) => x.id)).toEqual([
      j.id,
    ]);
    await expect(
      publicAsset({
        request: request(`/?v=${successJob}`),
        params: { apartmentId },
        context: {},
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await prisma.visualisationJob.findUniqueOrThrow({
          where: { id: successJob },
        })
      ).state,
    ).toBe("SUCCEEDED");
  });
  it("reconciles unknown accepted calls and retains allowance after deletion", async () => {
    const b = await enqueue(apartmentId, adminId, args());
    await prisma.visualisationJob.updateMany({
      where: { batchId: b.id },
      data: {
        state: "GENERATING",
        submittedAt: new Date(),
        claimToken: randomUUID(),
        leaseUntil: new Date(0),
      },
    });
    await reconcileJobs();
    const j = await prisma.visualisationJob.findFirstOrThrow({
      where: { batchId: b.id },
    });
    expect(j).toMatchObject({
      state: "FAILED",
      errorCode: "PROVIDER_OUTCOME_UNKNOWN",
    });
    await prisma.visualisationBatch.delete({ where: { id: b.id } });
    expect(
      await prisma.visualisationUsage.findUnique({ where: { jobId: j.id } }),
    ).toMatchObject({ companyId, releasedAt: null });
    vi.stubEnv("VISUALISATION_DAILY_IMAGE_LIMIT", "1");
    await expect(enqueue(apartmentId, adminId, args())).rejects.toThrow(
      "DAILY_LIMIT",
    );
    vi.stubEnv("VISUALISATION_DAILY_IMAGE_LIMIT", "10");
  });
  it("does not submit obsolete queued room-analysis work", async () => {
    const b = await enqueue(apartmentId, adminId, args());
    await prisma.visualisationJob.updateMany({
      where: { batchId: b.id },
      data: { kind: "ANALYSIS" },
    });
    const calls = fake.generateImage.mock.calls.length;
    await runOneJob(fake);
    await reconcileJobs();
    const j = await prisma.visualisationJob.findFirstOrThrow({
      where: { batchId: b.id },
    });
    expect(j.state).toBe("SUPERSEDED");
    expect(fake.generateImage).toHaveBeenCalledTimes(calls);
    expect(
      (
        await prisma.visualisationUsage.findUniqueOrThrow({
          where: { jobId: j.id },
        })
      ).releasedAt,
    ).not.toBeNull();
  });
  it("invalidates replaced plans before serving, publishing or generation", async () => {
    await publish(apartmentId, adminId, successJob, true);
    const a = await prisma.apartment.findUniqueOrThrow({
      where: { id: apartmentId },
      include: apartmentInclude,
    });
    await preparePlan(a);
    expect(await publicVisualisations(apartmentId)).toEqual([]);
    await expect(
      publish(apartmentId, adminId, successJob, true),
    ).rejects.toThrow("REVIEW_REQUIRED");
    await expect(enqueue(apartmentId, adminId, args())).rejects.toThrow(
      "STALE_PLAN",
    );
  });
});
