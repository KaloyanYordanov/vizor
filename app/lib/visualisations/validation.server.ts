import { createHash } from "node:crypto";
import type { Region } from "./shared";
export class VisualisationError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function validateRegion(value: unknown): Region {
  const r = value as Region;
  if (
    !r ||
    ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
    r.x < 0 ||
    r.y < 0 ||
    r.width < 0.02 ||
    r.height < 0.02 ||
    r.x + r.width > 1.000001 ||
    r.y + r.height > 1.000001
  )
    throw new VisualisationError("INVALID_REGION");
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("Origin") !== expected)
    throw new VisualisationError("FORBIDDEN", 403);
}
export function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.length > 40000)
    throw new VisualisationError("INVALID_INPUT");
  try {
    return JSON.parse(value);
  } catch {
    throw new VisualisationError("INVALID_INPUT");
  }
}
