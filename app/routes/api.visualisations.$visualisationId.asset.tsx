import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { authorizeApartment } from "~/lib/visualisations/source.server";
import { imageResponse } from "~/lib/visualisations/http.server";
import type { JobInput } from "~/lib/visualisations/service.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const job = await prisma.visualisationJob.findUnique({
    where: { id: params.visualisationId },
    include: { batch: true },
  });
  if (!job) throw new Response("Not found", { status: 404 });
  await authorizeApartment(request, job.batch.apartmentId);
  const q = new URL(request.url).searchParams;
  const key = q.has("source")
    ? (job.input as JobInput).imageKey
    : job.state === "SUCCEEDED"
      ? q.has("thumbnail")
        ? job.thumbnailKey
        : job.outputKey
      : null;
  if (!key) throw new Response("Not found", { status: 404 });
  return imageResponse(key, q.has("download"));
}
