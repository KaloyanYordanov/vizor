import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader, EmptyState } from "~/components/ui";

export const meta: MetaFunction = () => [{ title: "Buildings | Vizor Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const where = user.role === "SUPER_ADMIN" ? {} : { companyId: user.companyId! };

  const [buildings, projects] = await Promise.all([
    prisma.building.findMany({
      where: { project: where },
      include: {
        project: { select: { name: true, company: { select: { name: true } } } },
        _count: { select: { floors: true } },
      },
      orderBy: [{ project: { name: "asc" } }, { sortOrder: "asc" }],
    }),
    prisma.project.findMany({
      where,
      select: { id: true, name: true, company: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return json({ buildings, projects });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const name = form.get("name") as string;
    const slug = form.get("slug") as string;
    const description = (form.get("description") as string) || null;
    const projectId = form.get("projectId") as string;

    if (!name || !slug || !projectId) {
      return json({ error: "Name, slug, and project are required" }, { status: 400 });
    }

    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    if (user.role !== "SUPER_ADMIN" && project.companyId !== user.companyId) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.building.findFirst({ where: { projectId, slug } });
    if (existing) {
      return json({ error: "Building slug already exists in this project" }, { status: 400 });
    }

    const count = await prisma.building.count({ where: { projectId } });
    await prisma.building.create({
      data: { name, slug, description, projectId, sortOrder: count + 1 },
    });
    return json({ success: true });
  }

  if (intent === "delete") {
    const id = form.get("id") as string;
    await prisma.building.delete({ where: { id } });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function BuildingsPage() {
  const { buildings, projects } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <PageHeader title="Buildings" description="Manage buildings across projects" />

      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold">Add Building</h2>
        </div>
        <div className="card-body">
          {actionData?.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{actionData.error}</div>
          )}
          <Form method="post" className="flex flex-wrap gap-3 items-end">
            <input type="hidden" name="intent" value="create" />
            <div className="flex-1 min-w-[180px]">
              <label className="label">Name</label>
              <input name="name" className="input" placeholder="Building A" required />
            </div>
            <div className="w-36">
              <label className="label">Slug</label>
              <input name="slug" className="input" placeholder="building-a" required />
            </div>
            <div className="w-52">
              <label className="label">Project</label>
              <select name="projectId" className="select" required>
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.company.name})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="label">Description</label>
              <input name="description" className="input" placeholder="Optional" />
            </div>
            <button type="submit" className="btn-primary">Add</button>
          </Form>
        </div>
      </div>

      {buildings.length === 0 ? (
        <EmptyState title="No buildings" description="Create your first building above." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 font-medium text-gray-500">Project</th>
                <th className="px-6 py-3 font-medium text-gray-500">Floors</th>
                <th className="px-6 py-3 font-medium text-gray-500">SVG</th>
                <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">
                    <Link to={`/admin/buildings/${b.id}`} className="text-brand-600 hover:text-brand-700">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {b.project.name} <span className="text-gray-400">({b.project.company.name})</span>
                  </td>
                  <td className="px-6 py-3">{b._count.floors}</td>
                  <td className="px-6 py-3">
                    {b.svgContent ? (
                      <span className="badge badge-available">✓</span>
                    ) : (
                      <span className="badge badge-unavailable">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Link to={`/admin/buildings/${b.id}`} className="text-brand-600 hover:text-brand-700 text-sm">
                        Edit
                      </Link>
                      <Form method="post" onSubmit={(e) => { if (!confirm("Delete this building?")) e.preventDefault(); }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm">Delete</button>
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
