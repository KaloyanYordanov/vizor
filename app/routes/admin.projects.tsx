import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import { PageHeader, EmptyState } from "~/components/ui";

export const meta: MetaFunction = () => [{ title: "Projects | Vizor Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const where = user.role === "SUPER_ADMIN" ? {} : { companyId: user.companyId! };

  const [projects, companies] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        company: { select: { name: true, slug: true } },
        _count: { select: { buildings: true } },
      },
      orderBy: { name: "asc" },
    }),
    user.role === "SUPER_ADMIN"
      ? prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : prisma.company.findMany({ where: { id: user.companyId! }, select: { id: true, name: true } }),
  ]);

  return json({ projects, companies, userRole: user.role });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const name = form.get("name") as string;
    const slug = form.get("slug") as string;
    const description = (form.get("description") as string) || null;
    const address = (form.get("address") as string) || null;
    const companyId = form.get("companyId") as string;

    if (!name || !slug || !companyId) {
      return json({ error: "Name, slug, and company are required" }, { status: 400 });
    }

    // Tenant check
    if (user.role !== "SUPER_ADMIN" && companyId !== user.companyId) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.project.findFirst({ where: { companyId, slug } });
    if (existing) {
      return json({ error: "A project with this slug already exists for this company" }, { status: 400 });
    }

    await prisma.project.create({ data: { name, slug, description, address, companyId } });
    return json({ success: true });
  }

  if (intent === "delete") {
    const id = form.get("id") as string;
    const project = await prisma.project.findUniqueOrThrow({ where: { id } });
    if (user.role !== "SUPER_ADMIN" && project.companyId !== user.companyId) {
      return json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.project.delete({ where: { id } });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function ProjectsPage() {
  const { projects, companies, userRole } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Manage development projects" />

      {/* Create form */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold">Add Project</h2>
        </div>
        <div className="card-body">
          {actionData?.error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{actionData.error}</div>
          )}
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="create" />
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Name</label>
                <input name="name" className="input" placeholder="Sunrise Residences" required />
              </div>
              <div className="w-40">
                <label className="label">Slug</label>
                <input name="slug" className="input" placeholder="sunrise" required />
              </div>
              <div className="w-48">
                <label className="label">Company</label>
                <select name="companyId" className="select" required>
                  <option value="">Select...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Description</label>
                <input name="description" className="input" placeholder="Optional description" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="label">Address</label>
                <input name="address" className="input" placeholder="123 Main St" />
              </div>
            </div>
            <button type="submit" className="btn-primary">Add Project</button>
          </Form>
        </div>
      </div>

      {/* List */}
      {projects.length === 0 ? (
        <EmptyState title="No projects" description="Create your first project above." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 font-medium text-gray-500">Company</th>
                <th className="px-6 py-3 font-medium text-gray-500">Buildings</th>
                <th className="px-6 py-3 font-medium text-gray-500">Address</th>
                <th className="px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">
                    <Link to={`/admin/projects/${project.id}`} className="text-brand-600 hover:text-brand-700">
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-500">{project.company.name}</td>
                  <td className="px-6 py-3">{project._count.buildings}</td>
                  <td className="px-6 py-3 text-gray-500">{project.address || "—"}</td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Link to={`/admin/projects/${project.id}`} className="text-brand-600 hover:text-brand-700 text-sm">
                        Edit
                      </Link>
                      <Link to={`/view/${project.company.slug}/${project.slug}`} className="text-green-600 hover:text-green-700 text-sm" target="_blank">
                        Preview
                      </Link>
                      <Form method="post" onSubmit={(e) => { if (!confirm("Delete this project?")) e.preventDefault(); }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={project.id} />
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
