import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/lib/db.server";

/**
 * GET /api/projects/:companySlug/:projectSlug
 * Public API: Returns project data with buildings, floors, and apartments.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { companySlug, projectSlug } = params;
  const url = new URL(request.url);

  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      company: { slug: companySlug },
    },
    include: {
      company: { select: { name: true, slug: true } },
      buildings: {
        include: {
          floors: {
            include: {
              apartments: {
                select: {
                  id: true,
                  number: true,
                  rooms: true,
                  area: true,
                  price: true,
                  pricePerSqm: true,
                  status: true,
                  svgPathId: true,
                  description: true,
                  features: true,
                },
                orderBy: { number: "asc" },
              },
            },
            orderBy: { number: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!project) {
    return json({ error: "Project not found" }, { status: 404 });
  }

  // Apply query filters
  const status = url.searchParams.get("status");
  const rooms = url.searchParams.get("rooms");
  const minPrice = url.searchParams.get("minPrice");
  const maxPrice = url.searchParams.get("maxPrice");

  const filtered = {
    ...project,
    buildings: project.buildings.map((building) => ({
      ...building,
      floors: building.floors.map((floor) => ({
        ...floor,
        apartments: floor.apartments.filter((apt) => {
          if (status && apt.status !== status) return false;
          if (rooms && apt.rooms !== parseFloat(rooms)) return false;
          if (minPrice && (apt.price === null || apt.price < parseFloat(minPrice))) return false;
          if (maxPrice && (apt.price === null || apt.price > parseFloat(maxPrice))) return false;
          return true;
        }),
      })),
    })),
  };

  return json(filtered, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
  });
}
