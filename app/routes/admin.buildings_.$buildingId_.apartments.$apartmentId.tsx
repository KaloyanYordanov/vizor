import { ApartmentPlanUpload } from "~/components/visualisations/ApartmentPlanUpload";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useFetcher } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { requireRole } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui";
import type { ApartmentStatus } from "@prisma/client";
import { useTranslation } from "react-i18next";
import { useState, useCallback } from "react";

/** Client-safe list of apartment statuses (avoids importing @prisma/client runtime in browser) */
const APARTMENT_STATUSES: string[] = ["AVAILABLE", "RESERVED", "SOLD", "UNAVAILABLE"];

export const meta: MetaFunction = () => [{ title: "Edit Apartment | Vizor Admin" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireRole(request, ["SUPER_ADMIN", "COMPANY_ADMIN"]);
  const apartment = await prisma.apartment.findUniqueOrThrow({
    where: { id: params.apartmentId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      floor: {
        include: {
          apartments: { orderBy: { number: "asc" }, select: { id: true, number: true } },
          building: {
            include: { project: { include: { company: true } } },
          },
        },
      },
    },
  });

  if (apartment.floor.buildingId !== params.buildingId || (user.role !== "SUPER_ADMIN" && apartment.floor.building.project.companyId !== user.companyId)) {
    throw new Response("Forbidden", { status: 403 });
  }

  // Sibling apartments for prev/next navigation
  const siblings = apartment.floor.apartments;
  const currentIdx = siblings.findIndex((a) => a.id === apartment.id);
  const prevApt = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextApt = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  return json({ apartment, buildingId: params.buildingId, prevApt, nextApt, siblingCount: siblings.length, currentIdx: currentIdx + 1 });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.headers.get("Origin") !== (process.env.APP_ORIGIN || new URL(request.url).origin)) throw new Response("Forbidden", {status:403});
  const user = await requireRole(request, ["SUPER_ADMIN", "COMPANY_ADMIN"]);
  const form = await request.formData();

  const apartment = await prisma.apartment.findUniqueOrThrow({
    where: { id: params.apartmentId },
    include: { floor: { include: { building: { include: { project: true } } } } },
  });
  if (apartment.floor.buildingId !== params.buildingId || (user.role !== "SUPER_ADMIN" && apartment.floor.building.project.companyId !== user.companyId)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const intent = (form.get("intent") as string) || "update";

  // Add apartment image
  if (intent === "add-image") {
    const url = (form.get("imageUrl") as string) || "";
    const caption = (form.get("caption") as string) || null;
    if (!url) return json({ error: "Image URL is required" }, { status: 400 });

    const maxSort = await prisma.apartmentImage.aggregate({
      where: { apartmentId: params.apartmentId },
      _max: { sortOrder: true },
    });
    await prisma.apartmentImage.create({
      data: {
        url,
        caption,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        apartmentId: params.apartmentId!,
      },
    });
    return json({ error: null, success: true, message: "Image added" });
  }

  // Delete apartment image
  if (intent === "delete-image") {
    const imageId = form.get("imageId") as string;
    await prisma.apartmentImage.deleteMany({ where: { id: imageId, apartmentId: apartment.id } });
    return json({ error: null, success: true, message: "Image deleted" });
  }

  // Update apartment details
  const number = form.get("number") as string;
  const rooms = parseFloat(form.get("rooms") as string);
  const area = parseFloat(form.get("area") as string);
  const price = form.get("price") ? parseFloat(form.get("price") as string) : null;
  const status = form.get("status") as ApartmentStatus;
  const svgPathId = (form.get("svgPathId") as string) || null;
  const description = (form.get("description") as string) || null;
  const features = (form.get("features") as string) || null;
  const floorPlanUrl = (form.get("floorPlanUrl") as string) || null;

  if (!number || isNaN(rooms) || isNaN(area)) {
    return json({ error: "Number, rooms, and area are required" }, { status: 400 });
  }

  await prisma.apartment.update({
    where: { id: params.apartmentId },
    data: {
      number,
      rooms,
      area,
      price,
      pricePerSqm: price ? Math.round(price / area) : null,
      status,
      svgPathId,
      description,
      features,
      floorPlanUrl,
    },
  });

  return redirect(`/admin/buildings/${params.buildingId}`);
}

export default function EditApartmentPage() {
  const { apartment, buildingId, prevApt, nextApt, siblingCount, currentIdx } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();
  const bldg = apartment.floor.building;

  const statusColorMap: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-700 border-green-200",
    RESERVED: "bg-yellow-100 text-yellow-700 border-yellow-200",
    SOLD: "bg-red-100 text-red-700 border-red-200",
    UNAVAILABLE: "bg-gray-100 text-gray-600 border-gray-200",
  };

  let features: Record<string, string> = {};
  try {
    if (apartment.features) features = JSON.parse(apartment.features as string);
  } catch { /* ignore */ }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("apartment.apartment")} ${apartment.number}`}
        description={`${bldg.project.company.name} → ${bldg.project.name} → ${bldg.name} → ${t("floor.floorN", { n: apartment.floor.number })}`}
        actions={
          <div className="flex items-center gap-2">
            <Link className="btn-primary btn-sm" to={`/admin/buildings/${buildingId}/visualisations?floor=${apartment.floorId}&apartment=${apartment.id}`}>{t("visualisations.title")}</Link>
            {/* Prev/Next navigation */}
            <span className="text-xs text-gray-400">{currentIdx}/{siblingCount}</span>
            {prevApt ? (
              <Link to={`/admin/buildings/${buildingId}/apartments/${prevApt.id}`} className="btn-secondary btn-sm" title={`Apt ${prevApt.number}`}>
                ←
              </Link>
            ) : (
              <span className="btn-secondary btn-sm opacity-30 pointer-events-none">←</span>
            )}
            {nextApt ? (
              <Link to={`/admin/buildings/${buildingId}/apartments/${nextApt.id}`} className="btn-secondary btn-sm" title={`Apt ${nextApt.number}`}>
                →
              </Link>
            ) : (
              <span className="btn-secondary btn-sm opacity-30 pointer-events-none">→</span>
            )}
            <Link to={`/admin/buildings/${buildingId}`} className="btn-secondary btn-sm">
              ← {t("common.back")}
            </Link>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("apartment.rooms")}</p>
          <p className="text-2xl font-bold mt-1">{apartment.rooms}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("apartment.area")}</p>
          <p className="text-2xl font-bold mt-1">{apartment.area} m²</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("apartment.price")}</p>
          <p className="text-2xl font-bold mt-1">
            {apartment.price ? `€${apartment.price.toLocaleString()}` : "—"}
          </p>
          {apartment.pricePerSqm && (
            <p className="text-xs text-gray-400 mt-0.5">€{apartment.pricePerSqm.toLocaleString()}/m²</p>
          )}
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("status.status")}</p>
          <div className="mt-2">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${statusColorMap[apartment.status] || statusColorMap.UNAVAILABLE}`}>
              {t(`status.${apartment.status.toLowerCase()}`)}
            </span>
          </div>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{t("floor.floor")}</p>
          <p className="text-2xl font-bold mt-1">{apartment.floor.number}</p>
          {apartment.floor.label && (
            <p className="text-xs text-gray-400 mt-0.5">{apartment.floor.label}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {apartment.description && (
            <div className="card">
              <div className="card-header">
                <span className="font-semibold text-sm">{t("common.description")}</span>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{apartment.description}</p>
              </div>
            </div>
          )}

          {/* Features overview */}
          {Object.keys(features).length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="font-semibold text-sm">{t("apartment.features")}</span>
              </div>
              <div className="card-body">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(features).map(([key, value]) => (
                    <span key={key} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      <span className="font-medium">{key}:</span> {String(value)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Edit form */}
          <div className="card">
            <details>
              <summary className="card-header cursor-pointer select-none">
                <span className="font-semibold text-sm">{t("apartment.editDetails")}</span>
              </summary>
              <div className="card-body">
                {actionData?.error && (
                  <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{actionData.error}</div>
                )}
                <Form method="post" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">{t("common.number")}</label>
                      <input name="number" className="input" defaultValue={apartment.number} required />
                    </div>
                    <div>
                      <label className="label">{t("status.status")}</label>
                      <select name="status" className="select" defaultValue={apartment.status}>
                        {APARTMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {t(`status.${s.toLowerCase()}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">{t("apartment.rooms")}</label>
                      <input name="rooms" type="number" step="0.5" className="input" defaultValue={apartment.rooms} required />
                    </div>
                    <div>
                      <label className="label">{t("editApartment.areaUnit", { unit: "m²" })}</label>
                      <input name="area" type="number" step="0.1" className="input" defaultValue={apartment.area} required />
                    </div>
                    <div>
                      <label className="label">{t("editApartment.priceCurrency", { currency: "€" })}</label>
                      <input name="price" type="number" className="input" defaultValue={apartment.price || ""} />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t("apartment.svgPathId")}</label>
                    <input name="svgPathId" className="input" defaultValue={apartment.svgPathId || ""} placeholder={t("apartment.svgPathIdPlaceholder")} />
                    <p className="text-xs text-gray-400 mt-1">{t("apartment.svgPathIdHelp")}</p>
                  </div>
                  <div>
                    <label className="label">{t("apartment.floorPlanUrlLabel")}</label>
                    <ApartmentPlanUpload defaultValue={apartment.floorPlanUrl || ""} />
                    <p className="text-xs text-gray-400 mt-1">{t("apartment.floorPlanUrlHelp")}</p>
                  </div>
                  <div>
                    <label className="label">{t("common.description")}</label>
                    <textarea name="description" className="input" rows={3} defaultValue={apartment.description || ""} />
                  </div>
                  <div>
                    <label className="label">{t("apartment.featuresJson")}</label>
                    <textarea
                      name="features"
                      className="input font-mono text-xs"
                      rows={3}
                      defaultValue={apartment.features || "{}"}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="btn-primary">{t("common.save")}</button>
                    <Link to={`/admin/buildings/${buildingId}`} className="btn-secondary">
                      {t("common.cancel")}
                    </Link>
                  </div>
                </Form>
              </div>
            </details>
          </div>
        </div>

        {/* Right column: floor plan & mapping info */}
        <div className="space-y-6">
          {/* Floor plan image */}
          {apartment.floorPlanUrl && (
            <div className="card">
              <div className="card-header">
                <span className="font-semibold text-sm">{t("apartment.floorPlan")}</span>
              </div>
              <div className="card-body p-0">
                <img
                  src={apartment.floorPlanUrl}
                  alt={t("apartment.floorPlanForApt", { number: apartment.number })}
                  className="w-full h-auto rounded-b-lg"
                />
              </div>
            </div>
          )}

          {/* Polygon status */}
          <div className="card">
            <div className="card-header">
              <span className="font-semibold text-sm">{t("apartment.mapping")}</span>
            </div>
            <div className="card-body">
              {apartment.polygonData ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t("apartment.mapped")}</span>
                  <span className="text-xs text-gray-500">
                    {Array.isArray(apartment.polygonData) ? `${(apartment.polygonData as any[]).length} points` : ""}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t("apartment.notMapped")}</p>
              )}
              {apartment.svgPathId && (
                <p className="text-xs text-gray-500 mt-1">SVG Path ID: <code className="bg-gray-100 px-1 rounded">{apartment.svgPathId}</code></p>
              )}
            </div>
          </div>

          {/* Apartment images gallery */}
          <div className="card">
            <div className="card-header">
              <span className="font-semibold text-sm">{t("apartment.gallery")}</span>
              <span className="text-xs text-gray-400 ml-1">({apartment.images.length})</span>
            </div>
            <div className="card-body space-y-3">
              {/* Existing images */}
              {apartment.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {apartment.images.map((img: any) => (
                    <div key={img.id} className="group relative rounded-lg overflow-hidden border border-gray-200">
                      <img src={img.url} alt={img.caption || ""} className="w-full h-24 object-cover" />
                      {img.caption && (
                        <p className="text-[10px] text-gray-500 px-1.5 py-0.5 truncate">{img.caption}</p>
                      )}
                      <Form method="post" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input type="hidden" name="intent" value="delete-image" />
                        <input type="hidden" name="imageId" value={img.id} />
                        <button
                          type="submit"
                          onClick={(e) => { if (!confirm(t("apartment.deleteImageConfirm"))) e.preventDefault(); }}
                          className="bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </Form>
                    </div>
                  ))}
                </div>
              )}
              {/* Add image form */}
              <ImageUploadForm apartmentId={apartment.id} t={t} />
            </div>
          </div>

          {/* Quick info */}
          <div className="card">
            <div className="card-header">
              <span className="font-semibold text-sm">{t("apartment.quickInfo")}</span>
            </div>
            <div className="card-body space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t("apartment.apartment")}</span>
                <span className="font-medium">{apartment.number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("floor.floor")}</span>
                <span className="font-medium">{apartment.floor.number}{apartment.floor.label ? ` (${apartment.floor.label})` : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("building.building")}</span>
                <span className="font-medium">{bldg.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("common.createdAt")}</span>
                <span className="font-medium text-xs">{new Date(apartment.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("common.updatedAt")}</span>
                <span className="font-medium text-xs">{new Date(apartment.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Image upload sub-component ─── */
function ImageUploadForm({ apartmentId, t }: { apartmentId: string; t: (key: string) => string }) {
  const fetcher = useFetcher();
  const [isUploading, setIsUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          fetcher.submit(
            { intent: "add-image", imageUrl: data.url, caption },
            { method: "post" }
          );
          setCaption("");
        }
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [fetcher, caption]
  );

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <div>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="input text-xs"
          placeholder={t("apartment.captionPlaceholder")}
        />
      </div>
      <label className="btn-primary btn-sm w-full text-center cursor-pointer block">
        {isUploading ? t("upload.uploading") : t("apartment.addImage")}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
      </label>
    </div>
  );
}
