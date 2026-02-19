import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";

/**
 * Embeddable script endpoint.
 * Usage: <script src="/embed/horizon/sunrise-residences?target=vizor-container"></script>
 * Creates an iframe pointing to the public viewer.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { companySlug, projectSlug } = params;
  const url = new URL(request.url);
  const targetId = url.searchParams.get("target") || "vizor-embed";
  const width = url.searchParams.get("width") || "100%";
  const height = url.searchParams.get("height") || "800px";

  // Verify project exists
  const project = await prisma.project.findFirst({
    where: { slug: projectSlug, company: { slug: companySlug } },
    select: { id: true },
  });

  if (!project) {
    return new Response("// Vizor: Project not found", {
      headers: { "Content-Type": "application/javascript" },
      status: 404,
    });
  }

  const origin = url.origin;
  const viewerUrl = `${origin}/view/${companySlug}/${projectSlug}`;

  const script = `
(function() {
  var container = document.getElementById("${targetId}");
  if (!container) {
    console.error("Vizor: Container element #${targetId} not found");
    return;
  }
  var iframe = document.createElement("iframe");
  iframe.src = "${viewerUrl}";
  iframe.style.width = "${width}";
  iframe.style.height = "${height}";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("loading", "lazy");
  iframe.title = "Vizor Apartment Selector";
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
