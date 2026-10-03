import { visualisationConfig } from "./config.server";
import type { BatchSettings } from "./service.server";
export class ProviderError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function api(path: string, body: FormData | object, signal: AbortSignal) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ProviderError("NOT_CONFIGURED");
  // No implicit retry: a transport failure may already have incurred provider usage.
  let res: Response;
  try {
    res = await fetch(`https://api.openai.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body: body instanceof FormData ? body : JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ProviderError("PROVIDER_OUTCOME_UNKNOWN");
  }
  const requestId = res.headers.get("x-request-id");
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ProviderError("PROVIDER_OUTCOME_UNKNOWN");
  }
  if (!res.ok)
    throw new ProviderError(
      res.status === 429
        ? "PROVIDER_LIMIT"
        : res.status === 401 || res.status === 403
          ? "PROVIDER_AUTH"
          : res.status >= 500
            ? "PROVIDER_OUTCOME_UNKNOWN"
            : "PROVIDER_REJECTED",
    );
  return { data, requestId };
}
export async function generateImage(
  references: Buffer[],
  prompt: string,
  settings: BatchSettings,
): Promise<{ bytes: Buffer; usage: unknown; requestId: string | null }> {
  const form = new FormData();
  form.set("model", settings.model);
  form.set("prompt", prompt);
  form.set("size", settings.size);
  form.set("quality", settings.quality);
  form.set("n", "1");
  form.set("output_format", "png");
  references.forEach((b, i) =>
    form.append(
      "image[]",
      new Blob([new Uint8Array(b)], { type: "image/png" }),
      `reference-${i}.png`,
    ),
  );
  const { data, requestId } = await api(
    "images/edits",
    form,
    AbortSignal.timeout(visualisationConfig().timeoutMs),
  );
  if (!data.data?.[0]?.b64_json || data.data[0].b64_json.length > 45_000_000)
    throw new ProviderError("INVALID_OUTPUT");
  return {
    bytes: Buffer.from(data.data[0].b64_json, "base64"),
    usage: data.usage || null,
    requestId,
  };
}
