import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui";
import { ApartmentStatus } from "@prisma/client";

export const meta: MetaFunction = () => [{ title: "Edit Apartment | Vizor Admin" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const apartment = await prisma.apartment.findUniqueOrThrow({
    where: { id: params.apartmentId },
    include: {
      floor: {
        include: {
          building: {
            include: { project: { include: { company: true } } },
          },
        },
      },
    },
  });

  if (user.role !== "SUPER_ADMIN" && apartment.floor.building.project.companyId !== user.companyId) {
    throw new Response("Forbidden", { status: 403 });
  }

  return json({ apartment, buildingId: params.buildingId });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();

  const apartment = await prisma.apartment.findUniqueOrThrow({
    where: { id: params.apartmentId },
    include: { floor: { include: { building: { include: { project: true } } } } },
  });
  if (user.role !== "SUPER_ADMIN" && apartment.floor.building.project.companyId !== user.companyId) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const number = form.get("number") as string;
  const rooms = parseFloat(form.get("rooms") as string);
  const area = parseFloat(form.get("area") as string);
  const price = form.get("price") ? parseFloat(form.get("price") as string) : null;
  const status = form.get("status") as ApartmentStatus;
  const svgPathId = (form.get("svgPathId") as string) || null;
  const description = (form.get("description") as string) || null;
  const features = (form.get("features") as string) || null;

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
    },
  });

  return redirect(`/admin/buildings/${params.buildingId}`);
}

export default function EditApartmentPage() {
  const { apartment, buildingId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const bldg = apartment.floor.building;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Apartment ${apartment.number}`}
        description={`${bldg.project.company.name} → ${bldg.project.name} → ${bldg.name} → Floor ${apartment.floor.number}`}
      />

      <div className="card max-w-2xl">
        <div className="card-body">
          {actionData?.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{actionData.error}</div>
          )}
          <Form method="post" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Number</label>
                <input name="number" className="input" defaultValue={apartment.number} required />
              </div>
              <div>
                <label className="label">Status</label>
                <select name="status" className="select" defaultValue={apartment.status}>
                  {Object.values(ApartmentStatus).map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Rooms</label>
                <input name="rooms" type="number" step="0.5" className="input" defaultValue={apartment.rooms} required />
              </div>
              <div>
                <label className="label">Area (m²)</label>
                <input name="area" type="number" step="0.1" className="input" defaultValue={apartment.area} required />
              </div>
              <div>
                <label className="label">Price (€)</label>
                <input name="price" type="number" className="input" defaultValue={apartment.price || ""} />
              </div>
            </div>
            <div>
              <label className="label">SVG Path ID</label>
              <input name="svgPathId" className="input" defaultValue={apartment.svgPathId || ""} placeholder="apt-101" />
              <p className="text-xs text-gray-400 mt-1">ID of the SVG element that represents this apartment on the floor plan</p>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" className="input" rows={3} defaultValue={apartment.description || ""} />
            </div>
            <div>
              <label className="label">Features (JSON)</label>
              <textarea
                name="features"
                className="input font-mono text-xs"
                rows={3}
                defaultValue={apartment.features || "{}"}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">Save</button>
              <Link to={`/admin/buildings/${buildingId}`} className="btn-secondary">
                Cancel
              </Link>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
