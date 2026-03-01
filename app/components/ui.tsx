import type { ApartmentStatus } from "@prisma/client";
import { useTranslation } from "react-i18next";

export function StatusBadge({ status }: { status: ApartmentStatus }) {
  const { t } = useTranslation();
  const cls = {
    AVAILABLE: "badge-available",
    RESERVED: "badge-reserved",
    SOLD: "badge-sold",
    UNAVAILABLE: "badge-unavailable",
  }[status];

  const statusLabels: Record<string, string> = {
    AVAILABLE: t("status.available"),
    RESERVED: t("status.reserved"),
    SOLD: t("status.sold"),
    UNAVAILABLE: t("status.unavailable"),
  };

  return (
    <span className={`badge ${cls}`}>
      {statusLabels[status] || status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function StatCard({
  label,
  value,
  color = "brand",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  const bgMap: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-50 text-gray-700",
  };

  return (
    <div className="card">
      <div className="card-body">
        <p className="text-sm text-gray-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${bgMap[color] || bgMap.brand} inline-block px-2 py-1 rounded-lg`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  action,
  actionLabel,
}: {
  title: string;
  message: string;
  action: string;
  actionLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h3 className="text-sm font-medium text-red-800">{title}</h3>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <form method="post" action={action} className="mt-3">
        <input type="hidden" name="intent" value="delete" />
        <button type="submit" className="btn-danger btn-sm">
          {actionLabel || t("common.delete")}
        </button>
      </form>
    </div>
  );
}
