import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader, StatusBadge } from "~/components/ui";
import type { ApartmentStatus } from "@prisma/client";
import { type DrawnPolygon } from "~/components/PolygonEditor";
import { ImagePolygonMapper } from "~/components/ImagePolygonMapper";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const meta: MetaFunction = () => [{ title: "Edit Building | Vizor Admin" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const building = await prisma.building.findUniqueOrThrow({
    where: { id: params.buildingId },
    include: {
      project: { include: { company: { select: { name: true, slug: true } } } },
      floors: {
        include: {
          apartments: { orderBy: { number: "asc" } },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  if (user.role !== "SUPER_ADMIN" && building.project.companyId !== user.companyId) {
    throw new Response("Forbidden", { status: 403 });
  }

  return json({ building });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  const building = await prisma.building.findUniqueOrThrow({
    where: { id: params.buildingId },
    include: { project: true },
  });
  if (user.role !== "SUPER_ADMIN" && building.project.companyId !== user.companyId) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  // Update building
  if (intent === "update-building") {
    const name = form.get("name") as string;
    const slug = form.get("slug") as string;
    const description = (form.get("description") as string) || null;

    if (!name || !slug) return json({ error: "Name and slug required" }, { status: 400 });

    await prisma.building.update({
      where: { id: params.buildingId },
      data: { name, slug, description },
    });
    return json({ success: true, message: "Building updated" });
  }

  // Add floor
  if (intent === "add-floor") {
    const number = parseInt(form.get("floorNumber") as string);
    const label = (form.get("floorLabel") as string) || null;

    if (isNaN(number)) return json({ error: "Floor number is required" }, { status: 400 });

    const existing = await prisma.floor.findFirst({
      where: { buildingId: params.buildingId, number },
    });
    if (existing) return json({ error: `Floor ${number} already exists` }, { status: 400 });

    await prisma.floor.create({
      data: {
        number,
        label,
        buildingId: params.buildingId!,
        sortOrder: number,
      },
    });
    return json({ success: true, message: "Floor added" });
  }

  // Delete floor
  if (intent === "delete-floor") {
    const floorId = form.get("floorId") as string;
    await prisma.floor.delete({ where: { id: floorId } });
    return json({ success: true, message: "Floor deleted" });
  }

  // Add apartment
  if (intent === "add-apartment") {
    const floorId = form.get("floorId") as string;
    const number = form.get("aptNumber") as string;
    const rooms = parseFloat(form.get("rooms") as string);
    const area = parseFloat(form.get("area") as string);
    const price = form.get("price") ? parseFloat(form.get("price") as string) : null;
    const status = (form.get("status") as ApartmentStatus) || ApartmentStatus.AVAILABLE;

    if (!number || isNaN(rooms) || isNaN(area)) {
      return json({ error: "Number, rooms, and area are required" }, { status: 400 });
    }

    await prisma.apartment.create({
      data: {
        number,
        rooms,
        area,
        price,
        pricePerSqm: price ? Math.round(price / area) : null,
        status,
        floorId,
      },
    });
    return json({ success: true, message: "Apartment added" });
  }

  // Update apartment
  if (intent === "update-apartment") {
    const aptId = form.get("aptId") as string;
    const number = form.get("aptNumber") as string;
    const rooms = parseFloat(form.get("rooms") as string);
    const area = parseFloat(form.get("area") as string);
    const price = form.get("price") ? parseFloat(form.get("price") as string) : null;
    const status = form.get("status") as ApartmentStatus;

    await prisma.apartment.update({
      where: { id: aptId },
      data: {
        number,
        rooms,
        area,
        price,
        pricePerSqm: price ? Math.round(price / area) : null,
        status,
      },
    });
    return json({ success: true, message: "Apartment updated" });
  }

  // Delete apartment
  if (intent === "delete-apartment") {
    const aptId = form.get("aptId") as string;
    await prisma.apartment.delete({ where: { id: aptId } });
    return json({ success: true, message: "Apartment deleted" });
  }

  // Update floor image URL
  if (intent === "update-floor-image") {
    const floorId = form.get("floorId") as string;
    const imageUrl = (form.get("imageUrl") as string) || null;
    await prisma.floor.update({
      where: { id: floorId },
      data: { imageUrl },
    });
    return json({ success: true, message: "Floor image updated" });
  }

  // Save polygon data for apartments
  if (intent === "save-polygons") {
    const polygonsJson = form.get("polygons") as string;
    try {
      const polygons: Array<{ apartmentId: string; points: Array<{ x: number; y: number }> }> = JSON.parse(polygonsJson);

      // Clear existing polygons for all apartments on this floor
      const floorId = form.get("floorId") as string;
      await prisma.apartment.updateMany({
        where: { floorId },
        data: { polygonData: null },
      });

      // Set polygon data for each linked apartment
      for (const poly of polygons) {
        if (poly.apartmentId) {
          await prisma.apartment.update({
            where: { id: poly.apartmentId },
            data: { polygonData: poly.points },
          });
        }
      }
      return json({ success: true, message: "Polygon mappings saved" });
    } catch {
      return json({ error: "Invalid polygon data" }, { status: 400 });
    }
  }

  // Update building image URL
  if (intent === "update-building-image") {
    const imageUrl = (form.get("imageUrl") as string) || null;
    await prisma.building.update({
      where: { id: params.buildingId },
      data: { imageUrl },
    });
    return json({ success: true, message: "Building image updated" });
  }

  // Save building floor polygon data
  if (intent === "save-building-polygons") {
    const polygonsJson = form.get("polygons") as string;
    try {
      const parsed: Array<{ apartmentId: string; points: Array<{ x: number; y: number }> }> =
        JSON.parse(polygonsJson);
      await prisma.building.update({
        where: { id: params.buildingId },
        data: { floorsPolygonData: parsed as any },
      });
      return json({ success: true, message: "Building floor polygon mappings saved" });
    } catch (e) {
      console.error("save-building-polygons error:", e);
      return json({ error: "Invalid polygon data" }, { status: 400 });
    }
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function EditBuildingPage() {
  const { building } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <PageHeader
        title={building.name}
        description={`${building.project.company.name} → ${building.project.name}`}
        actions={
          <Link
            to={`/view/${building.project.company.slug}/${building.project.slug}`}
            className="btn-secondary btn-sm"
            target="_blank"
          >
            {t("building.previewLink")}
          </Link>
        }
      />

      {(actionData?.error || actionData?.message) && (
        <div
          className={`rounded-lg p-3 text-sm ${
            actionData.error
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {actionData.error || actionData.message}
        </div>
      )}

      {/* Building details */}
      <div className="card">
        <details>
          <summary className="card-header cursor-pointer select-none">
            <span className="font-semibold text-sm">{t("building.buildingDetails")}</span>
          </summary>
          <div className="card-body">
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update-building" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t("common.name")}</label>
                  <input name="name" className="input" defaultValue={building.name} required />
                </div>
                <div>
                  <label className="label">{t("common.slug")}</label>
                  <input name="slug" className="input" defaultValue={building.slug} required />
                </div>
              </div>
              <div>
                <label className="label">{t("common.description")}</label>
                <textarea name="description" className="input" rows={2} defaultValue={building.description || ""} />
              </div>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {t("building.saveBuildingBtn")}
              </button>
            </Form>
          </div>
        </details>
      </div>

      {/* Add floor */}
      <div className="card">
        <details>
          <summary className="card-header cursor-pointer select-none">
            <span className="font-semibold text-sm">{t("floor.addFloor")}</span>
          </summary>
          <div className="card-body">
            <Form method="post" className="space-y-3">
              <input type="hidden" name="intent" value="add-floor" />
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-24">
                  <label className="label">{t("floor.floorNumber")}</label>
                  <input name="floorNumber" type="number" className="input" required />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="label">{t("common.label")}</label>
                  <input name="floorLabel" className="input" placeholder={t("floor.floorLabelPlaceholder")} />
                </div>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {t("floor.addFloor")}
                </button>
              </div>
            </Form>
          </div>
        </details>
      </div>

      {/* Building Image & Floor Polygon Map */}
      <BuildingImageSection building={building} />

      {/* Floors & Apartments */}
      {building.floors.map((floor) => (
        <FloorCard
          key={floor.id}
          floor={floor}
          buildingId={building.id}
          isSubmitting={isSubmitting}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────
 * Building Image & Floor Polygon Map section
 * ──────────────────────────────────────────────── */
function BuildingImageSection({ building }: { building: any }) {
  const { t } = useTranslation();
  const floorItems = useMemo(
    () =>
      building.floors.map((f: any) => ({
        id: f.id,
        number: f.label || t("floor.floorN", { n: f.number }),
        status: "AVAILABLE",
      })),
    [building.floors]
  );

  const initialPolygons = useMemo<DrawnPolygon[]>(() => {
    if (!building.floorsPolygonData || !Array.isArray(building.floorsPolygonData)) return [];
    return (building.floorsPolygonData as any[]).map((p: any) => ({
      apartmentId: p.apartmentId || "",
      points: p.points || [],
    }));
  }, [building.floorsPolygonData]);

  return (
    <div className="card">
      <details open={!!building.imageUrl}>
        <summary className="card-header cursor-pointer select-none">
          <span className="font-semibold text-sm">{t("building.buildingImage")}</span>
          {building.imageUrl && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {t("building.imageUploaded")}
            </span>
          )}
        </summary>
        <div className="card-body">
          <ImagePolygonMapper
            imageUrl={building.imageUrl || null}
            initialPolygons={initialPolygons}
            items={floorItems}
            itemLabel="Floor"
            imageSaveIntent="update-building-image"
            imageSaveFields={{}}
            polygonSaveIntent="save-building-polygons"
            polygonSaveFields={{}}
            uploadLabel={t("building.uploadBuildingImage")}
            description={t("building.uploadBuildingImageDesc")}
          />
        </div>
      </details>
    </div>
  );
}

/* ────────────────────────────────────────────────
 * Floor card with apartments, image upload, polygons
 * ──────────────────────────────────────────────── */
function FloorCard({
  floor,
  buildingId,
  isSubmitting,
}: {
  floor: any;
  buildingId: string;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();
  const floorImageUrl: string | null = floor.imageUrl || null;

  const apartmentItems = useMemo(
    () =>
      floor.apartments.map((a: any) => ({
        id: a.id,
        number: a.number,
        status: a.status,
      })),
    [floor.apartments]
  );

  const initialPolygons = useMemo<DrawnPolygon[]>(
    () =>
      floor.apartments
        .filter(
          (apt: any) =>
            apt.polygonData &&
            Array.isArray(apt.polygonData) &&
            apt.polygonData.length >= 3
        )
        .map((apt: any) => ({
          apartmentId: apt.id,
          points: apt.polygonData as Array<{ x: number; y: number }>,
        })),
    [floor.apartments]
  );

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h3 className="font-semibold">
            {t("floor.floorN", { n: floor.number })}
            {floor.label && (
              <span className="text-gray-400 font-normal ml-2">— {floor.label}</span>
            )}
          </h3>
          <p className="text-xs text-gray-500">{t("floor.nApartments", { n: floor.apartments.length })}</p>
        </div>
        <div className="flex gap-2">
          <Form
            method="post"
            onSubmit={(e) => {
              if (!confirm(t("floor.deleteFloorConfirm"))) e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete-floor" />
            <input type="hidden" name="floorId" value={floor.id} />
            <button type="submit" className="btn-danger btn-sm">
              {t("floor.deleteFloor")}
            </button>
          </Form>
        </div>
      </div>

      <div className="card-body space-y-4">
        {/* Floor Plan Image & Polygon Editor */}
        <details className="border rounded-lg p-3" open={!!floorImageUrl}>
          <summary className="text-sm font-medium text-gray-600 cursor-pointer flex items-center gap-2">
            <span>{t("floor.floorPlanImage")}</span>
            {floorImageUrl && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {t("building.imageUploaded")}
              </span>
            )}
          </summary>
          <div className="mt-3">
            <ImagePolygonMapper
              imageUrl={floorImageUrl}
              initialPolygons={initialPolygons}
              items={apartmentItems}
              itemLabel="Apartment"
              imageSaveIntent="update-floor-image"
              imageSaveFields={{ floorId: floor.id }}
              polygonSaveIntent="save-polygons"
              polygonSaveFields={{ floorId: floor.id }}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              uploadLabel={t("floor.uploadFloorPlanImage")}
            />
          </div>
        </details>

        {/* Apartments table */}
        {floor.apartments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-3 py-2 font-medium text-gray-500">{t("common.number")}</th>
                  <th className="px-3 py-2 font-medium text-gray-500">{t("apartment.rooms")}</th>
                  <th className="px-3 py-2 font-medium text-gray-500">{t("apartment.area")}</th>
                  <th className="px-3 py-2 font-medium text-gray-500">{t("apartment.price")}</th>
                  <th className="px-3 py-2 font-medium text-gray-500">{t("status.status")}</th>
                  <th className="px-3 py-2 font-medium text-gray-500">{t("apartment.polygon")}</th>
                  <th className="px-3 py-2 font-medium text-gray-500">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {floor.apartments.map((apt: any) => (
                  <tr key={apt.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-medium">{apt.number}</td>
                    <td className="px-3 py-2">{apt.rooms}</td>
                    <td className="px-3 py-2">{apt.area}m²</td>
                    <td className="px-3 py-2">
                      {apt.price ? `€${apt.price.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={apt.status as ApartmentStatus} />
                    </td>
                    <td className="px-3 py-2">
                      {apt.polygonData ? (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          {t("apartment.mapped")}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Link
                          to={`/admin/buildings/${buildingId}/apartments/${apt.id}`}
                          className="text-brand-600 hover:text-brand-700 text-xs"
                        >
                          {t("common.edit")}
                        </Link>
                        <Form
                          method="post"
                          onSubmit={(e) => {
                            if (!confirm(t("editBuilding.deleteApartmentConfirm"))) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="intent" value="delete-apartment" />
                          <input type="hidden" name="aptId" value={apt.id} />
                          <button
                            type="submit"
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            {t("common.delete")}
                          </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add apartment */}
        <details className="border rounded-lg p-3">
          <summary className="text-sm font-medium text-gray-600 cursor-pointer">
            {t("editBuilding.addApartment")}
          </summary>
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="add-apartment" />
            <input type="hidden" name="floorId" value={floor.id} />
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-24">
                <label className="label">{t("common.number")}</label>
                <input name="aptNumber" className="input" placeholder="101" required />
              </div>
              <div className="w-20">
                <label className="label">{t("apartment.rooms")}</label>
                <input name="rooms" type="number" step="0.5" className="input" required />
              </div>
              <div className="w-24">
                <label className="label">{t("editApartment.areaUnit", { unit: "m²" })}</label>
                <input name="area" type="number" step="0.1" className="input" required />
              </div>
              <div className="w-28">
                <label className="label">{t("editApartment.priceCurrency", { currency: "€" })}</label>
                <input name="price" type="number" className="input" />
              </div>
              <div className="w-32">
                <label className="label">{t("status.status")}</label>
                <select name="status" className="select">
                  <option value="AVAILABLE">{t("status.available")}</option>
                  <option value="RESERVED">{t("status.reserved")}</option>
                  <option value="SOLD">{t("status.sold")}</option>
                  <option value="UNAVAILABLE">{t("status.unavailable")}</option>
                </select>
              </div>
              <button type="submit" className="btn-primary btn-sm">
                {t("common.add")}
              </button>
            </div>
          </Form>
        </details>
      </div>
    </div>
  );
}
