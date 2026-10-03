export function visualisationConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const size = env.VISUALISATION_IMAGE_SIZE || "1024x1024";
  const quality = env.VISUALISATION_IMAGE_QUALITY || "medium";
  if (!["1024x1024", "1536x1024", "1024x1536"].includes(size))
    throw new Error("Invalid VISUALISATION_IMAGE_SIZE");
  if (!["low", "medium", "high"].includes(quality))
    throw new Error("Invalid VISUALISATION_IMAGE_QUALITY");
  const positive = (name: string, fallback: number, max: number) => {
    const value = Number(env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > max)
      throw new Error(`Invalid ${name}`);
    return value;
  };
  return {
    enabled: env.VISUALISATIONS_ENABLED !== "false",
    configured: Boolean(env.OPENAI_API_KEY),
    model: env.VISUALISATION_IMAGE_MODEL || "gpt-image-2.5-sunburst",
    size,
    quality,
    dailyImages: positive("VISUALISATION_DAILY_IMAGE_LIMIT", 20, 10000),
    concurrency: positive("VISUALISATION_CONCURRENCY", 2, 8),
    timeoutMs: positive("VISUALISATION_TIMEOUT_SECONDS", 240, 900) * 1000,
  };
}
