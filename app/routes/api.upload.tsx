import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireRole } from "~/lib/auth.server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, ["SUPER_ADMIN", "COMPANY_ADMIN"]);
  const origin = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("Origin") !== origin) return json({error:"Forbidden"},{status:403});

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File)) {
    return json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type)) {
    return json({ error: "Invalid file type. Allowed: PNG, JPEG, WebP, SVG" }, { status: 400 });
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return json({ error: "File too large. Max 10MB" }, { status: 400 });
  }

  const ext = ({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/svg+xml":"svg"} as Record<string,string>)[file.type];
  const filename = `${randomUUID()}.${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadDir, filename), buffer);

  return json({ url: `/uploads/${filename}` });
}
