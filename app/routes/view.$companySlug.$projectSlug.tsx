import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, Outlet, useOutlet } from "@remix-run/react";
import { prisma } from "~/lib/db.server";
import { useState, useMemo, useCallback, useEffect } from "react";
import { BuildingFloorSelector } from "~/components/BuildingFloorSelector";
import { InteractiveFloorPlan } from "~/components/InteractiveFloorPlan";
import { ApartmentModal } from "~/components/ApartmentModal";
import { ApartmentListView } from "~/components/ApartmentListView";
import { FilterBar, type FilterValues } from "~/components/FilterBar";
import { DEFAULT_VIEWER_COLORS } from "~/utils/colors";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "~/components/LanguageSwitcher";
import { mergeEmbedConfig, decodeEmbedConfig, type EmbedConfig } from "~/utils/embed-config";
import { supportedLngs } from "~/i18n/config";

// ── Theme CSS injection helpers ──────────────────────────────────────────────

function sanitizeCssColor(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([^)]{1,80}\)$/.test(s)) return s;
  if (/^[a-zA-Z]{2,30}$/.test(s)) return s;
  return "";
}

function sanitizeCssLength(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (/^[\d.]+(%|px|em|rem|vh|vw|vmin|vmax|pt|cm|mm|ch)$/.test(s)) return s;
  if (s === "0" || s === "none") return s;
  return "";
}

function buildThemeCss(theme: EmbedConfig["theme"]): string {
  const lines: string[] = [];
  const p = sanitizeCssColor(theme.primaryColor);
  if (p) {
    lines.push(
      `.btn-primary { background-color: ${p} !important; }`,
      `.btn-primary:hover { background-color: color-mix(in srgb, ${p} 85%, #000) !important; }`,
      `.text-brand-500, .text-brand-600, .text-brand-700 { color: ${p} !important; }`,
      `.bg-brand-600, .bg-brand-700 { background-color: ${p} !important; }`,
      `.bg-brand-50 { background-color: color-mix(in srgb, ${p} 10%, #fff) !important; }`,
      `.border-brand-100, .border-brand-200, .border-brand-300 { border-color: color-mix(in srgb, ${p} 35%, #fff) !important; }`,
      `.focus\\:ring-brand-500:focus { --tw-ring-color: ${p} !important; }`,
      `.focus\\:border-brand-500:focus { border-color: ${p} !important; }`,
    );
  }
  const cardProps: string[] = [];
  const bg = sanitizeCssColor(theme.cardBackgroundColor);
  const brd = sanitizeCssColor(theme.cardBorderColor);
  const br = sanitizeCssLength(theme.borderRadius);
  if (bg)  cardProps.push(`background-color: ${bg}`);
  if (brd) cardProps.push(`border-color: ${brd}`);
  if (br)  cardProps.push(`border-radius: ${br}`);
  if (cardProps.length > 0) lines.push(`.card { ${cardProps.join("; ")} !important; }`);
  return lines.join("\n");
}

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

  // Detect embed mode and build embed config
  const isEmbed = url.searchParams.get("embed") === "1";
  let embedConfig: EmbedConfig | null = null;

  if (isEmbed) {
    // Start with DB-stored config
    const dbConfig = project.embedConfig as Partial<EmbedConfig> | null;
    let overrides: Partial<EmbedConfig> = {};

    // Merge URL-encoded config overrides
    const ec = url.searchParams.get("ec");
    if (ec) {
      overrides = decodeEmbedConfig(ec);
    }

    // Deep merge: defaults → DB config → URL overrides
    embedConfig = mergeEmbedConfig(dbConfig, overrides);
  }

  return json({ project, baseUrl, isEmbed, embedConfig });
}

type ViewTab = "interactive" | "list";

export default function ProjectViewer() {
  const outlet = useOutlet();
  if (outlet) return <>{outlet}</>;

  const { project, baseUrl, isEmbed, embedConfig } = useLoaderData<typeof loader>();
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runtimeEmbedConfig, setRuntimeEmbedConfig] = useState(embedConfig);

  // Shorthand embed config sections
  const ec = runtimeEmbedConfig;
  const ecHeader = ec?.header;
  const ecTheme = ec?.theme;
  const ecFilters = ec?.filters;
  const ecFloorPlan = ec?.floorPlan;
  const ecApt = ec?.apartment;
  const ecNav = ec?.navigation;
  const ecBranding = ec?.branding;
  const ecListView = ec?.listView;

  const [selectedBuildingIdx, setSelectedBuildingIdx] = useState(() => {
    // Check for auto-select from embed config
    if (ecNav?.autoSelectBuilding != null) {
      const idx = project.buildings.findIndex((_, i) => i === ecNav.autoSelectBuilding);
      if (idx >= 0) return idx;
    }
    // Check for ?building= query param to pre-select a building
    const buildingSlug = searchParams.get("building");
    if (buildingSlug) {
      const idx = project.buildings.findIndex((b) => b.slug === buildingSlug);
      if (idx >= 0) return idx;
    }
    return 0;
  });
  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number | null>(() => {
    return ecNav?.autoSelectFloor ?? null;
  });
  const [selectedApartment, setSelectedApartment] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>(() => {
    return (ecNav?.defaultView as ViewTab) ?? "interactive";
  });
  const [filters, setFilters] = useState<FilterValues>({
    rooms: ecFilters?.defaultRooms ?? null,
    minPrice: ecFilters?.defaultMinPrice ?? null,
    maxPrice: ecFilters?.defaultMaxPrice ?? null,
    status: ecFilters?.defaultStatuses ?? ["AVAILABLE", "RESERVED", "SOLD"],
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

  // Emit ready signal to parent when embedded
  useEffect(() => {
    if (!isEmbed) return;
    const vizorId = new URLSearchParams(window.location.search).get("_vizorId") || "";
    window.parent.postMessage({ _vizor: vizorId, type: "vizor:ready" }, "*");
  }, [isEmbed]);

  // Apply the embed locale without relying on the host browser's language.
  useEffect(() => {
    if (!isEmbed || !ec?.locale || !supportedLngs.includes(ec.locale as any) || i18n.language === ec.locale) return;
    void i18n.changeLanguage(ec.locale);
  }, [ec?.locale, i18n, isEmbed]);

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
    // In embed mode with callback click action, send postMessage instead of modal
    if (isEmbed && ecApt?.clickAction === "callback") {
      window.parent.postMessage({
        _vizor: new URLSearchParams(window.location.search).get("_vizorId") || "",
        type: "vizor:apartment-click",
        apartment: {
          id: apartment.id,
          number: apartment.number,
          rooms: apartment.rooms,
          area: apartment.area,
          price: apartment.price,
          status: apartment.status,
        },
      }, "*");
      return;
    }
    setSelectedApartment(apartment);
    if (!isEmbed || ecApt?.clickAction !== "panel") {
      setShowModal(true);
    }
  }, [isEmbed, ecApt?.clickAction]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("apt");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Receive commands from the matching SDK instance in the parent window.
  useEffect(() => {
    if (!isEmbed) return;
    const vizorId = new URLSearchParams(window.location.search).get("_vizorId") || "";

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!data || typeof data.type !== "string" || data._vizor !== vizorId) return;

      if (data.type === "vizor:show-apartment" && typeof data.apartmentId === "string") {
        for (let buildingIdx = 0; buildingIdx < project.buildings.length; buildingIdx += 1) {
          const match = project.buildings[buildingIdx].floors.find((floor) =>
            floor.apartments.some((apartment) => apartment.id === data.apartmentId)
          );
          const apartment = match?.apartments.find((item) => item.id === data.apartmentId);
          if (match && apartment) {
            setSelectedBuildingIdx(buildingIdx);
            setSelectedFloorNumber(match.number);
            setSelectedApartment(apartment);
            setShowModal(ecApt?.clickAction !== "panel");
            break;
          }
        }
      } else if (data.type === "vizor:set-filters" && data.filters && typeof data.filters === "object") {
        setFilters((current) => ({
          rooms: typeof data.filters.rooms === "number" || data.filters.rooms === null ? data.filters.rooms : current.rooms,
          minPrice: typeof data.filters.minPrice === "number" || data.filters.minPrice === null ? data.filters.minPrice : current.minPrice,
          maxPrice: typeof data.filters.maxPrice === "number" || data.filters.maxPrice === null ? data.filters.maxPrice : current.maxPrice,
          status: Array.isArray(data.filters.status) ? data.filters.status.filter((value: unknown) => typeof value === "string") : current.status,
        }));
      } else if (data.type === "vizor:set-view" && (data.view === "interactive" || data.view === "list")) {
        setViewTab(data.view);
      } else if (data.type === "vizor:update-config" && data.config && typeof data.config === "object") {
        setRuntimeEmbedConfig((current) => mergeEmbedConfig(current, data.config));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [ecApt?.clickAction, isEmbed, project.buildings]);

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

  // Embed theme overrides as inline CSS vars
  const embedStyle: React.CSSProperties = isEmbed && ecTheme ? {
    ...(ecTheme.backgroundColor ? { backgroundColor: ecTheme.backgroundColor } : {}),
    ...(ecTheme.textColor ? { color: ecTheme.textColor } : {}),
    ...(ecTheme.fontFamily ? { fontFamily: ecTheme.fontFamily } : {}),
    ...(ecTheme.fontSize ? { fontSize: ecTheme.fontSize } : {}),
  } : {};

  // Build detail link for apartment
  const getDetailLink = (aptId: string) => {
    if (isEmbed && ecApt?.detailLinkPattern) {
      return ecApt.detailLinkPattern.replace("{id}", aptId);
    }
    return `/view/${project.company.slug}/${project.slug}/apartment/${aptId}`;
  };

  // Request form handler (supports webhook in embed mode)
  const handleRequestSubmit = useCallback(async (data: any) => {
    try {
      if (isEmbed && ecApt?.requestFormWebhook) {
        const response = await fetch(ecApt.requestFormWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
      }
      if (isEmbed) {
        const vizorId = new URLSearchParams(window.location.search).get("_vizorId") || "";
        window.parent.postMessage({
          _vizor: vizorId,
          type: "vizor:request-submit",
          formData: data,
        }, "*");
      }
      alert(t("viewer.thankYouRequest"));
      handleCloseModal();
      return true;
    } catch (error) {
      console.error("Request submission failed", error);
      alert(t("viewer.requestFailed"));
      return false;
    }
  }, [isEmbed, ecApt?.requestFormWebhook, t, handleCloseModal]);

  // Whether to show sections
  const showHeader = !isEmbed || ecHeader?.show !== false;
  const showFilters = !isEmbed || ecFilters?.show !== false;
  const showLegend = !isEmbed || ecNav?.showLegend !== false;
  const showBreadcrumbs = !isEmbed || ecNav?.showBreadcrumbs !== false;
  const showBuildingSelector = (!isEmbed || ecNav?.showBuildingSelector !== false) && project.buildings.length > 1;
  const showFloorSelector = !isEmbed || ecNav?.showFloorSelector !== false;
  const showViewTabs = !isEmbed || ecHeader?.showViewTabs !== false;
  const showLangSwitch = !isEmbed || ecHeader?.showLanguageSwitcher !== false;
  const showPoweredBy = isEmbed && ecBranding?.showPoweredBy !== false;

  return (
    <div
      className="min-h-full"
      style={{
        backgroundColor: isEmbed && ecTheme?.backgroundColor ? ecTheme.backgroundColor : undefined,
        ...embedStyle,
      }}
    >
      {/* Custom font */}
      {isEmbed && ecBranding?.customFontUrl && (
        <link rel="stylesheet" href={ecBranding.customFontUrl} />
      )}

      {/* Theme CSS overrides */}
      {isEmbed && ecTheme && (
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss(ecTheme) }} />
      )}

      {/* Custom CSS */}
      {isEmbed && ecBranding?.customCss && (
        <style dangerouslySetInnerHTML={{ __html: ecBranding.customCss }} />
      )}

      {/* Header */}
      {showHeader && (
      <header
        className="border-b border-gray-200"
        style={{
          backgroundColor: isEmbed && ecHeader?.backgroundColor ? ecHeader.backgroundColor : "#ffffff",
          color: isEmbed && ecHeader?.textColor ? ecHeader.textColor : undefined,
        }}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {(!isEmbed || ecHeader?.showLogo !== false) && (
              <Link to="/" className="flex items-center gap-2">
                {ecHeader?.logoUrl ? (
                  <img src={ecHeader.logoUrl} alt="Logo" className="h-8 w-auto" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">V</span>
                  </div>
                )}
              </Link>
            )}
            <div className={(!isEmbed || ecHeader?.showLogo !== false) ? "border-l border-gray-200 pl-3" : ""}>
              {(!isEmbed || ecHeader?.showProjectName !== false) && (
                <h1 className="text-lg font-bold" style={{ color: isEmbed && ecHeader?.textColor ? ecHeader.textColor : "#111827" }}>
                  {project.name}
                </h1>
              )}
              <p className="text-xs" style={{ color: isEmbed && ecTheme?.textSecondaryColor ? ecTheme.textSecondaryColor : "#6b7280" }}>
                {(!isEmbed || ecHeader?.showCompanyName !== false) && project.company.name}
                {(!isEmbed || ecHeader?.showAddress !== false) && project.address && ` · ${project.address}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View mode tabs */}
            {showViewTabs && (
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
                {t("viewer.floorPlans")}
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
                {t("viewer.allApartments")}
              </button>
            </div>
            )}

            {showLangSwitch && <LanguageSwitcher />}

            {/* Building selector */}
            {showBuildingSelector && (
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
      )}

      {/* List view */}
      {viewTab === "list" ? (
        <div className="mx-auto max-w-7xl px-4 py-6">
          <ApartmentListView
            apartments={allApartments}
            onApartmentClick={handleApartmentClick}
            currencySymbol={project.currencySymbol}
            areaUnit={project.areaUnit}
            defaultMode={ecListView?.defaultMode}
            defaultSort={ecListView?.defaultSort}
            defaultSortDir={ecListView?.defaultSortDirection as "asc" | "desc" | undefined}
            pageSize={ecListView?.pageSize}
            showNumber={!isEmbed || ecListView?.showNumber !== false}
            showFloor={!isEmbed || ecListView?.showFloor !== false}
            showRooms={!isEmbed || ecListView?.showRooms !== false}
            showArea={!isEmbed || ecListView?.showArea !== false}
            showPrice={!isEmbed || ecListView?.showPrice !== false}
            showStatus={!isEmbed || ecListView?.showStatus !== false}
          />
        </div>
      ) : (
        /* Interactive view */
        <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
          {project.description && (
            <p className="text-sm" style={{ color: isEmbed && ecTheme?.textSecondaryColor ? ecTheme.textSecondaryColor : "#4b5563" }}>
              {project.description}
            </p>
          )}

          {/* Filter bar */}
          {showFilters && (
          <FilterBar
            minRooms={minRooms}
            maxRooms={maxRooms}
            currencySymbol={currencySymbol}
            onFilterChange={setFilters}
            showRoomFilter={!isEmbed || ecFilters?.showRoomFilter !== false}
            showPriceFilter={!isEmbed || ecFilters?.showPriceFilter !== false}
            showStatusFilter={!isEmbed || ecFilters?.showStatusFilter !== false}
            initialRooms={ecFilters?.defaultRooms ?? null}
            initialMinPrice={ecFilters?.defaultMinPrice ?? null}
            initialMaxPrice={ecFilters?.defaultMaxPrice ?? null}
            initialStatuses={ecFilters?.defaultStatuses}
          />
          )}

          {/* Main layout */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Floor plan column */}
            <div className="lg:col-span-7 space-y-4">
              {/* Breadcrumb */}            {showBreadcrumbs && (              <div className="flex items-center gap-2 text-sm">
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
                  {building?.name || t("building.building")}
                </button>
                {selectedFloorNumber && (
                  <>
                    <span className="text-gray-300">›</span>
                    <span className="font-medium text-brand-600">
                      {t("floor.floorN", { n: selectedFloorNumber })}
                      {selectedFloor?.label && ` (${selectedFloor.label})`}
                    </span>
                  </>
                )}
              </div>
            )}

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
                    tooltipStyle={(isEmbed && ecFloorPlan?.tooltipStyle ? ecFloorPlan.tooltipStyle : (project.tooltipStyle as "modern" | "minimal" | "detailed")) ?? "modern"}
                    tooltipShape={(isEmbed && ecFloorPlan?.tooltipShape ? ecFloorPlan.tooltipShape : (project.tooltipShape as "rounded" | "rectangular")) ?? "rounded"}
                    showZoomControls={!isEmbed || ecFloorPlan?.showZoomControls !== false}
                    initialZoom={ecFloorPlan?.defaultZoom ?? 1}
                    polygonOpacity={ecFloorPlan?.polygonOpacity ?? 0.4}
                    polygonHoverOpacity={ecFloorPlan?.polygonHoverOpacity ?? 0.6}
                    currencySymbol={currencySymbol}
                    areaUnit={areaUnit}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-400 p-4">
                    <p>
                      {!selectedFloorNumber
                        ? t("viewer.noBuildingVisualization")
                        : t("floor.noFloorPlan")}
                    </p>
                  </div>
                )}
              </div>

              {/* Floor selector */}
              {showFloorSelector && !selectedFloorNumber && building && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold">{t("floor.selectFloor")}</h3>
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
                              <p className="text-sm font-semibold">{t("floor.floorN", { n: floor.number })}</p>
                              {floor.label && (
                                <p className="text-xs text-gray-400">{floor.label}</p>
                              )}
                              <p className="text-xs text-green-600 mt-1">
                                {t("floor.nOfTotalAvailable", { n: available, total: floor.apartments.length })}
                              </p>
                              {hasMap && (
                                <span className="inline-block mt-1 text-[10px] text-brand-600 bg-brand-50 rounded px-1.5 py-0.5">
                                  {t("floor.interactive")}
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
                selectedApartment ? (
                  /* Inline apartment detail view */
                  <div className="card">
                    <div className="card-header flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {t("apartment.apartment")} {selectedApartment.number}
                      </h3>
                      <button
                        onClick={() => { setSelectedApartment(null); setShowModal(false); }}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        ← {t("viewer.backToList")}
                      </button>
                    </div>
                    <div className="card-body space-y-4">
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span className={`badge badge-${selectedApartment.status.toLowerCase()} text-xs`}>
                          {t(`status.${selectedApartment.status.toLowerCase()}`)}
                        </span>
                        {(!isEmbed || ecApt?.showPricePerSqm !== false) && selectedApartment.pricePerSqm && (
                          <span className="text-xs text-gray-400">
                            {currencySymbol}{selectedApartment.pricePerSqm.toLocaleString()}/{areaUnit}
                          </span>
                        )}
                      </div>

                      {/* Key metrics */}
                      <div className="grid grid-cols-3 gap-3">
                        {(!isEmbed || ecApt?.showRooms !== false) && (
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-500">{t("apartment.rooms")}</p>
                          <p className="text-lg font-bold">{selectedApartment.rooms}</p>
                        </div>
                        )}
                        {(!isEmbed || ecApt?.showArea !== false) && (
                        <div className="rounded-lg bg-gray-50 p-3 text-center">
                          <p className="text-xs text-gray-500">{t("apartment.area")}</p>
                          <p className="text-lg font-bold">{selectedApartment.area} {areaUnit}</p>
                        </div>
                        )}
                        {(!isEmbed || ecApt?.showPrice !== false) && (
                        <div className="rounded-lg bg-brand-50 p-3 text-center">
                          <p className="text-xs text-gray-500">{t("apartment.price")}</p>
                          <p className="text-lg font-bold text-brand-700">
                            {selectedApartment.price ? `${currencySymbol}${selectedApartment.price.toLocaleString()}` : t("apartment.onRequest")}
                          </p>
                        </div>
                        )}
                      </div>

                      {/* Floor plan image */}
                      {(!isEmbed || ecApt?.showFloorPlan !== false) && selectedApartment.floorPlanUrl && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">{t("apartment.floorPlan")}</p>
                          <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                            <img
                              src={selectedApartment.floorPlanUrl}
                              alt={t("apartment.floorPlanForApt", { number: selectedApartment.number })}
                              className="w-full h-auto"
                            />
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      {(!isEmbed || ecApt?.showDescription !== false) && selectedApartment.description && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">{t("common.description")}</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{selectedApartment.description}</p>
                        </div>
                      )}

                      {/* Features */}
                      {(!isEmbed || ecApt?.showFeatures !== false) && selectedApartment.features && (() => {
                        try {
                          const feats = JSON.parse(selectedApartment.features);
                          const entries = Object.entries(feats).filter(([, v]) => v);
                          if (entries.length === 0) return null;
                          return (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1.5">{t("apartment.features")}</p>
                              <div className="flex flex-wrap gap-2">
                                {entries.map(([key]) => (
                                  <span key={key} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 border border-brand-100">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    {(key as string).replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        } catch { return null; }
                      })()}

                      {/* Share link */}
                      {(!isEmbed || ecApt?.showShareButton !== false) && (
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <input
                          readOnly
                          value={getShareUrl(selectedApartment.id)}
                          className="flex-1 bg-transparent text-xs text-gray-600 outline-none"
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(getShareUrl(selectedApartment.id))}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
                        >
                          {t("apartment.copyLink")}
                        </button>
                      </div>
                      )}

                      {/* View full apartment page link */}
                      {(!isEmbed || ecApt?.showDetailLink !== false) && (
                      <Link
                        to={getDetailLink(selectedApartment.id)}
                        className="block text-center text-sm text-brand-600 hover:text-brand-700 font-medium py-2 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
                        {...(isEmbed && ecApt?.detailLinkPattern ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {t("apartment.viewDetails")} →
                      </Link>
                      )}

                      {/* CTA */}
                      {(!isEmbed || ecApt?.showRequestForm !== false) && selectedApartment.status === "AVAILABLE" && (
                        <button
                          onClick={() => setShowModal(true)}
                          className="btn-primary w-full"
                        >
                          {t("apartment.requestInfo")}
                        </button>
                      )}
                      {selectedApartment.status === "RESERVED" && (
                        <p className="text-center text-sm text-yellow-700 bg-yellow-50 rounded-lg py-2">
                          {t("apartment.reservedMessage")}
                        </p>
                      )}
                      {selectedApartment.status === "SOLD" && (
                        <p className="text-center text-sm text-red-700 bg-red-50 rounded-lg py-2">
                          {t("apartment.soldMessage")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                /* Apartments list for selected floor */
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-sm font-semibold">
                      {t("viewer.apartmentsOnFloor", { n: selectedFloor.number })}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t("filter.nOfTotalShown", { n: filteredApartments.length, total: selectedFloor.apartments.length })}
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
                            <p className="text-sm font-medium">{t("apartment.apt")} {apt.number}</p>
                            <p className="text-xs text-gray-500">
                              {apt.rooms}{t("viewer.roomsSeparator")}{apt.area}{areaUnit}
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
                        {t("filter.noMatch")}
                      </p>
                    )}
                  </div>
                </div>
                )
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
                        <p className="text-xs text-gray-500">{t("floor.floors")}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-brand-600">{allApartments.length}</p>
                        <p className="text-xs text-gray-500">{t("apartment.apartments")}</p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {allApartments.filter((a: any) => a.status === "AVAILABLE").length}
                        </p>
                        <p className="text-xs text-gray-500">{t("status.available")}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 text-center">
                        <p className="text-2xl font-bold text-gray-600">
                          {allApartments.length > 0 && allApartments.some((a: any) => a.price)
                            ? `${currencySymbol}${Math.min(
                                ...allApartments.filter((a: any) => a.price).map((a: any) => a.price!)
                              ).toLocaleString()}`
                            : "—"}
                        </p>
                        <p className="text-xs text-gray-500">{t("viewer.startingFrom")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              {showLegend && (
              <div className="card">
                <div className="card-body">
                  <p className="text-xs font-medium text-gray-500 mb-2">{t("viewer.legend")}</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { status: t("status.available"), color: project.availableColor },
                      { status: t("status.reserved"), color: project.reservedColor },
                      { status: t("status.sold"), color: project.soldColor },
                      { status: t("status.unavailable"), color: project.unavailableColor },
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
              )}
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
          detailUrl={getDetailLink(selectedApartment.id)}
          showRequestForm={!isEmbed || ecApt?.showRequestForm !== false}
          showPrice={!isEmbed || ecApt?.showPrice !== false}
          showPricePerSqm={!isEmbed || ecApt?.showPricePerSqm !== false}
          showRooms={!isEmbed || ecApt?.showRooms !== false}
          showArea={!isEmbed || ecApt?.showArea !== false}
          showFloorPlan={!isEmbed || ecApt?.showFloorPlan !== false}
          showFeatures={!isEmbed || ecApt?.showFeatures !== false}
          showDescription={!isEmbed || ecApt?.showDescription !== false}
          showShareButton={!isEmbed || ecApt?.showShareButton !== false}
          showDetailLink={!isEmbed || ecApt?.showDetailLink !== false}
          onClose={handleCloseModal}
          onRequestSubmit={handleRequestSubmit}
        />
      )}

      {/* Powered by Vizor (embed mode) */}
      {showPoweredBy && (
        <div className="text-center py-2 text-xs text-gray-400">
          Powered by <a href="https://vizor.app" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 font-medium">Vizor</a>
        </div>
      )}
    </div>
  );
}
