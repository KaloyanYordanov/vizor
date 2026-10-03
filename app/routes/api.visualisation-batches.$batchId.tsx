import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { authorizeApartment } from "~/lib/visualisations/source.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const batch = await prisma.visualisationBatch.findUnique({
    where: { id: params.batchId },
  });
  if (!batch) throw new Response("Not found", { status: 404 });
  await authorizeApartment(request, batch.apartmentId);
  const jobs = await prisma.visualisationJob.findMany({
    where: { batchId: batch.id },
    select: {
      id: true,
      kind: true,
      state: true,
      errorCode: true,
      updatedAt: true,
    },
  });
  return json(
    { id: batch.id, jobs },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
