import { useState } from "react";
import { useTranslation } from "react-i18next";

interface FilterBarProps {
  minRooms?: number;
  maxRooms?: number;
  maxPrice?: number;
  currencySymbol?: string;
  onFilterChange: (filters: FilterValues) => void;
  showRoomFilter?: boolean;
  showPriceFilter?: boolean;
  showStatusFilter?: boolean;
  /** Pre-select initial filter values from embed config */
  initialRooms?: number | null;
  initialMinPrice?: number | null;
  initialMaxPrice?: number | null;
  initialStatuses?: string[];
}

export interface FilterValues {
  rooms: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  status: string[];
}

export function FilterBar({ minRooms = 1, maxRooms = 5, maxPrice = 500000, currencySymbol = "€", onFilterChange, showRoomFilter = true, showPriceFilter = true, showStatusFilter = true, initialRooms = null, initialMinPrice = null, initialMaxPrice = null, initialStatuses }: FilterBarProps) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<number | null>(initialRooms ?? null);
  const [priceMin, setPriceMin] = useState<number | null>(initialMinPrice ?? null);
  const [priceMax, setPriceMax] = useState<number | null>(initialMaxPrice ?? null);
  const [statuses, setStatuses] = useState<string[]>(initialStatuses ?? ["AVAILABLE", "RESERVED", "SOLD"]);

  const handleStatusToggle = (status: string) => {
    const updated = statuses.includes(status)
      ? statuses.filter((s) => s !== status)
      : [...statuses, status];
    setStatuses(updated);
    onFilterChange({ rooms, minPrice: priceMin, maxPrice: priceMax, status: updated });
  };

  const handleRoomsChange = (value: string) => {
    const v = value === "" ? null : parseFloat(value);
    setRooms(v);
    onFilterChange({ rooms: v, minPrice: priceMin, maxPrice: priceMax, status: statuses });
  };

  const handlePriceMinChange = (value: string) => {
    const v = value === "" ? null : parseInt(value);
    setPriceMin(v);
    onFilterChange({ rooms, minPrice: v, maxPrice: priceMax, status: statuses });
  };

  const handlePriceMaxChange = (value: string) => {
    const v = value === "" ? null : parseInt(value);
    setPriceMax(v);
    onFilterChange({ rooms, minPrice: priceMin, maxPrice: v, status: statuses });
  };

  const clearFilters = () => {
    const defStatuses = initialStatuses ?? ["AVAILABLE", "RESERVED", "SOLD"];
    setRooms(initialRooms ?? null);
    setPriceMin(initialMinPrice ?? null);
    setPriceMax(initialMaxPrice ?? null);
    setStatuses(defStatuses);
    onFilterChange({ rooms: initialRooms ?? null, minPrice: initialMinPrice ?? null, maxPrice: initialMaxPrice ?? null, status: defStatuses });
  };

  const statusOptions = [
    { value: "AVAILABLE", label: t("status.available"), color: "bg-green-400" },
    { value: "RESERVED", label: t("status.reserved"), color: "bg-yellow-400" },
    { value: "SOLD", label: t("status.sold"), color: "bg-red-400" },
  ];

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex flex-wrap items-end gap-4">
          {/* Rooms filter */}
          {showRoomFilter && (
          <div className="min-w-[120px]">
            <label className="label">{t("filter.rooms")}</label>
            <select
              className="select"
              value={rooms ?? ""}
              onChange={(e) => handleRoomsChange(e.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {Array.from({ length: (maxRooms - minRooms) * 2 + 1 }, (_, i) => minRooms + i * 0.5)
                .filter((v) => v <= maxRooms)
                .map((v) => (
                  <option key={v} value={v}>
                    {v} {v === 1 ? t("apartment.room") : t("apartment.roomsPlural")}
                  </option>
                ))}
            </select>
          </div>
          )}

          {/* Price range */}
          {showPriceFilter && (
          <>
          <div className="min-w-[130px]">
            <label className="label">{t("filter.minPriceCurrency", { currency: currencySymbol })}</label>
            <input
              type="number"
              className="input"
              placeholder="0"
              value={priceMin ?? ""}
              onChange={(e) => handlePriceMinChange(e.target.value)}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="label">{t("filter.maxPriceCurrency", { currency: currencySymbol })}</label>
            <input
              type="number"
              className="input"
              placeholder={t("filter.any")}
              value={priceMax ?? ""}
              onChange={(e) => handlePriceMaxChange(e.target.value)}
            />
          </div>
          </>
          )}

          {/* Status toggles */}
          {showStatusFilter && (
          <div>
            <label className="label">{t("status.status")}</label>
            <div className="flex gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusToggle(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    statuses.includes(opt.value)
                      ? "border-gray-300 bg-white text-gray-900 shadow-sm"
                      : "border-transparent bg-gray-100 text-gray-400"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Clear */}
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {t("filter.clearFilters")}
          </button>
        </div>
      </div>
    </div>
  );
}
