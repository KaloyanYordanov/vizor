import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.server";
import { requireRole } from "../auth.server";
import { hash, VisualisationError, validateRegion } from "./validation.server";
import { normalizeImage, readUpload, cropImage } from "./storage.server";
import type { Region } from "./shared";
export const apartmentInclude = {
  floor: { include: { building: { include: { project: true } } } },
} satisfies Prisma.ApartmentInclude;
export type SourceApartment = Prisma.ApartmentGetPayload<{
  include: typeof apartmentInclude;
}>;
export async function authorizeApartment(
  request: Request,
  apartmentId: string,
  buildingId?: string,
) {
  const user = await requireRole(request, ["SUPER_ADMIN", "COMPANY_ADMIN"]);
  const apartment = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    include: apartmentInclude,
  });
  if (
    !apartment ||
    (buildingId && apartment.floor.buildingId !== buildingId) ||
    (user.role !== "SUPER_ADMIN" &&
      user.companyId !== apartment.floor.building.project.companyId)
  )
    throw new Response("Not found", { status: 404 });
  return { user, apartment };
}
export function sourceFingerprint(a: SourceApartment) {
  return hash(
    a.floorPlanUrl
      ? { apartment: a.id, source: a.floorPlanUrl, type: a.floor.type }
      : {
          apartment: a.id,
          floor: a.floorId,
          type: a.floor.type,
          image: a.floor.imageUrl,
          svg: a.floor.imageUrl ? null : a.floor.svgContent,
          polygon: a.polygonData,
        },
  );
}
export async function sourceImage(a: SourceApartment) {
  if (a.floor.type !== "APARTMENT")
    throw new VisualisationError("UNSUPPORTED_FLOOR");
  const url = a.floorPlanUrl || a.floor.imageUrl;
  const bytes = url
    ? await readUpload(url)
    : a.floor.svgContent
      ? Buffer.from(a.floor.svgContent)
      : null;
  if (!bytes) throw new VisualisationError("SOURCE_MISSING");
  return normalizeImage(bytes);
}
export function hasApartmentPolygon(value: unknown): value is { x: number; y: number }[] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every(
      (point) =>
        typeof point === "object" &&
        point !== null &&
        "x" in point &&
        "y" in point &&
        typeof point.x === "number" &&
        typeof point.y === "number" &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        point.x >= 0 &&
        point.x <= 1 &&
        point.y >= 0 &&
        point.y <= 1,
    )
  );
}
export async function apartmentImage(a: SourceApartment, manual?: Region) {
  let { bytes } = await sourceImage(a);
  if (!a.floorPlanUrl) {
    const points = a.polygonData;
    if (manual) bytes = await cropImage(bytes, validateRegion(manual));
    else if (hasApartmentPolygon(points)) {
      const meta = await sharp(bytes).metadata();
      const w = meta.width!,
        h = meta.height!;
      const poly = points.map((p) => `${p.x * w},${p.y * h}`).join(" ");
      const mask = Buffer.from(
        `<svg width="${w}" height="${h}"><polygon points="${poly}" fill="white" stroke="white" stroke-width="8"/></svg>`,
      );
      bytes = await sharp(bytes)
        .ensureAlpha()
        .composite([{ input: mask, blend: "dest-in" }])
        .png()
        .toBuffer();
      bytes = await sharp(bytes)
        .flatten({ background: "white" })
        .png()
        .toBuffer();
      const x = Math.max(0, Math.min(...points.map((p) => p.x)) - 0.01),
        y = Math.max(0, Math.min(...points.map((p) => p.y)) - 0.01);
      bytes = await cropImage(
        bytes,
        validateRegion({
          x,
          y,
          width: Math.min(1, Math.max(...points.map((p) => p.x)) + 0.01) - x,
          height: Math.min(1, Math.max(...points.map((p) => p.y)) + 0.01) - y,
        }),
      );
    } else throw new VisualisationError("MARK_APARTMENT");
  }
  return normalizeImage(bytes);
}
