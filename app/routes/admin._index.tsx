import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import { StatCard, PageHeader } from "~/components/ui";
import { useTranslation } from "react-i18next";

export const meta: MetaFunction = () => [{ title: "Dashboard | Vizor Admin" }];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  const where = user.role === "SUPER_ADMIN" ? {} : { companyId: user.companyId! };

  const [companiesCount, projectsCount, buildingsCount, apartmentsCount, apartmentsByStatus] = await Promise.all([
    user.role === "SUPER_ADMIN" ? prisma.company.count() : Promise.resolve(1),
    prisma.project.count({ where }),
    prisma.building.count({
      where: { project: where },
    }),
    prisma.apartment.count({
      where: { floor: { building: { project: where } } },
    }),
    prisma.apartment.groupBy({
      by: ["status"],
      _count: true,
      where: { floor: { building: { project: where } } },
    }),
  ]);

  const statusCounts = {
    AVAILABLE: 0,
    RESERVED: 0,
    SOLD: 0,
    UNAVAILABLE: 0,
    ...Object.fromEntries(apartmentsByStatus.map((s) => [s.status, s._count])),
  };

  const recentApartments = await prisma.apartment.findMany({
    where: { floor: { building: { project: where } } },
    include: {
      floor: { include: { building: { include: { project: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return json({
    user,
    stats: { companiesCount, projectsCount, buildingsCount, apartmentsCount, statusCounts },
    recentApartments,
  });
}

export default function AdminDashboard() {
  const { user, stats, recentApartments } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("dashboard.welcome", { name: user.name })}
        description={t("dashboard.overview")}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {user.role === "SUPER_ADMIN" && (
          <StatCard label={t("admin.companies")} value={stats.companiesCount} color="brand" />
        )}
        <StatCard label={t("admin.projects")} value={stats.projectsCount} color="brand" />
        <StatCard label={t("admin.buildings")} value={stats.buildingsCount} color="brand" />
        <StatCard label={t("dashboard.totalApartments")} value={stats.apartmentsCount} color="brand" />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("status.available")} value={stats.statusCounts.AVAILABLE} color="green" />
        <StatCard label={t("status.reserved")} value={stats.statusCounts.RESERVED} color="yellow" />
        <StatCard label={t("status.sold")} value={stats.statusCounts.SOLD} color="red" />
        <StatCard label={t("status.unavailable")} value={stats.statusCounts.UNAVAILABLE} color="gray" />
      </div>

      {/* Recent apartments */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dashboard.recentlyUpdated")}</h2>
          <Link to="/admin/buildings" className="text-sm text-brand-600 hover:text-brand-700">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-6 py-3 font-medium text-gray-500">{t("apartment.apartment")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("building.building")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("apartment.rooms")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("apartment.area")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("apartment.price")}</th>
                <th className="px-6 py-3 font-medium text-gray-500">{t("status.status")}</th>
              </tr>
            </thead>
            <tbody>
              {recentApartments.map((apt) => (
                <tr key={apt.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{apt.number}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {apt.floor.building.name} — {apt.floor.building.project.name}
                  </td>
                  <td className="px-6 py-3">{apt.rooms}</td>
                  <td className="px-6 py-3">{apt.area}m²</td>
                  <td className="px-6 py-3">
                    {apt.price ? `€${apt.price.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge badge-${apt.status.toLowerCase()}`}>
                      {apt.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
