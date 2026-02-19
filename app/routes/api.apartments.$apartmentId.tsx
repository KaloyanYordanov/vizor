import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "~/lib/db.server";

/**
 * GET /api/apartments/:apartmentId
 * Public API: Returns detailed apartment data.
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const apartment = await prisma.apartment.findUnique({
    where: { id: params.apartmentId },
    include: {
      floor: {
        select: {
          number: true,
          label: true,
          building: {
            select: {
              name: true,
              slug: true,
              project: {
                select: {
                  name: true,
                  slug: true,
                  company: { select: { name: true, slug: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!apartment) {
    return json({ error: "Apartment not found" }, { status: 404 });
  }

  return json(apartment, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
  });
}
