import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { useState, useMemo, useCallback, useEffect } from "react";
import { BuildingFloorSelector } from "~/components/BuildingFloorSelector";
import { InteractiveFloorPlan } from "~/components/InteractiveFloorPlan";
import { ApartmentModal } from "~/components/ApartmentModal";
import { ApartmentListView } from "~/components/ApartmentListView";
import { FilterBar, type FilterValues } from "~/components/FilterBar";
import { DEFAULT_VIEWER_COLORS } from "~/utils/colors";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `${data.project.name} | Vizor` : "Project | Vizor" },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { companySlug, projectSlug } = params;

  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      company: { slug: companySlug },
    },
    include: {
      company: { select: { name: true, slug: true, logo: true } },
      buildings: {
        include: {
          floors: {
            include: {
              apartments: { orderBy: { number: "asc" } },
            },
            orderBy: { number: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!project) throw new Response("Project not found", { status: 404 });

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  return json({ project, baseUrl });
}

type ViewTab = "interactive" | "list";

export default function ProjectViewer() {
  const { project, baseUrl } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBuildingIdx, setSelectedBuildingIdx] = useState(0);
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number | null>(null);
  const [selectedApartment, setSelectedApartment] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("interactive");
  const [filters, setFilters] = useState<FilterValues>({
    rooms: null,
    minPrice: null,
    maxPrice: null,
    status: ["AVAILABLE", "RESERVED", "SOLD"],
  });

  const building = project.buildings[selectedBuildingIdx];
  const selectedFloor = building?.floors.find((f) => f.number === selectedFloorNumber) ?? null;

  // Handle shareable apartment link via URL params
  useEffect(() => {
    const aptId = searchParams.get("apt");
    if (aptId) {
      for (const b of project.buildings) {
        for (const f of b.floors) {
          const apt = f.apartments.find((a: any) => a.id === aptId);
          if (apt) {
            setSelectedBuildingIdx(project.buildings.indexOf(b));
            setSelectedFloorNumber(f.number);
            setSelectedApartment(apt);
            setShowModal(true);
            return;
          }
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters to apartments
  const filteredApartments = useMemo(() => {
    if (!selectedFloor) return [];
    return selectedFloor.apartments.filter((apt) => {
      if (filters.rooms !== null && apt.rooms !== filters.rooms) return false;
      if (filters.minPrice !== null && (apt.price === null || apt.price < filters.minPrice)) return false;
      if (filters.maxPrice !== null && (apt.price === null || apt.price > filters.maxPrice)) return false;
      return true;
    });
  }, [selectedFloor, filters]);

  const filterStatusArr = filters.status;

  const handleFloorClick = useCallback((floorNumber: number) => {
    setSelectedFloorNumber(floorNumber);
    setSelectedApartment(null);
    setShowModal(false);
  }, []);

  const handleApartmentClick = useCallback((apartment: any) => {
    setSelectedApartment(apartment);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("apt");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // All apartments for list view
  const allApartments = useMemo(
    () =>
      (building?.floors ?? []).flatMap((f) =>
        f.apartments.map((a: any) => ({
          ...a,
          floorNumber: f.number,
          buildingName: building?.name ?? "",
        }))
      ),
    [building]
  );

  const roomValues = allApartments.map((a: any) => a.rooms);
  const minRooms = Math.min(...roomValues, 1);
  const maxRooms = Math.max(...roomValues, 5);

  // Shareable apartment URL
  const getShareUrl = (aptId: string) =>
    `${baseUrl}/view/${project.company.slug}/${project.slug}?apt=${aptId}`;

  // Project color settings
  const currencySymbol = project.currencySymbol ?? "€";
  const areaUnit = project.areaUnit ?? "m²";

  const viewerColors = {
    available: project.availableColor ?? DEFAULT_VIEWER_COLORS.available,
    reserved: project.reservedColor ?? DEFAULT_VIEWER_COLORS.reserved,
    sold: project.soldColor ?? DEFAULT_VIEWER_COLORS.sold,
    unavailable: project.unavailableColor ?? DEFAULT_VIEWER_COLORS.unavailable,
    stroke: project.strokeColor ?? DEFAULT_VIEWER_COLORS.stroke,
    strokeWidth: project.strokeWidth ?? DEFAULT_VIEWER_COLORS.strokeWidth,
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
            </Link>
            <div className="border-l border-gray-200 pl-3">
              <h1 className="text-lg font-bold text-gray-900">{project.name}</h1>
              <p className="text-xs text-gray-500">
                {project.company.name}
                {project.address && ` · ${project.address}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View mode tabs */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewTab("interactive")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewTab === "interactive"
                    ? "bg-white shadow text-brand-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Floor Plans
              </button>
              <button
                onClick={() => setViewTab("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewTab === "list"
                    ? "bg-white shadow text-brand-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                All Apartments
              </button>
            </div>

            {/* Building selector */}
            {project.buildings.length > 1 && (
              <div className="flex gap-2">
                {project.buildings.map((b, idx) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBuildingIdx(idx);
                      setSelectedFloorNumber(null);
                      setSelectedApartment(null);
                      setShowModal(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      idx === selectedBuildingIdx
                        ? "bg-brand-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* List view */}
      {viewTab === "list" ? (
        <div className="mx-auto max-w-7xl px-4 py-6">
          <ApartmentListView
            apartments={allApartments}
            onApartmentClick={handleApartmentClick}
            currencySymbol={project.currencySymbol}
            areaUnit={project.areaUnit}
          />
        </div>
      ) : (
        /* Interactive view */
        <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
          {project.description && (
            <p className="text-sm text-gray-600">{project.description}</p>
          )}

          {/* Filter bar */}
          <FilterBar
            minRooms={minRooms}
            maxRooms={maxRooms}
            onFilterChange={setFilters}
          />

          {/* Main layout */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Floor plan column */}
            <div className="lg:col-span-7 space-y-4">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => {
                    setSelectedFloorNumber(null);
                    setSelectedApartment(null);
                    setShowModal(false);
                  }}
                  className={`font-medium ${
                    !selectedFloorNumber
                      ? "text-brand-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {building?.name || "Building"}
                </button>
                {selectedFloorNumber && (
                  <>
                    <span className="text-gray-300">›</span>
                    <span className="font-medium text-brand-600">
                      Floor {selectedFloorNumber}
                      {selectedFloor?.label && ` (${selectedFloor.label})`}
                    </span>
                  </>
                )}
              </div>

              {/* Floor plan area */}
              <div className="card p-0 overflow-hidden">
                {!selectedFloorNumber && building?.imageUrl && building?.floorsPolygonData ? (
                  <div className="p-4">
                    <BuildingFloorSelector
                      imageUrl={building.imageUrl}
                      polygons={building.floorsPolygonData as any[]}
                      floors={building.floors}
                      onFloorClick={handleFloorClick}
                      colors={viewerColors}
                    />
                  </div>
                ) : selectedFloor ? (
                  <InteractiveFloorPlan
                    imageUrl={selectedFloor.imageUrl}
                    svgContent={selectedFloor.svgContent}
                    apartments={selectedFloor.apartments.map((a: any) => ({
                      ...a,
                      polygonData: a.polygonData as Array<{ x: number; y: number }> | null,
                    }))}
                    onApartmentClick={handleApartmentClick}
                    selectedApartmentId={selectedApartment?.id}
                    filterStatus={filterStatusArr}
                    colors={viewerColors}
                    tooltipStyle={(project.tooltipStyle as "modern" | "minimal" | "detailed") ?? "modern"}
                    currencySymbol={currencySymbol}
                    areaUnit={areaUnit}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-400 p-4">
                    <p>
                      {!selectedFloorNumber
                        ? "No building visualization available. Select a floor below."
                        : "No floor plan available for this floor."}
                    </p>
                  </div>
                )}
              </div>

              {/* Floor selector */}
              {!selectedFloorNumber && building && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold">Select a Floor</h3>
                  </div>
                  <div className="card-body">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {building.floors
                        .slice()
                        .sort((a, b) => b.number - a.number)
                        .map((floor) => {
                          const available = floor.apartments.filter((a) => a.status === "AVAILABLE").length;
                          const hasMap = floor.imageUrl || floor.svgContent;
                          return (
                            <button
                              key={floor.id}
                              onClick={() => handleFloorClick(floor.number)}
                              className="rounded-lg border border-gray-200 p-3 text-center hover:border-brand-300 hover:bg-brand-50 transition-colors"
                            >
                              <p className="text-sm font-semibold">Floor {floor.number}</p>
                              {floor.label && (
                                <p className="text-xs text-gray-400">{floor.label}</p>
                              )}
                              <p className="text-xs text-green-600 mt-1">
                                {available}/{floor.apartments.length} available
                              </p>
                              {hasMap && (
                                <span className="inline-block mt-1 text-[10px] text-brand-600 bg-brand-50 rounded px-1.5 py-0.5">
                                  Interactive
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Side panel */}
            <div className="lg:col-span-5 space-y-4">
              {selectedFloor ? (
                /* Apartments list for selected floor */
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold">
                      Apartments on Floor {selectedFloor.number}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {filteredApartments.length} of {selectedFloor.apartments.length} shown
                    </p>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                    {filteredApartments.map((apt) => {
                      const isVisible = filterStatusArr.includes(apt.status);
                      return (
                        <button
                          key={apt.id}
                          onClick={() => isVisible && handleApartmentClick(apt)}
                          disabled={!isVisible}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                            !isVisible ? "opacity-40" : ""
                          } ${
                            selectedApartment?.id === apt.id ? "bg-brand-50" : ""
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium">Apt {apt.number}</p>
                            <p className="text-xs text-gray-500">
                              {apt.rooms} rooms · {apt.area}{areaUnit}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {apt.price ? `${currencySymbol}${apt.price.toLocaleString()}` : "—"}
                            </p>
                            <span className={`badge badge-${apt.status.toLowerCase()} text-[10px]`}>
                              {apt.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {filteredApartments.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-gray-400">
                        No apartments match your filters
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* Project / Building summary */
                <div className="card">
                  <div className="card-body space-y-4">
                    <h3 className="font-bold text-lg">{building?.name}</h3>
                    {building?.description && (
                      <p className="text-sm text-gray-600">{building.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-brand-600">{building?.floors.length}</p>
                        <p className="text-xs text-gray-500">Floors</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-brand-600">{allApartments.length}</p>
                        <p className="text-xs text-gray-500">Apartments</p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {allApartments.filter((a: any) => a.status === "AVAILABLE").length}
                        </p>
                        <p className="text-xs text-gray-500">Available</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-gray-600">
                          {allApartments.length > 0 && allApartments.some((a: any) => a.price)
                            ? `${currencySymbol}${Math.min(
                                ...allApartments.filter((a: any) => a.price).map((a: any) => a.price!)
                              ).toLocaleString()}`
                            : "—"}
                        </p>
                        <p className="text-xs text-gray-500">Starting from</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="card">
                <div className="card-body">
                  <p className="text-xs font-medium text-gray-500 mb-2">Legend</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { status: "Available", color: project.availableColor },
                      { status: "Reserved", color: project.reservedColor },
                      { status: "Sold", color: project.soldColor },
                      { status: "Unavailable", color: project.unavailableColor },
                    ].map((item) => (
                      <div key={item.status} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.status}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apartment detail modal */}
      {showModal && selectedApartment && (
        <ApartmentModal
          apartment={selectedApartment}
          currencySymbol={project.currencySymbol}
          areaUnit={project.areaUnit}
          shareUrl={getShareUrl(selectedApartment.id)}
          showRequestForm={true}
          onClose={handleCloseModal}
          onRequestSubmit={(data) => {
            console.log("Request submitted:", data);
            alert("Thank you! Your request has been submitted.");
            handleCloseModal();
          }}
        />
      )}
    </div>
  );
}
