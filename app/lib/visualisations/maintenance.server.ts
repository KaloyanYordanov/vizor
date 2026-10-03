import { readdir, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../db.server";
import { putAsset, readAsset } from "./storage.server";
import type { JobInput } from "./service.server";
export async function heartbeat() {
  await putAsset(
    Buffer.from(JSON.stringify({ at: Date.now() })),
    "json",
    "worker.json",
  );
}
export async function workerOnline() {
  try {
    const data = JSON.parse((await readAsset("worker.json")).toString());
    return Number.isFinite(data.at) && Date.now() - data.at < 90_000;
  } catch {
    return false;
  }
}
// Retain all referenced history. Only remove unreferenced files older than a grace period.
export async function cleanupOrphanAssets(dryRun = true) {
  const keys = new Set<string>(["worker.json"]);
  const [plans, jobs] = await Promise.all([
    prisma.visualisationPlan.findMany({ select: { imageKey: true } }),
    prisma.visualisationJob.findMany({
      select: { input: true, outputKey: true, thumbnailKey: true },
    }),
  ]);
  plans.forEach((p) => keys.add(p.imageKey));
  jobs.forEach((j) => {
    keys.add((j.input as JobInput).imageKey);
    if (j.outputKey) keys.add(j.outputKey);
    if (j.thumbnailKey) keys.add(j.thumbnailKey);
  });
  const root = resolve(
    process.env.VISUALISATION_STORAGE_DIR || ".data/visualisations",
  );
  const removed: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (
      !entry.isFile() ||
      keys.has(entry.name) ||
      !/^[a-zA-Z0-9-]+\.(png|webp)$/.test(entry.name)
    )
      continue;
    const path = resolve(root, entry.name);
    if (Date.now() - (await stat(path)).mtimeMs < 24 * 60 * 60 * 1000) continue;
    removed.push(entry.name);
    if (!dryRun) await unlink(path);
  }
  return removed;
}
