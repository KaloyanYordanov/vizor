import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useTranslation } from "react-i18next";
import { prisma } from "~/lib/db.server";
import { requireRole } from "~/lib/auth.server";
import { PageHeader } from "~/components/ui";

export const meta: MetaFunction = () => [{ title: "Edit Company | Vizor Admin" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireRole(request, ["SUPER_ADMIN"]);
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: params.companyId },
  });
  return json({ company });
}

export async function action({ request, params }: ActionFunctionArgs) {
  await requireRole(request, ["SUPER_ADMIN"]);
  const form = await request.formData();
  const name = form.get("name") as string;
  const slug = form.get("slug") as string;
  const website = (form.get("website") as string) || null;

  if (!name || !slug) {
    return json({ error: "Name and slug are required" }, { status: 400 });
  }

  const existing = await prisma.company.findFirst({
    where: { slug, NOT: { id: params.companyId } },
  });
  if (existing) {
    return json({ error: "Slug already in use" }, { status: 400 });
  }

  await prisma.company.update({
    where: { id: params.companyId },
    data: { name, slug, website },
  });

  return redirect("/admin/companies");
}

export default function EditCompanyPage() {
  const { t } = useTranslation();
  const { company } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <PageHeader title={`${t("companies.editCompany")}: ${company.name}`} />

      <div className="card max-w-2xl">
        <div className="card-body">
          {actionData?.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {actionData.error}
            </div>
          )}
          <Form method="post" className="space-y-4">
            <div>
              <label className="label">{t("common.name")}</label>
              <input name="name" className="input" defaultValue={company.name} required />
            </div>
            <div>
              <label className="label">{t("common.slug")}</label>
              <input name="slug" className="input" defaultValue={company.slug} required />
            </div>
            <div>
              <label className="label">{t("common.website")}</label>
              <input name="website" className="input" defaultValue={company.website || ""} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">{t("common.saveChanges")}</button>
              <Link to="/admin/companies" className="btn-secondary">{t("common.cancel")}</Link>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
