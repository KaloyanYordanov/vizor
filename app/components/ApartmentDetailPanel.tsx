import { StatusBadge } from "./ui";
import type { ApartmentStatus } from "@prisma/client";
import { useTranslation } from "react-i18next";

interface ApartmentDetailProps {
  apartment: {
    id: string;
    number: string;
    rooms: number;
    area: number;
    price: number | null;
    pricePerSqm: number | null;
    status: string;
    description?: string | null;
    features?: string | null;
  };
  onClose?: () => void;
}

export function ApartmentDetailPanel({ apartment, onClose }: ApartmentDetailProps) {
  const { t } = useTranslation();
  const features = apartment.features ? JSON.parse(apartment.features) : {};

  return (
    <div className="card border-brand-200 shadow-lg animate-in">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-bold text-lg">{t("apartment.apartment")} {apartment.number}</h3>
        <div className="flex items-center gap-2">
          <StatusBadge status={apartment.status as ApartmentStatus} />
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="card-body space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <InfoItem label={t("apartment.rooms")} value={String(apartment.rooms)} />
          <InfoItem label={t("apartment.area")} value={`${apartment.area} m²`} />
          <InfoItem
            label={t("apartment.price")}
            value={apartment.price ? `€${apartment.price.toLocaleString()}` : t("apartment.onRequest")}
          />
          <InfoItem
            label={t("apartment.pricePerUnit", { unit: "m²" })}
            value={apartment.pricePerSqm ? `€${apartment.pricePerSqm.toLocaleString()}` : t("apartment.noValue")}
          />
        </div>

        {/* Description */}
        {apartment.description && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">{t("common.description")}</p>
            <p className="text-sm text-gray-700">{apartment.description}</p>
          </div>
        )}

        {/* Features */}
        {Object.keys(features).length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">{t("apartment.features")}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(features).map(([key, value]) =>
                value ? (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                  </span>
                ) : null
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        {apartment.status === "AVAILABLE" && (
          <button className="btn-primary w-full mt-2">
            {t("apartment.requestInfo")}
          </button>
        )}
        {apartment.status === "RESERVED" && (
          <p className="text-center text-sm text-yellow-700 bg-yellow-50 rounded-lg py-2">
            {t("apartment.reservedMessage")}
          </p>
        )}
        {apartment.status === "SOLD" && (
          <p className="text-center text-sm text-red-700 bg-red-50 rounded-lg py-2">
            {t("apartment.soldMessage")}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
