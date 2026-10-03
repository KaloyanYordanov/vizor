// Standard USD rates verified 2026-09-24:
// https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency
// Versioned rates are intentionally fixed so historical estimates stay stable.
const models = new Set([
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-sunburst-2026-09-08",
  "gpt-image-2.5-flare",
]);
const record = (v: unknown): Record<string, any> =>
  v && typeof v === "object" && !Array.isArray(v) ? v : {};
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export function imageCost(model: string, result: unknown) {
  if (!models.has(model)) return null;
  const u = record(record(result).usage),
    d = record(u.input_tokens_details);
  const text = d.text_tokens,
    image = d.image_tokens,
    output = u.output_tokens;
  if (
    ![text, image, output, u.input_tokens].every(count) ||
    text + image !== u.input_tokens
  )
    return null;
  // A missing cache breakdown cannot be priced reliably; never present it as zero.
  if ((d.cached_tokens ?? 0) !== 0 || (u.cached_tokens ?? 0) !== 0) return null;
  const textUsd = (text * 5) / 1e6,
    imageUsd = (image * 8) / 1e6,
    outputUsd = (output * 30) / 1e6;
  return {
    usd: textUsd + imageUsd + outputUsd,
    textUsd,
    imageUsd,
    outputUsd,
    textTokens: text,
    imageTokens: image,
    outputTokens: output,
    rateDate: "2026-09-24",
  };
}
export function batchImageCost(
  model: string,
  jobs: { kind: string; result: unknown }[],
) {
  const costs = jobs
    .filter((j) => j.kind === "IMAGE")
    .map((j) => imageCost(model, j.result));
  return {
    usd: costs.reduce((sum, c) => sum + (c?.usd ?? 0), 0),
    known: costs.filter(Boolean).length,
    unknown: costs.filter((c) => c === null).length,
  };
}
