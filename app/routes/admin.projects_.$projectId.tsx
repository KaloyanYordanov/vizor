import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
    return json({ error: null, success: true });
  }

  if (intent === "delete-building") {
    const buildingId = form.get("buildingId") as string;
    if (!buildingId) {
      return json({ error: "Building ID is required" }, { status: 400 });
    }
    const building = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!building || building.projectId !== params.projectId) {
      return json({ error: "Building not found in this project" }, { status: 404 });
    }
    await prisma.building.delete({ where: { id: buildingId } });
    return json({ error: null, success: true });
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
    return json({ error: null, success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function EditProjectPage() {
  const { project } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={`${project.company.name} · ${t("projects.nBuildings", { n: project.buildings.length })}`}
      />

      {/* Edit form */}
      <div className="card max-w-2xl">
        <details>
          <summary className="card-header cursor-pointer select-none">
            <span className="font-semibold text-sm">{t("projects.projectDetails")}</span>
          </summary>
          <div className="card-body">
            {actionData?.error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{actionData.error}</div>
            )}
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="update" />
              <div>
                <label className="label">{t("common.name")}</label>
                <input name="name" className="input" defaultValue={project.name} required />
              </div>
              <div>
                <label className="label">{t("common.slug")}</label>
                <input name="slug" className="input" defaultValue={project.slug} required />
              </div>
              <div>
                <label className="label">{t("common.description")}</label>
                <textarea name="description" className="input" rows={3} defaultValue={project.description || ""} />
              </div>
              <div>
                <label className="label">{t("common.address")}</label>
                <input name="address" className="input" defaultValue={project.address || ""} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary">{t("common.save")}</button>
                <Link to="/admin/projects" className="btn-secondary">{t("common.back")}</Link>
              </div>
            </Form>
          </div>
        </details>
      </div>

      {/* Display Settings */}
      <div className="card max-w-2xl">
        <details>
          <summary className="card-header cursor-pointer select-none">
            <span className="font-semibold text-sm">{t("projects.displaySettings")}</span>
            <p className="text-xs text-gray-500 mt-0.5">{t("projects.displaySettingsDesc")}</p>
          </summary>
          <div className="card-body">
            {/* live preview + settings form */}
            <Form method="post" className="space-y-5">
              <input type="hidden" name="intent" value="update-settings" />

              <PreviewSettings project={project} />

              <button type="submit" className="btn-primary">{t("projects.saveSettings")}</button>
            </Form>
          </div>
        </details>
      </div>

      {/* Buildings list */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold">{t("admin.buildings")}</h2>
          <Link to="/admin/buildings" className="btn-primary btn-sm">
            {t("building.manageBuildings")}
          </Link>
        </div>
        {project.buildings.length === 0 ? (
          <div className="card-body text-sm text-gray-500">{t("projects.noBuildingsYet")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">{t("common.name")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500">{t("floor.floors")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500">{t("projects.hasSvg")}</th>
                  <th className="px-6 py-3 font-medium text-gray-500">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {project.buildings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">
                      <Link to={`/admin/buildings/${b.id}`} className="text-brand-600 hover:text-brand-700">
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-6 py-3">{b._count.floors}</td>
                    <td className="px-6 py-3">
                      {b.svgContent ? (
                        <span className="badge badge-available">{t("common.yes")}</span>
                      ) : (
                        <span className="badge badge-unavailable">{t("common.no")}</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-2">
                        <Link to={`/admin/buildings/${b.id}`} className="text-brand-600 hover:text-brand-700 text-sm">
                          {t("common.edit")}
                        </Link>
                        <Form method="post" onSubmit={(e) => { if (!confirm(t("building.deleteBuilding"))) e.preventDefault(); }}>
                          <input type="hidden" name="intent" value="delete-building" />
                          <input type="hidden" name="buildingId" value={b.id} />
                          <button type="submit" className="text-red-600 hover:text-red-700 text-sm">{t("common.delete")}</button>
                        </Form>
                      </div>
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
