import { Prisma } from "@prisma/client";
import { prisma } from "../db.server";
import {
  apartmentImage,
  apartmentInclude,
  sourceFingerprint,
  type SourceApartment,
} from "./source.server";
import { putAsset, readAsset } from "./storage.server";
import { hash, VisualisationError } from "./validation.server";
import { visualisationConfig } from "./config.server";
import {
  activeStates,
  isStyle,
  type Region,
  type PublicVisualisation,
} from "./shared";
import { briefs, apartmentPrompt } from "./prompts.server";
export const jsonValue = (v: unknown) => v as Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;
export const lockApartment = (tx: Tx, id: string) =>
  tx.$queryRaw`SELECT id FROM apartments WHERE id = ${id} FOR UPDATE`;
export async function currentPlan(
  tx: Tx,
  apartmentId: string,
  revision?: number,
) {
  const [a, p] = await Promise.all([
    tx.apartment.findUnique({
      where: { id: apartmentId },
      include: apartmentInclude,
    }),
    tx.visualisationPlan.findUnique({
      where: { apartmentId },
    }),
  ]);
  if (
    !a ||
    !p ||
    p.fingerprint !== sourceFingerprint(a) ||
    (revision !== undefined && p.revision !== revision)
  )
    throw new VisualisationError("STALE_PLAN", 409);
  return { a, p };
}
export async function preparePlan(apartment: SourceApartment, crop?: Region) {
  const fingerprint = sourceFingerprint(apartment);
  const image = await apartmentImage(apartment, crop);
  const imageKey = await putAsset(image.bytes);
  return prisma.$transaction(async (tx) => {
    await lockApartment(tx, apartment.id);
    const fresh = await tx.apartment.findUniqueOrThrow({
      where: { id: apartment.id },
      include: apartmentInclude,
    });
    if (sourceFingerprint(fresh) !== fingerprint)
      throw new VisualisationError("STALE_PLAN", 409);
    await tx.apartmentVisualisationPublication.deleteMany({
      where: { apartmentId: apartment.id },
    });
    return tx.visualisationPlan.upsert({
      where: { apartmentId: apartment.id },
      create: {
        apartmentId: apartment.id,
        fingerprint,
        imageKey,
        width: image.width,
        height: image.height,
      },
      update: {
        fingerprint,
        imageKey,
        width: image.width,
        height: image.height,
        revision: { increment: 1 },
      },
    });
  });
}
export type JobInput = {
  scope?: "apartment";
  planRevision: number;
  fingerprint: string;
  imageKey: string;
  label?: string;
  prompt?: string;
};
export type BatchSettings = {
  model: string;
  size: string;
  quality: string;
  brief: string;
  version: number;
};
export async function enqueue(
  apartmentId: string,
  actorId: string,
  request: {
    clientRequestId: string;
    planRevision: number;
    styleId: string;
    retryOfId?: string;
  },
) {
  const cfg = visualisationConfig();
  const kind = "IMAGE";
  if (!cfg.enabled || !cfg.configured)
    throw new VisualisationError("NOT_CONFIGURED", 503);
  if (
    !/^[\w-]{16,100}$/.test(request.clientRequestId) ||
    !isStyle(request.styleId)
  )
    throw new VisualisationError("INVALID_INPUT");
  const styleId = request.styleId;
  const requestHash = hash(request);
  return prisma.$transaction(async (tx) => {
    const a = await tx.apartment.findUniqueOrThrow({
      where: { id: apartmentId },
      include: apartmentInclude,
    });
    // Always company then apartment: reservations across apartments serialize in a fixed order.
    const companyId = a.floor.building.project.companyId;
    await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
    await lockApartment(tx, apartmentId);
    const replay = await tx.visualisationBatch.findUnique({
      where: {
        apartmentId_clientRequestId: {
          apartmentId,
          clientRequestId: request.clientRequestId,
        },
      },
    });
    if (replay) {
      if (replay.requestHash !== requestHash)
        throw new VisualisationError("REQUEST_CONFLICT", 409);
      return replay;
    }
    const { p } = await currentPlan(tx, apartmentId, request.planRevision);
    const overlap = await tx.visualisationJob.count({
      where: { state: { in: [...activeStates] }, batch: { apartmentId } },
    });
    if (overlap) throw new VisualisationError("ALREADY_RUNNING", 409);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const used = await tx.visualisationUsage.count({
      where: { companyId, kind, createdAt: { gte: since }, releasedAt: null },
    });
    if (used + 1 > cfg.dailyImages)
      throw new VisualisationError("DAILY_LIMIT", 429);
    let settings: BatchSettings = {
      model: cfg.model,
      size: cfg.size,
      quality: cfg.quality,
      brief: briefs[styleId],
      version: 2,
    };
    if (request.retryOfId) {
      const prior = await tx.visualisationBatch.findFirst({
        where: { id: request.retryOfId, apartmentId },
        include: { jobs: true },
      });
      if (
        !prior ||
        prior.styleId !== request.styleId ||
        !prior.jobs.some(
          (j) =>
            j.kind === "IMAGE" &&
            ["FAILED", "SUCCEEDED"].includes(j.state) &&
            (j.input as JobInput).scope === "apartment" &&
            (j.input as JobInput).planRevision === p.revision,
        )
      )
        throw new VisualisationError("STALE_PLAN", 409);
      settings = prior.settings as unknown as BatchSettings;
    }
    const batch = await tx.visualisationBatch.create({
      data: {
        apartmentId,
        companyId,
        createdById: actorId,
        clientRequestId: request.clientRequestId,
        requestHash,
        styleId: request.styleId,
        settings: jsonValue(settings),
        retryOfId: request.retryOfId,
      },
    });
    const input: JobInput = {
      scope: "apartment",
      planRevision: p.revision,
      fingerprint: p.fingerprint,
      imageKey: p.imageKey,
      prompt: apartmentPrompt(settings.brief),
    };
    const job = await tx.visualisationJob.create({
      data: { batchId: batch.id, kind, input: jsonValue(input) },
    });
    await tx.visualisationUsage.create({
      data: { jobId: job.id, companyId, kind },
    });
    return batch;
  });
}
export async function publish(
  apartmentId: string,
  actorId: string,
  jobId: string,
  reviewed: boolean,
  remove = false,
) {
  return prisma.$transaction(async (tx) => {
    await lockApartment(tx, apartmentId);
    const job = await tx.visualisationJob.findFirst({
      where: { id: jobId, batch: { apartmentId }, kind: "IMAGE" },
    });
    if (!job) throw new VisualisationError("NOT_FOUND", 404);
    if (remove) {
      await tx.apartmentVisualisationPublication.deleteMany({
        where: { apartmentId, jobId },
      });
    } else {
      const { p } = await currentPlan(tx, apartmentId);
      const input = job.input as JobInput;
      if (
        !reviewed ||
        job.state !== "SUCCEEDED" ||
        !job.outputKey ||
        input.scope !== "apartment" ||
        input.planRevision !== p.revision ||
        input.fingerprint !== p.fingerprint
      )
        throw new VisualisationError("REVIEW_REQUIRED", 409);
      await readAsset(job.outputKey);
      await tx.apartmentVisualisationPublication.upsert({
        where: { apartmentId },
        create: { apartmentId, jobId, publishedById: actorId },
        update: { jobId, publishedById: actorId, publishedAt: new Date() },
      });
    }
    await tx.visualisationAudit.create({
      data: {
        actorId,
        apartmentId,
        jobId,
        action: remove ? "UNPUBLISH" : "PUBLISH",
      },
    });
  });
}
export async function publicVisualisations(
  apartmentId: string,
): Promise<PublicVisualisation[]> {
  if (process.env.VISUALISATIONS_PUBLIC_ENABLED === "false") return [];
  const a = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    include: apartmentInclude,
  });
  if (!a) return [];
  const [p, publication] = await Promise.all([
    prisma.visualisationPlan.findUnique({ where: { apartmentId } }),
    prisma.apartmentVisualisationPublication.findUnique({
      where: { apartmentId },
      include: { job: { include: { batch: true } } },
    }),
  ]);
  const j = publication?.job;
  if (
    !p ||
    p.fingerprint !== sourceFingerprint(a) ||
    !j ||
    j.state !== "SUCCEEDED" ||
    !j.outputKey
  )
    return [];
  const input = j.input as JobInput;
  if (input.planRevision !== p.revision || input.fingerprint !== p.fingerprint)
    return [];
  return [
    {
      id: j.id,
      label: input.label || a.number,
      styleId: j.batch.styleId,
      imageUrl: `/api/apartments/${apartmentId}/visualisation?v=${j.id}`,
      thumbnailUrl: `/api/apartments/${apartmentId}/visualisation?v=${j.id}&thumbnail=1`,
    },
  ];
}
