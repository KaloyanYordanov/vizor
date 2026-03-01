import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { requireRole } from "~/lib/auth.server";
import { PageHeader, EmptyState } from "~/components/ui";
import { useTranslation } from "react-i18next";

export const meta: MetaFunction = () => [{ title: "Companies | Vizor Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireRole(request, ["SUPER_ADMIN"]);
  const companies = await prisma.company.findMany({
    include: { _count: { select: { projects: true, users: true } } },
    orderBy: { name: "asc" },
  });
  return json({ companies });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireRole(request, ["SUPER_ADMIN"]);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const name = form.get("name") as string;
    const slug = form.get("slug") as string;
    const website = (form.get("website") as string) || null;

    if (!name || !slug) {
      return json({ error: "Name and slug are required" }, { status: 400 });
    }
    const existing = await prisma.company.findUnique({ where: { slug } });
    if (existing) {
      return json({ error: "A company with this slug already exists" }, { status: 400 });
    }
    await prisma.company.create({ data: { name, slug, website } });
    return json({ success: true });
  }

  if (intent === "delete") {
    const id = form.get("id") as string;
    await prisma.company.delete({ where: { id } });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function CompaniesPage() {
  const { companies } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("companies.heading")}
        description={t("companies.description")}
      />

      {/* Create form */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold">{t("companies.addCompany")}</h2>
        </div>
        <div className="card-body">
          {actionData?.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {actionData.error}
            </div>
          )}
          <Form method="post" className="flex flex-wrap gap-3 items-end">
            <input type="hidden" name="intent" value="create" />
            <div className="flex-1 min-w-[200px]">
              <label className="label">{t("common.name")}</label>
              <input name="name" className="input" placeholder={t("companies.namePlaceholder")} required />
            </div>
            <div className="w-40">
              <label className="label">{t("common.slug")}</label>
              <input name="slug" className="input" placeholder={t("companies.slugPlaceholder")} required />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="label">{t("common.website")}</label>
              <input name="website" className="input" placeholder={t("companies.websitePlaceholder")} />
            </div>
            <button type="submit" className="btn-primary">{t("common.add")}</button>
          </Form>
        </div>
      </div>

      {/* List */}
      {companies.length === 0 ? (
        <EmptyState title={t("companies.noCompanies")} description={t("companies.noCompaniesDesc")} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">{t("common.name")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("common.slug")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("companies.projects")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("companies.users")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{company.name}</td>
                  <td className="px-6 py-3 text-gray-500">{company.slug}</td>
                  <td className="px-6 py-3">{company._count.projects}</td>
                  <td className="px-6 py-3">{company._count.users}</td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Link to={`/admin/companies/${company.id}`} className="text-brand-600 hover:text-brand-700 text-sm">
                        {t("common.edit")}
                      </Link>
                      <Form method="post" onSubmit={(e) => { if (!confirm(t("companies.deleteConfirm"))) e.preventDefault(); }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={company.id} />
                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm">
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
    </div>
  );
}
