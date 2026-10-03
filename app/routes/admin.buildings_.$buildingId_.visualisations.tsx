import { imageCost, batchImageCost } from "../lib/visualisations/cost.server";
import { workerOnline } from "~/lib/visualisations/maintenance.server";
import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { prisma } from "~/lib/db.server";
import { requireRole } from "~/lib/auth.server";
import {
  authorizeApartment,
  hasApartmentPolygon,
  sourceFingerprint,
} from "~/lib/visualisations/source.server";
import {
  preparePlan,
  enqueue,
  publish,
  type JobInput,
  type BatchSettings,
} from "~/lib/visualisations/service.server";
import {
  checkOrigin,
  parseJson,
  validateRegion,
  VisualisationError,
} from "~/lib/visualisations/validation.server";
import { visualisationConfig } from "~/lib/visualisations/config.server";
import { VisualisationStudio } from "~/components/visualisations/VisualisationStudio";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["SUPER_ADMIN", "COMPANY_ADMIN"]);
  const building = await prisma.building.findFirst({
    where: {
      id: params.buildingId,
      ...(user.role !== "SUPER_ADMIN"
        ? { project: { companyId: user.companyId! } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      floors: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          label: true,
          type: true,
          apartments: {
            orderBy: { number: "asc" },
            select: { id: true, number: true },
          },
        },
      },
    },
  });
  if (!building) throw new Response("Not found", { status: 404 });
  const apartmentId = new URL(request.url).searchParams.get("apartment");
  let selected = null;
  if (apartmentId) {
    const { apartment } = await authorizeApartment(
      request,
      apartmentId,
      building.id,
    );
    const plan = await prisma.visualisationPlan.findUnique({
      where: { apartmentId },
    });
    const batches = await prisma.visualisationBatch.findMany({
      where: { apartmentId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        jobs: {
          orderBy: { createdAt: "asc" },
          include: { apartmentPublication: true },
        },
      },
    });
    selected = {
      id: apartment.id,
      number: apartment.number,
      floorId: apartment.floorId,
      dedicated: !!apartment.floorPlanUrl,
      hasMappedRegion: hasApartmentPolygon(apartment.polygonData),
      hasSource: !!(
        apartment.floorPlanUrl ||
        apartment.floor.imageUrl ||
        apartment.floor.svgContent
      ),
      plan: plan
        ? {
            id: plan.id,
            revision: plan.revision,
            stale: plan.fingerprint !== sourceFingerprint(apartment),
          }
        : null,
      batches: batches.map((b) => ({
        id: b.id,
        styleId: b.styleId,
        createdAt: b.createdAt,
        settings: b.settings as unknown as BatchSettings,
        cost: batchImageCost(
          (b.settings as unknown as BatchSettings).model,
          b.jobs,
        ),
        jobs: b.jobs.map((j) => {
          const i = j.input as JobInput;
          return {
            id: j.id,
            kind: j.kind,
            scope: i.scope,
            cost:
              j.kind === "IMAGE"
                ? imageCost(
                    (b.settings as unknown as BatchSettings).model,
                    j.result,
                  )
                : null,
            label: i.label,
            state: j.state,
            errorCode: j.errorCode,
            published: !!j.apartmentPublication,
            stale:
              !plan ||
              plan.fingerprint !== sourceFingerprint(apartment) ||
              i.planRevision !== plan.revision,
          };
        }),
      })),
    };
  }
  const cfg = visualisationConfig();
  return json(
    {
      building,
      selected,
      config: {
        workerOnline: await workerOnline(),
        enabled: cfg.enabled,
        configured: cfg.configured,
        size: cfg.size,
        quality: cfg.quality,
        dailyImages: cfg.dailyImages,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    checkOrigin(request);
    const form = await request.formData();
    const { apartment, user } = await authorizeApartment(
      request,
      String(form.get("apartmentId") || ""),
      params.buildingId,
    );
    const intent = String(form.get("intent"));
    if (intent === "prepare")
      await preparePlan(
        apartment,
        form.get("crop")
          ? validateRegion(parseJson(form.get("crop")))
          : undefined,
      );
    else if (intent === "generate") {
      const batch = await enqueue(apartment.id, user.id, {
        clientRequestId: String(form.get("clientRequestId")),
        planRevision: Number(form.get("planRevision")),
        styleId: String(form.get("styleId") || "contemporary"),
        retryOfId: form.get("retryOfId")
          ? String(form.get("retryOfId"))
          : undefined,
      });
      return json(
        { ok: true, error: null, batchId: batch.id },
        { status: 202 },
      );
    } else if (intent === "publish" || intent === "unpublish")
      await publish(
        apartment.id,
        user.id,
        String(form.get("jobId")),
        form.get("reviewed") === "true",
        intent === "unpublish",
      );
    else throw new VisualisationError("INVALID_INPUT");
    return json({ ok: true, error: null, batchId: null });
  } catch (e) {
    if (e instanceof Response) throw e;
    if (e instanceof VisualisationError)
      return json(
        { ok: false, error: e.code, batchId: null },
        { status: e.status },
      );
    console.error(
      "visualisation.action failed",
      e instanceof Error ? e.name : "unknown",
    );
    return json(
      { ok: false, error: "OPERATION_FAILED", batchId: null },
      { status: 500 },
    );
  }
}
export default VisualisationStudio;
