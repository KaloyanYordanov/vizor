import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { mergeEmbedConfig, encodeEmbedConfig, type EmbedConfig } from "~/utils/embed-config";

/**
 * Embeddable script endpoint.
 *
 * Legacy mode (backwards-compatible):
 *   <script src="/embed/horizon/sunrise-residences?target=vizor-container"></script>
 *
 * New SDK mode (recommended):
 *   <script src="/embed/horizon/sunrise-residences/sdk.js"></script>
 *   Vizor.init({ target: "my-container", company: "horizon", project: "sunrise-residences" })
 *
 * Also serves the embed config as JSON when ?format=json is passed (used by admin UI).
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { companySlug, projectSlug } = params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  const project = await prisma.project.findFirst({
    where: { slug: projectSlug, company: { slug: companySlug } },
    select: { id: true, embedConfig: true },
  });

  if (!project) {
    if (format === "json") {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
    return new Response("// Vizor: Project not found", {
      headers: { "Content-Type": "application/javascript" },
      status: 404,
    });
  }

  const storedConfig = mergeEmbedConfig(project.embedConfig as Partial<EmbedConfig> | null);

  // JSON format — return the resolved config
  if (format === "json") {
    return Response.json(storedConfig, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Legacy script mode — backwards compatible
  const targetId = url.searchParams.get("target") || "vizor-embed";
  const width = url.searchParams.get("width") || storedConfig.layout.width;
  const height = url.searchParams.get("height") || storedConfig.layout.height;

  const origin = url.origin;
  const encodedConfig = encodeEmbedConfig(storedConfig);
  const viewerUrl = `${origin}/view/${companySlug}/${projectSlug}?embed=1&ec=${encodedConfig}`;

  // Sanitize values to prevent script injection
  const safeTargetId = targetId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeWidth = width.replace(/[^a-zA-Z0-9%.]/g, "");
  const safeHeight = height.replace(/[^a-zA-Z0-9%.]/g, "");
  const borderRadius = storedConfig.layout.borderRadius.replace(/[^a-zA-Z0-9%.]/g, "");
  const boxShadow = storedConfig.layout.boxShadow;

  const script = `
(function() {
  var container = document.getElementById("${safeTargetId}");
  if (!container) {
    console.error("Vizor: Container element #${safeTargetId} not found");
    return;
  }
  var iframe = document.createElement("iframe");
  iframe.src = ${JSON.stringify(viewerUrl)};
  iframe.style.width = "${safeWidth}";
  iframe.style.height = "${safeHeight}";
  iframe.style.maxWidth = "none";
  iframe.style.border = "none";
  iframe.style.borderRadius = "${borderRadius}";
  iframe.style.boxShadow = ${JSON.stringify(boxShadow)};
  iframe.style.display = "block";
  iframe.style.margin = "0 auto";
  iframe.style.colorScheme = "light";
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("allow", "clipboard-write");
  iframe.title = "Vizor Property Viewer";
  container.appendChild(iframe);
})();
`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
