import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db.server";
import { visualisationConfig } from "./config.server";
import { apartmentInclude, sourceFingerprint } from "./source.server";
import { readAsset, putAsset } from "./storage.server";
import { generateImage, ProviderError } from "./provider.server";
import { VisualisationError } from "./validation.server";
import { activeStates } from "./shared";
import { jsonValue, type JobInput, type BatchSettings } from "./service.server";
async function releaseUnusedAllowances() {
  const unused = await prisma.visualisationJob.findMany({
    where: { state: { in: ["FAILED", "SUPERSEDED"] }, submittedAt: null },
    select: { id: true },
  });
  if (unused.length)
    await prisma.visualisationUsage.updateMany({
      where: { jobId: { in: unused.map((j) => j.id) }, releasedAt: null },
      data: { releasedAt: new Date() },
    });
}
export async function reconcileJobs() {
  // Recover persisted output without making a second paid request.
  const expired = await prisma.visualisationJob.findMany({
    where: {
      state: { in: [...activeStates].filter((s) => s !== "QUEUED") },
      leaseUntil: { lt: new Date() },
    },
  });
  for (const j of expired) {
    let data: Record<string, unknown>;
    try {
      if (!j.outputKey) throw new Error();
      const bytes = await readAsset(j.outputKey);
      const m = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata();
      if (m.format !== "png" || !m.width || !m.height) throw new Error();
      const thumbnailKey = await putAsset(
        await sharp(bytes)
          .resize({ width: 480, withoutEnlargement: true })
          .webp()
          .toBuffer(),
        "webp",
      );
      data = {
        state: "SUCCEEDED",
        width: m.width,
        height: m.height,
        thumbnailKey,
        finishedAt: new Date(),
        leaseUntil: null,
      };
    } catch {
      data = {
        state: "FAILED",
        errorCode: j.submittedAt
          ? "PROVIDER_OUTCOME_UNKNOWN"
          : "WORKER_INTERRUPTED",
        finishedAt: new Date(),
        leaseUntil: null,
      };
    }
    await prisma.visualisationJob.updateMany({
      where: {
        id: j.id,
        claimToken: j.claimToken,
        state: j.state,
        leaseUntil: { lt: new Date() },
      },
      data,
    });
  }
  await releaseUnusedAllowances();
}
export async function runOneJob(provider = { generateImage }) {
  const cfg = visualisationConfig();
  if (!cfg.enabled || !cfg.configured) return false;
  const token = randomUUID();
  const lease = new Date(Date.now() + cfg.timeoutMs + 120_000);
  const ids = await prisma.$transaction(async (tx) => {
    // Global DB-backed concurrency works even if multiple worker processes are started.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(91244101)::text`;
    if (
      (await tx.visualisationJob.count({
        where: {
          state: { in: ["PREPARING", "GENERATING", "SAVING"] },
          leaseUntil: { gt: new Date() },
        },
      })) >= cfg.concurrency
    )
      return [];
    return tx.$queryRaw<
      { id: string }[]
    >`UPDATE "VisualisationJob" SET state='PREPARING', "claimToken"=${token}, "leaseUntil"=${lease}, "updatedAt"=NOW() WHERE id=(SELECT id FROM "VisualisationJob" WHERE state='QUEUED' ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`;
  });
  if (!ids.length) return false;
  const job = await prisma.visualisationJob.findUniqueOrThrow({
    where: { id: ids[0].id },
    include: { batch: true },
  });
  const input = job.input as JobInput,
    settings = job.batch.settings as unknown as BatchSettings;
  const update = async (
    data: Parameters<typeof prisma.visualisationJob.updateMany>[0]["data"],
  ) => {
    const result = await prisma.visualisationJob.updateMany({
      where: {
        id: job.id,
        claimToken: token,
        state: { in: [...activeStates] },
      },
      data,
    });
    if (!result.count) throw new VisualisationError("SUPERSEDED");
  };
  try {
    const a = await prisma.apartment.findUnique({
      where: { id: job.batch.apartmentId },
      include: apartmentInclude,
    });
    const plan = await prisma.visualisationPlan.findUnique({
      where: { apartmentId: job.batch.apartmentId },
    });
    if (
      !a ||
      !plan ||
      sourceFingerprint(a) !== input.fingerprint ||
      plan.revision !== input.planRevision ||
      job.kind !== "IMAGE" ||
      input.scope !== "apartment"
    ) {
      await update({
        state: "SUPERSEDED",
        finishedAt: new Date(),
        leaseUntil: null,
      });
      return true;
    }
    const bytes = await readAsset(input.imageKey);
    await update({ state: "GENERATING", submittedAt: new Date() });
    const result = await provider.generateImage(
      [bytes],
      input.prompt!,
      settings,
    );
    // Save original before thumbnail work. Recovery can finalize from this key.
    const outputKey = await putAsset(result.bytes, "png");
    await update({
      state: "SAVING",
      outputKey,
      result: jsonValue({ usage: result.usage }),
      providerRequestId: result.requestId,
    });
    const img = sharp(result.bytes, { limitInputPixels: 25_000_000 });
    const meta = await img.metadata();
    if (meta.format !== "png" || !meta.width || !meta.height)
      throw new VisualisationError("INVALID_OUTPUT");
    const thumbnailKey = await putAsset(
      await img
        .resize({ width: 480, withoutEnlargement: true })
        .webp()
        .toBuffer(),
      "webp",
    );
    await update({
      state: "SUCCEEDED",
      thumbnailKey,
      width: meta.width,
      height: meta.height,
      finishedAt: new Date(),
      leaseUntil: null,
    });
  } catch (e) {
    const code =
      e instanceof ProviderError || e instanceof VisualisationError
        ? e.code
        : "GENERATION_FAILED";
    await prisma.visualisationJob.updateMany({
      where: {
        id: job.id,
        claimToken: token,
        state: { in: [...activeStates] },
      },
      data: {
        state: "FAILED",
        errorCode: code,
        finishedAt: new Date(),
        leaseUntil: null,
      },
    });
    console.error(
      JSON.stringify({ event: "visualisation.failed", jobId: job.id, code }),
    );
  }
  await releaseUnusedAllowances();
  return true;
}
