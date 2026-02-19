import { useState, useMemo } from "react";

interface ApartmentData {
  id: string;
  number: string;
  rooms: number;
  area: number;
  price: number | null;
  pricePerSqm: number | null;
  status: string;
  floorNumber: number;
  buildingName: string;
}

interface ApartmentListViewProps {
  apartments: ApartmentData[];
  onApartmentClick?: (apartment: ApartmentData) => void;
  currencySymbol?: string;
  areaUnit?: string;
  className?: string;
}

type ViewMode = "grid" | "table";
type SortField = "number" | "rooms" | "area" | "price" | "floor" | "status";
type SortDir = "asc" | "desc";

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  AVAILABLE: { label: "Available", color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500" },
  RESERVED: { label: "Reserved", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  SOLD: { label: "Sold", color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500" },
  UNAVAILABLE: { label: "Unavailable", color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400" },
};

export function ApartmentListView({
  apartments,
  onApartmentClick,
  currencySymbol = "€",
  areaUnit = "m²",
  className = "",
}: ApartmentListViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterStatus, setFilterStatus] = useState<string[]>(["AVAILABLE", "RESERVED", "SOLD", "UNAVAILABLE"]);
  const [filterRooms, setFilterRooms] = useState<number | null>(null);
  const [filterMinPrice, setFilterMinPrice] = useState<number | null>(null);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | null>(null);
  const [filterFloor, setFilterFloor] = useState<number | null>(null);

  // Compute unique values for filter options
  const roomOptions = useMemo(
    () => [...new Set(apartments.map((a) => a.rooms))].sort((a, b) => a - b),
    [apartments]
  );
  const floorOptions = useMemo(
    () => [...new Set(apartments.map((a) => a.floorNumber))].sort((a, b) => a - b),
    [apartments]
  );

  // Filter & sort
  const filtered = useMemo(() => {
    let result = apartments.filter((a) => {
      if (!filterStatus.includes(a.status)) return false;
      if (filterRooms !== null && a.rooms !== filterRooms) return false;
      if (filterFloor !== null && a.floorNumber !== filterFloor) return false;
      if (filterMinPrice !== null && (a.price === null || a.price < filterMinPrice)) return false;
      if (filterMaxPrice !== null && (a.price === null || a.price > filterMaxPrice)) return false;
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "number":
          cmp = a.number.localeCompare(b.number, undefined, { numeric: true });
          break;
        case "rooms":
          cmp = a.rooms - b.rooms;
          break;
        case "area":
          cmp = a.area - b.area;
          break;
        case "price":
          cmp = (a.price || 0) - (b.price || 0);
          break;
        case "floor":
          cmp = a.floorNumber - b.floorNumber;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [apartments, filterStatus, filterRooms, filterFloor, filterMinPrice, filterMaxPrice, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleStatus = (status: string) => {
    setFilterStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setFilterStatus(["AVAILABLE", "RESERVED", "SOLD", "UNAVAILABLE"]);
    setFilterRooms(null);
    setFilterFloor(null);
    setFilterMinPrice(null);
    setFilterMaxPrice(null);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-brand-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">
            {filtered.length} of {apartments.length} apartments
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-white shadow text-brand-700" : "text-gray-500"
              }`}
              title="Grid view"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "table" ? "bg-white shadow text-brand-700" : "text-gray-500"
              }`}
              title="Table view"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
          <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700">
            Clear filters
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        {/* Status filter */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Status</label>
          <div className="flex gap-1.5">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => toggleStatus(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterStatus.includes(key)
                    ? `${cfg.bg} ${cfg.color}`
                    : "bg-gray-50 text-gray-400 border-gray-200"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${filterStatus.includes(key) ? cfg.dot : "bg-gray-300"}`} />
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rooms */}
        <div className="min-w-[100px]">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Rooms</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            value={filterRooms ?? ""}
            onChange={(e) => setFilterRooms(e.target.value ? parseFloat(e.target.value) : null)}
          >
            <option value="">All</option>
            {roomOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Floor */}
        <div className="min-w-[90px]">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Floor</label>
          <select
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            value={filterFloor ?? ""}
            onChange={(e) => setFilterFloor(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">All</option>
            {floorOptions.map((f) => (
              <option key={f} value={f}>Floor {f}</option>
            ))}
          </select>
        </div>

        {/* Price range */}
        <div className="min-w-[100px]">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Min Price</label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            placeholder={`${currencySymbol}0`}
            value={filterMinPrice ?? ""}
            onChange={(e) => setFilterMinPrice(e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="min-w-[100px]">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Max Price</label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
            placeholder={`${currencySymbol}∞`}
            value={filterMaxPrice ?? ""}
            onChange={(e) => setFilterMaxPrice(e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm">No apartments match your filters</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((apt) => {
            const sc = statusConfig[apt.status] || statusConfig.UNAVAILABLE;
            return (
              <button
                key={apt.id}
                onClick={() => onApartmentClick?.(apt)}
                className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-brand-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 group-hover:text-brand-700 transition-colors">
                      Apt {apt.number}
                    </p>
                    <p className="text-xs text-gray-400">
                      {apt.buildingName} · Floor {apt.floorNumber}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg py-1.5">
                    <p className="text-xs text-gray-500">Rooms</p>
                    <p className="text-sm font-semibold">{apt.rooms}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-1.5">
                    <p className="text-xs text-gray-500">Area</p>
                    <p className="text-sm font-semibold">{apt.area}{areaUnit}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-1.5">
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="text-sm font-semibold">
                      {apt.price ? `${currencySymbol}${(apt.price / 1000).toFixed(0)}k` : "—"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-left">
                    <button onClick={() => handleSort("number")} className="font-medium text-gray-500 hover:text-gray-700 flex items-center">
                      Number <SortIcon field="number" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <button onClick={() => handleSort("floor")} className="font-medium text-gray-500 hover:text-gray-700 flex items-center">
                      Floor <SortIcon field="floor" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <button onClick={() => handleSort("rooms")} className="font-medium text-gray-500 hover:text-gray-700 flex items-center">
                      Rooms <SortIcon field="rooms" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <button onClick={() => handleSort("area")} className="font-medium text-gray-500 hover:text-gray-700 flex items-center">
                      Area <SortIcon field="area" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <button onClick={() => handleSort("price")} className="font-medium text-gray-500 hover:text-gray-700 flex items-center">
                      Price <SortIcon field="price" />
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left">
                    <button onClick={() => handleSort("status")} className="font-medium text-gray-500 hover:text-gray-700 flex items-center">
                      Status <SortIcon field="status" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((apt) => {
                  const sc = statusConfig[apt.status] || statusConfig.UNAVAILABLE;
                  return (
                    <tr
                      key={apt.id}
                      onClick={() => onApartmentClick?.(apt)}
                      className="border-b border-gray-50 hover:bg-brand-50/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900">Apt {apt.number}</td>
                      <td className="px-4 py-2.5 text-gray-500">{apt.floorNumber}</td>
                      <td className="px-4 py-2.5">{apt.rooms}</td>
                      <td className="px-4 py-2.5">{apt.area} {areaUnit}</td>
                      <td className="px-4 py-2.5 font-medium">
                        {apt.price ? `${currencySymbol}${apt.price.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
