import { useState } from "react";

interface FilterBarProps {
  minRooms?: number;
  maxRooms?: number;
  maxPrice?: number;
  onFilterChange: (filters: FilterValues) => void;
}

export interface FilterValues {
  rooms: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  status: string[];
}

export function FilterBar({ minRooms = 1, maxRooms = 5, maxPrice = 500000, onFilterChange }: FilterBarProps) {
  const [rooms, setRooms] = useState<number | null>(null);
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<string[]>(["AVAILABLE", "RESERVED", "SOLD"]);

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
    setRooms(null);
    setPriceMin(null);
    setPriceMax(null);
    setStatuses(["AVAILABLE", "RESERVED", "SOLD"]);
    onFilterChange({ rooms: null, minPrice: null, maxPrice: null, status: ["AVAILABLE", "RESERVED", "SOLD"] });
  };

  const statusOptions = [
    { value: "AVAILABLE", label: "Available", color: "bg-green-400" },
    { value: "RESERVED", label: "Reserved", color: "bg-yellow-400" },
    { value: "SOLD", label: "Sold", color: "bg-red-400" },
  ];

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex flex-wrap items-end gap-4">
          {/* Rooms filter */}
          <div className="min-w-[120px]">
            <label className="label">Rooms</label>
            <select
              className="select"
              value={rooms ?? ""}
              onChange={(e) => handleRoomsChange(e.target.value)}
            >
              <option value="">All</option>
              {Array.from({ length: (maxRooms - minRooms) * 2 + 1 }, (_, i) => minRooms + i * 0.5)
                .filter((v) => v <= maxRooms)
                .map((v) => (
                  <option key={v} value={v}>
                    {v} {v === 1 ? "room" : "rooms"}
                  </option>
                ))}
            </select>
          </div>

          {/* Price range */}
          <div className="min-w-[130px]">
            <label className="label">Min Price (€)</label>
            <input
              type="number"
              className="input"
              placeholder="0"
              value={priceMin ?? ""}
              onChange={(e) => handlePriceMinChange(e.target.value)}
            />
          </div>
          <div className="min-w-[130px]">
            <label className="label">Max Price (€)</label>
            <input
              type="number"
              className="input"
              placeholder="Any"
              value={priceMax ?? ""}
              onChange={(e) => handlePriceMaxChange(e.target.value)}
            />
          </div>

          {/* Status toggles */}
          <div>
            <label className="label">Status</label>
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

          {/* Clear */}
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  );
}
