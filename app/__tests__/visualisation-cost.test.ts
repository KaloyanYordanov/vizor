import { describe, it, expect } from "vitest";
import { imageCost, batchImageCost } from "../lib/visualisations/cost.server";
const model = "gpt-image-2.5-sunburst";
const result = {
  usage: {
    input_tokens: 687,
    output_tokens: 439,
    input_tokens_details: { text_tokens: 250, image_tokens: 437 },
  },
};
describe("image cost estimates", () => {
  it("prices recorded text, reference images and output separately", () => {
    expect(imageCost(model, result)?.usd).toBeCloseTo(0.017916, 8);
  });
  it("does not turn missing usage or unsupported pricing into free images", () => {
    expect(imageCost(model, null)).toBeNull();
    expect(imageCost("unknown-model", result)).toBeNull();
    expect(
      imageCost(model, { usage: { ...result.usage, input_tokens: 2 } }),
    ).toBeNull();
    expect(
      imageCost(model, { usage: { ...result.usage, output_tokens: -1 } }),
    ).toBeNull();
    expect(
      imageCost(model, {
        usage: {
          ...result.usage,
          input_tokens_details: {
            ...result.usage.input_tokens_details,
            cached_tokens: 10,
          },
        },
      }),
    ).toBeNull();
  });
  it("marks partial batch totals and excludes analysis calls", () => {
    expect(
      batchImageCost(model, [
        { kind: "IMAGE", result },
        { kind: "IMAGE", result: null },
        { kind: "ANALYSIS", result },
      ]),
    ).toMatchObject({ known: 1, unknown: 1 });
    expect(batchImageCost(model, [{ kind: "IMAGE", result: null }])).toEqual({
      usd: 0,
      known: 0,
      unknown: 1,
    });
  });
});
