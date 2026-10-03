import { mkdir, readFile, writeFile, realpath, stat } from "node:fs/promises";
import { resolve, sep, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { VisualisationError } from "./validation.server";
import type { Region } from "./shared";
const root = () =>
  resolve(process.env.VISUALISATION_STORAGE_DIR || ".data/visualisations");
function assetPath(key: string) {
  if (!/^[a-zA-Z0-9-]+\.(png|webp|json)$/.test(key))
    throw new VisualisationError("INVALID_ASSET");
  return resolve(root(), key);
}
export async function putAsset(
  bytes: Buffer,
  extension = "png",
  key = `${randomUUID()}.${extension}`,
) {
  const path = assetPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { mode: 0o600 });
  return key;
}
export const readAsset = (key: string) => readFile(assetPath(key));
export async function readUpload(url: string) {
  if (!/^\/uploads\/[a-zA-Z0-9-]+\.(png|jpe?g|webp|svg)$/i.test(url))
    throw new VisualisationError("REUPLOAD_REQUIRED");
  const base = await realpath(resolve("public/uploads"));
  const path = await realpath(resolve("public", url.slice(1))).catch(() => {
    throw new VisualisationError("SOURCE_MISSING");
  });
  if (!path.startsWith(base + sep))
    throw new VisualisationError("INVALID_ASSET");
  if ((await stat(path)).size > 10 * 1024 * 1024)
    throw new VisualisationError("IMAGE_TOO_LARGE");
  return readFile(path);
}
export async function normalizeImage(bytes: Buffer) {
  if (bytes.length > 10 * 1024 * 1024)
    throw new VisualisationError("IMAGE_TOO_LARGE");
  // Only allow a small, self-contained SVG vocabulary. Reject all URI-bearing constructs.
  const head = bytes.subarray(0, 1024).toString("utf8");
  if (/<svg\b/i.test(head) || /<\?xml/i.test(head)) {
    const svg = bytes.toString("utf8");
    if (
      /<!|<\?|\b(?:href|src|style|on\w+)\s*=|url\s*\(|<\s*(?:script|foreignObject|image|use|style|animate|set|iframe|feImage)\b/i.test(
        svg.replace(/<\?xml[^?]*\?>/i, ""),
      )
    )
      throw new VisualisationError("UNSAFE_SVG");
  }
  try {
    const img = sharp(bytes, {
      limitInputPixels: 25_000_000,
      failOn: "warning",
    });
    const meta = await img.metadata();
    if (
      !["png", "jpeg", "webp", "svg"].includes(meta.format || "") ||
      (meta.pages || 1) > 1
    )
      throw new Error();
    const { data, info } = await img
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  } catch {
    throw new VisualisationError("INVALID_IMAGE");
  }
}
export async function cropImage(bytes: Buffer, region: Region) {
  const meta = await sharp(bytes).metadata();
  const w = meta.width!,
    h = meta.height!;
  const left = Math.max(0, Math.floor(region.x * w)),
    top = Math.max(0, Math.floor(region.y * h));
  return sharp(bytes)
    .extract({
      left,
      top,
      width: Math.min(w - left, Math.max(1, Math.ceil(region.width * w))),
      height: Math.min(h - top, Math.max(1, Math.ceil(region.height * h))),
    })
    .png()
    .toBuffer();
}
