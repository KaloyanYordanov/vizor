# Style samples

Generated with the built-in image generation tool on 2026-09-24. Final optimized assets: `public/images/visualisation-styles/{style}.webp` (768 pixels wide). All six were visually reviewed.

Shared generation prompt:

> Create one photorealistic high-end editorial interior photograph for an apartment design style selection card. Style: [style wording below]. A coherent open-plan apartment living dining kitchen interior, realistic furniture scale, bright natural cinematic daylight highlighting tactile materials, eye-level wide composition, beautiful believable lived-in architectural photography. No text, no collage, no floor plan. Landscape image. This is a style sample, not a particular client's apartment.

| Asset | Style wording |
| --- | --- |
| contemporary.webp | clean architectural lines, warm oak, taupe sculptural sofa, charcoal accents |
| scandinavian.webp | pale ash wood, white walls, soft linen, muted sage, airy Nordic simplicity |
| japandi.webp | warm plaster, low oak furniture, earthy linen, restrained Japanese Scandinavian design |
| industrial.webp | concrete, black steel, walnut, cognac leather, refined industrial design |
| modern-classic.webp | ivory panelled walls, elegant curved upholstery, muted blue green, restrained brass, modern classical proportions |
| modern-luxury.webp | cream travertine, rich walnut, sculptural cream sofa, brushed brass, understated luxurious design |

The apartment-generation prompt itself is maintained in `app/lib/visualisations/prompts.server.ts`, using a different material brief for each selected style and the complete apartment plan as the only image input.
