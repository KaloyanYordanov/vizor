import { readAsset } from "./storage.server";
export async function imageResponse(key: string, download = false) {
  return new Response(new Uint8Array(await readAsset(key)), {
    headers: {
      "Content-Type": key.endsWith("webp") ? "image/webp" : "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(download
        ? {
            "Content-Disposition":
              'attachment; filename="interior-visualisation.png"',
          }
        : {}),
    },
  });
}
