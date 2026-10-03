// Compatibility for saved legacy public URLs; current apartment publication is always rechecked.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { publicVisualisations } from "~/lib/visualisations/service.server";
import { imageResponse } from "~/lib/visualisations/http.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const room = await prisma.visualisationRoom.findUnique({
    where: { id: params.roomId },
    include: { plan: true, publication: { include: { job: true } } },
  });
  if (!room?.publication) throw new Response("Not found", { status: 404 });
  const job = room.publication.job;
  const q = new URL(request.url).searchParams;
  if (
    q.get("v") !== job.id ||
    !(await publicVisualisations(room.plan.apartmentId)).some(
      (v) => v.id === job.id,
    )
  )
    throw new Response("Not found", { status: 404 });
  const key = q.has("thumbnail") ? job.thumbnailKey : job.outputKey;
  if (!key) throw new Response("Not found", { status: 404 });
  return imageResponse(key);
}
