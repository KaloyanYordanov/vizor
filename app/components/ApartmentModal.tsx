import { useEffect, useCallback } from "react";
import type { ApartmentStatus } from "@prisma/client";
import { STATUS_UI } from "~/utils/colors";

interface ApartmentModalProps {
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
    floorPlanUrl?: string | null;
  };
  /** Project-level settings */
  currencySymbol?: string;
  areaUnit?: string;
  /** Shareable link for this apartment */
  shareUrl?: string;
  /** Enable callback request form */
  showRequestForm?: boolean;
  onClose: () => void;
  onRequestSubmit?: (data: { name: string; email: string; phone: string; message: string }) => void;
}

const statusConfig = STATUS_UI;

export function ApartmentModal({
  apartment,
  currencySymbol = "€",
  areaUnit = "m²",
  shareUrl,
  showRequestForm = true,
  onClose,
  onRequestSubmit,
}: ApartmentModalProps) {
  const features = apartment.features ? JSON.parse(apartment.features) : {};
  const sc = statusConfig[apartment.status] || statusConfig.UNAVAILABLE;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleCopyLink = useCallback(() => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [shareUrl]);

  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      onRequestSubmit?.({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        phone: fd.get("phone") as string,
        message: fd.get("message") as string,
      });
      e.currentTarget.reset();
    },
    [onRequestSubmit]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b ${sc.border} ${sc.bg}`}>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Apartment {apartment.number}</h2>
            <span className={`inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text} border ${sc.border}`}>
              {sc.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-black/5 transition-colors"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Key metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Rooms"
              value={String(apartment.rooms)}
              icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
            <MetricCard
              label="Area"
              value={`${apartment.area} ${areaUnit}`}
              icon="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
            <MetricCard
              label="Price"
              value={apartment.price ? `${currencySymbol}${apartment.price.toLocaleString()}` : "On request"}
              icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              highlight
            />
            <MetricCard
              label={`Price/${areaUnit}`}
              value={apartment.pricePerSqm ? `${currencySymbol}${apartment.pricePerSqm.toLocaleString()}` : "—"}
              icon="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </div>

          {/* Apartment floor plan image */}
          {apartment.floorPlanUrl && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Floor Plan</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                <img
                  src={apartment.floorPlanUrl}
                  alt={`Floor plan for Apt ${apartment.number}`}
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}

          {/* Description */}
          {apartment.description && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{apartment.description}</p>
            </div>
          )}

          {/* Features */}
          {Object.keys(features).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Features</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(features).map(([key, value]) =>
                  value ? (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 border border-brand-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                    </span>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Share link */}
          {shareUrl && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-xs text-gray-600 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
              >
                Copy Link
              </button>
            </div>
          )}

          {/* Request callback form */}
          {showRequestForm && apartment.status === "AVAILABLE" && onRequestSubmit && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Request Information</h3>
              <form onSubmit={handleFormSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input name="name" placeholder="Your name" required className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                  <input name="email" type="email" placeholder="Email" required className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                </div>
                <input name="phone" type="tel" placeholder="Phone number" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                <textarea name="message" rows={2} placeholder="Message (optional)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
                <button type="submit" className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-700 transition-colors">
                  Send Request
                </button>
              </form>
            </div>
          )}

          {/* Status messages for non-available */}
          {apartment.status === "RESERVED" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl py-3 px-4 text-center">
              <p className="text-sm font-medium text-yellow-800">This apartment is currently reserved</p>
              <p className="text-xs text-yellow-600 mt-0.5">Contact us for availability updates</p>
            </div>
          )}
          {apartment.status === "SOLD" && (
            <div className="bg-red-50 border border-red-200 rounded-xl py-3 px-4 text-center">
              <p className="text-sm font-medium text-red-800">This apartment has been sold</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-brand-200 bg-brand-50" : "border-gray-100 bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <svg
          className={`h-4 w-4 ${highlight ? "text-brand-500" : "text-gray-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-sm font-bold ${highlight ? "text-brand-700" : "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}
