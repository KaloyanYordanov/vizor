import { describe, it, expect, vi, afterEach } from "vitest";
import { visualisationConfig } from "../lib/visualisations/config.server";
import {
  validateRegion,
  checkOrigin,
} from "../lib/visualisations/validation.server";
import {
  normalizeImage,
  cropImage,
} from "../lib/visualisations/storage.server";
import { generateImage } from "../lib/visualisations/provider.server";
import { hasApartmentPolygon } from "../lib/visualisations/source.server";
import { styles } from "../lib/visualisations/shared";
import sharp from "sharp";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("visualisation input and provider contracts", () => {
  it("uses small medium defaults and rejects invalid configuration", () => {
    expect(visualisationConfig({})).toMatchObject({
      size: "1024x1024",
      quality: "medium",
      concurrency: 2,
    });
    expect(
      visualisationConfig({
        VISUALISATION_IMAGE_SIZE: "1536x1024",
        VISUALISATION_IMAGE_QUALITY: "low",
      }),
    ).toMatchObject({ size: "1536x1024", quality: "low" });
    expect(() =>
      visualisationConfig({ VISUALISATION_IMAGE_SIZE: "256x256" }),
    ).toThrow();
    expect(() =>
      visualisationConfig({ VISUALISATION_IMAGE_QUALITY: "auto" }),
    ).toThrow();
    expect(styles).toHaveLength(6);
  });
  it("rejects out-of-bounds apartment crops", () => {
    expect(() =>
      validateRegion({ x: 0.9, y: 0, width: 0.3, height: 0.2 }),
    ).toThrow();
    expect(() =>
      validateRegion({ x: NaN, y: 0, width: 0.3, height: 0.2 }),
    ).toThrow();
  });
  it("recognizes only usable saved apartment polygons", () => {
    expect(
      hasApartmentPolygon([
        { x: 0.1, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.8, y: 0.8 },
      ]),
    ).toBe(true);
    expect(hasApartmentPolygon([{ x: 0.1, y: 0.1 }])).toBe(false);
    expect(
      hasApartmentPolygon([
        { x: -0.1, y: 0.1 },
        { x: 0.8, y: 0.1 },
        { x: 0.8, y: 0.8 },
      ]),
    ).toBe(false);
  });
  it("requires same origin for mutations", () => {
    expect(() =>
      checkOrigin(
        new Request("https://vizor.example/action", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      checkOrigin(
        new Request("https://vizor.example/action", {
          method: "POST",
          headers: { Origin: "https://vizor.example" },
        }),
      ),
    ).not.toThrow();
  });
  it("normalizes image input and retains crop/reference boundaries", async () => {
    const source = await sharp({
      create: { width: 200, height: 100, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const normalized = await normalizeImage(source);
    expect(normalized).toMatchObject({ width: 200, height: 100 });
    const crop = await cropImage(normalized.bytes, {
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.5,
    });
    expect((await sharp(crop).metadata()).width).toBeLessThan(200);
    await expect(
      normalizeImage(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd"/></svg>',
        ),
      ),
    ).rejects.toThrow("UNSAFE_SVG");
    await expect(normalizeImage(Buffer.from("not an image"))).rejects.toThrow(
      "INVALID_IMAGE",
    );
  });
  it("sends one image request with snapshotted size/quality and one full-plan reference", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("image").toString("base64") }],
          usage: { total_tokens: 2 },
        }),
        { headers: { "x-request-id": "req-test" } },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = await generateImage([Buffer.from("a")], "apartment", {
      model: "test-image-model",
      size: "1024x1024",
      quality: "medium",
      brief: "test",
      version: 1,
    });
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(form.get("quality")).toBe("medium");
    expect(form.get("size")).toBe("1024x1024");
    expect(form.get("n")).toBe("1");
    expect(form.getAll("image[]")).toHaveLength(1);
    expect(result.requestId).toBe("req-test");
  });
  it("does not retry ambiguous provider submissions", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    const f = vi.fn().mockRejectedValue(new Error("connection lost"));
    vi.stubGlobal("fetch", f);
    await expect(
      generateImage([Buffer.from("a")], "apartment", {
        model: "test",
        size: "1024x1024",
        quality: "medium",
        brief: "test",
        version: 1,
      }),
    ).rejects.toThrow("PROVIDER_OUTCOME_UNKNOWN");
    expect(f).toHaveBeenCalledTimes(1);
  });
});
