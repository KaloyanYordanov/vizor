import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import PreviewSettings from "~/routes/_components/ProjectSettingsPreview";
import { prisma } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui";
import { DEFAULT_PROJECT_SETTINGS } from "~/utils/colors";

export const meta: MetaFunction = () => [{ title: "Edit Project | Vizor Admin" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
    include: {
      company: { select: { name: true } },
      buildings: {
        include: { _count: { select: { floors: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (user.role !== "SUPER_ADMIN" && project.companyId !== user.companyId) {
    throw new Response("Forbidden", { status: 403 });
  }

  return json({ project });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
  if (user.role !== "SUPER_ADMIN" && project.companyId !== user.companyId) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  if (intent === "update") {
    const name = form.get("name") as string;
    const slug = form.get("slug") as string;
    const description = (form.get("description") as string) || null;
    const address = (form.get("address") as string) || null;

    if (!name || !slug) {
      return json({ error: "Name and slug are required" }, { status: 400 });
    }

    await prisma.project.update({
      where: { id: params.projectId },
      data: { name, slug, description, address },
    });
    return json({ success: true });
  }

  if (intent === "update-settings") {
    const currencySymbol = (form.get("currencySymbol") as string) || "€";
    const areaUnit = (form.get("areaUnit") as string) || "m²";
    const primaryColor = (form.get("primaryColor") as string) || "#2563eb";
    const availableColor = (form.get("availableColor") as string) || DEFAULT_PROJECT_SETTINGS.availableColor;
    const reservedColor = (form.get("reservedColor") as string) || DEFAULT_PROJECT_SETTINGS.reservedColor;
    const soldColor = (form.get("soldColor") as string) || DEFAULT_PROJECT_SETTINGS.soldColor;
    const unavailableColor = (form.get("unavailableColor") as string) || DEFAULT_PROJECT_SETTINGS.unavailableColor;
    const strokeColor = (form.get("strokeColor") as string) || DEFAULT_PROJECT_SETTINGS.strokeColor;
    const strokeWidth = parseInt((form.get("strokeWidth") as string) || String(DEFAULT_PROJECT_SETTINGS.strokeWidth), 10);
    const tooltipStyle = (form.get("tooltipStyle") as string) || "modern";

    await prisma.project.update({
      where: { id: params.projectId },
      data: {
        currencySymbol,
        areaUnit,
        primaryColor,
        availableColor,
        reservedColor,
        soldColor,
        unavailableColor,
        strokeColor,
        strokeWidth,
        tooltipStyle,
      },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function EditProjectPage() {
  const { project } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.company.name} · ${project.buildings.length} building(s)`}
      />

      {/* Edit form */}
      <div className="card max-w-2xl">
        <div className="card-header">
          <h2 className="font-semibold text-sm">Project Details</h2>
        </div>
        <div className="card-body">
          {actionData?.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{actionData.error}</div>
          )}
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="update" />
            <div>
              <label className="label">Name</label>
              <input name="name" className="input" defaultValue={project.name} required />
            </div>
            <div>
              <label className="label">Slug</label>
              <input name="slug" className="input" defaultValue={project.slug} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea name="description" className="input" rows={3} defaultValue={project.description || ""} />
            </div>
            <div>
              <label className="label">Address</label>
              <input name="address" className="input" defaultValue={project.address || ""} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">Save</button>
              <Link to="/admin/projects" className="btn-secondary">Back</Link>
            </div>
          </Form>
        </div>
      </div>

      {/* Display Settings */}
      <div className="card max-w-2xl">
        <div className="card-header">
          <h2 className="font-semibold text-sm">Display Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">Configure colors, currency, and tooltip style for the public viewer</p>
        </div>
        <div className="card-body">
          {/* live preview + settings form */}
          <Form method="post" className="space-y-5">
            <input type="hidden" name="intent" value="update-settings" />

            {/* initialize preview state from project with safe fallbacks */}
            {/* (we keep inputs uncontrolled for form submission but mirror live changes in previewState) */}
            {/** preview UI state **/}
            <PreviewSettings project={project} />

            <button type="submit" className="btn-primary">Save Settings</button>
          </Form>
        </div>
      </div>

      {/* Buildings list */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold">Buildings</h2>
          <Link to="/admin/buildings" className="btn-primary btn-sm">
            Manage Buildings
          </Link>
        </div>
        {project.buildings.length === 0 ? (
          <div className="card-body text-sm text-gray-500">No buildings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Floors</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Has SVG</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {project.buildings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{b.name}</td>
                    <td className="px-6 py-3">{b._count.floors}</td>
                    <td className="px-6 py-3">
                      {b.svgContent ? (
                        <span className="badge badge-available">Yes</span>
                      ) : (
                        <span className="badge badge-unavailable">No</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <Link to={`/admin/buildings/${b.id}`} className="text-brand-600 hover:text-brand-700 text-sm">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
