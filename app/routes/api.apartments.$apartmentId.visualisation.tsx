import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { publicVisualisations } from "~/lib/visualisations/service.server";
import { imageResponse } from "~/lib/visualisations/http.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const apartmentId = params.apartmentId!;
  const q = new URL(request.url).searchParams;
  const current = (await publicVisualisations(apartmentId))[0];
  if (!current || q.get("v") !== current.id)
    throw new Response("Not found", { status: 404 });
  const job = await prisma.visualisationJob.findUnique({
    where: { id: current.id },
  });
  const key = q.has("thumbnail") ? job?.thumbnailKey : job?.outputKey;
  if (!key) throw new Response("Not found", { status: 404 });
  return imageResponse(key);
}
