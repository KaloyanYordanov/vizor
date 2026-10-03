import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { authorizeApartment } from "~/lib/visualisations/source.server";
import { imageResponse } from "~/lib/visualisations/http.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const plan = await prisma.visualisationPlan.findUnique({
    where: { id: params.planId },
  });
  if (!plan) throw new Response("Not found", { status: 404 });
  await authorizeApartment(request, plan.apartmentId);
  return imageResponse(plan.imageKey);
}
