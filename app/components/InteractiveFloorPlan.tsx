import { useState, useRef, useCallback, useMemo } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  DEFAULT_VIEWER_COLORS,
  getStatusColor as getStatusColorUtil,
  getStatusStroke as getStatusStrokeUtil,
  ensureRgba,
} from "~/utils/colors";

interface ApartmentData {
  id: string;
  number: string;
  rooms: number;
  area: number;
  price: number | null;
  pricePerSqm: number | null;
  status: string;
  svgPathId: string | null;
  polygonData: Array<{ x: number; y: number }> | null;
  description?: string | null;
  features?: string | null;
}

interface InteractiveFloorPlanProps {
  /** Image URL for the floor plan background */
  imageUrl?: string | null;
  /** Legacy SVG content (used if no imageUrl) */
  svgContent?: string | null;
  apartments: ApartmentData[];
  onApartmentClick?: (apartment: ApartmentData) => void;
  selectedApartmentId?: string | null;
  filterStatus?: string[];
  /** Project color settings */
  colors?: {
    available: string;
    reserved: string;
    sold: string;
    unavailable: string;
    stroke: string;
    strokeWidth: number;
  };
  /** Tooltip style variant */
  tooltipStyle?: "modern" | "minimal" | "detailed";
  /** Currency & area units */
  currencySymbol?: string;
  areaUnit?: string;
  className?: string;
}

const defaultColors = DEFAULT_VIEWER_COLORS;



/**
 * Interactive floor plan viewer with zoom/pan (react-zoom-pan-pinch),
 * SVG polygon overlays, hover tooltips, and click interaction.
 * Supports both image-based (with polygon data) and legacy SVG approaches.
 */
export function InteractiveFloorPlan({
  imageUrl,
  svgContent,
  apartments,
  onApartmentClick,
  selectedApartmentId,
  filterStatus,
  colors = defaultColors,
  tooltipStyle = "modern",
  currencySymbol = "€",
  areaUnit = "m²",
  className = "",
}: InteractiveFloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    apartment: ApartmentData | null;
  }>({ visible: false, x: 0, y: 0, apartment: null });

  const getStatusColor = useCallback(
    (status: string, alpha = 0.4) => getStatusColorUtil(status, colors, alpha),
    [colors]
  );

  const getStatusStroke = useCallback(
    (status: string) => getStatusStrokeUtil(status, colors),
    [colors]
  );

  /** Apartments with polygon data (for image-based rendering) */
  const polygonApartments = useMemo(
    () => apartments.filter((a) => a.polygonData && a.polygonData.length >= 3),
    [apartments]
  );

  const isVisible = useCallback(
    (apt: ApartmentData) => !filterStatus || filterStatus.includes(apt.status),
    [filterStatus]
  );

  const handlePolygonMouseEnter = useCallback(
    (apt: ApartmentData, e: React.MouseEvent) => {
      if (!isVisible(apt)) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 10,
        apartment: apt,
      });
    },
    [isVisible]
  );

  const handlePolygonMouseMove = useCallback(
    (apt: ApartmentData, e: React.MouseEvent) => {
      if (!isVisible(apt)) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltip((prev) => ({
        ...prev,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 10,
      }));
    },
    [isVisible]
  );

  const handlePolygonMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handlePolygonClick = useCallback(
    (apt: ApartmentData) => {
      if (!isVisible(apt) || apt.status === "UNAVAILABLE") return;
      onApartmentClick?.(apt);
    },
    [isVisible, onApartmentClick]
  );

  const pointsToSvg = (points: Array<{ x: number; y: number }>): string =>
    points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");

  /** Render tooltip based on style */
  const renderTooltip = () => {
    if (!tooltip.visible || !tooltip.apartment) return null;
    const apt = tooltip.apartment;

    if (tooltipStyle === "minimal") {
      return (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-gray-900/95 text-white rounded-md px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap backdrop-blur-sm">
            <span className="font-semibold">Apt {apt.number}</span>
            <span className="text-gray-300 ml-1.5">
              {apt.rooms}r · {apt.area}{areaUnit}
            </span>
          </div>
          <div className="w-2 h-2 bg-gray-900/95 rotate-45 mx-auto -mt-1" />
        </div>
      );
    }

    if (tooltipStyle === "detailed") {
      return (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden min-w-[200px]">
            <div
              className="px-3 py-2 text-white text-xs font-semibold"
              style={{ backgroundColor: getStatusStroke(apt.status) }}
            >
              Apartment {apt.number}
            </div>
            <div className="px-3 py-2.5 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Rooms</span>
                <span className="font-medium">{apt.rooms}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Area</span>
                <span className="font-medium">{apt.area} {areaUnit}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Price</span>
                <span className="font-semibold">
                  {apt.price ? `${currencySymbol}${apt.price.toLocaleString()}` : "On request"}
                </span>
              </div>
              {apt.pricePerSqm && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Price/{areaUnit}</span>
                  <span className="font-medium">{currencySymbol}{apt.pricePerSqm.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                <span className="text-gray-500">Status</span>
                <span
                  className="font-medium"
                  style={{ color: getStatusStroke(apt.status) }}
                >
                  {apt.status.charAt(0) + apt.status.slice(1).toLowerCase()}
                </span>
              </div>
            </div>
          </div>
          <div className="w-3 h-3 bg-white border-b border-r border-gray-100 rotate-45 mx-auto -mt-1.5" />
        </div>
      );
    }

    // "modern" (default)
    return (
      <div
        className="absolute z-50 pointer-events-none"
        style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
      >
        <div className="bg-gray-900/95 text-white rounded-lg px-3 py-2 shadow-xl text-sm whitespace-nowrap backdrop-blur-sm">
          <p className="font-semibold">Apt {apt.number}</p>
          <p className="text-gray-300 text-xs">
            {apt.rooms} rooms · {apt.area}{areaUnit}
            {apt.price && ` · ${currencySymbol}${apt.price.toLocaleString()}`}
          </p>
          <p className="text-xs mt-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full mr-1"
              style={{ backgroundColor: getStatusStroke(apt.status) }}
            />
            {apt.status.charAt(0) + apt.status.slice(1).toLowerCase()}
          </p>
        </div>
        <div className="w-3 h-3 bg-gray-900/95 rotate-45 mx-auto -mt-1.5" />
      </div>
    );
  };

  /** Image-based render with SVG polygon overlays */
  const renderImageBased = () => (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={4}
      wheel={{ step: 0.1 }}
      panning={{ velocityDisabled: true }}
      doubleClick={{ disabled: true }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
            <button
              onClick={() => zoomIn()}
              className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white transition-colors"
              title="Zoom in"
            >
              <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button
              onClick={() => zoomOut()}
              className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white transition-colors"
              title="Zoom out"
            >
              <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
              </svg>
            </button>
            <button
              onClick={() => resetTransform()}
              className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white transition-colors text-xs font-medium text-gray-700"
              title="Reset zoom"
            >
              ↺
            </button>
          </div>

          <TransformComponent
            wrapperClass="!w-full"
            contentClass="!w-full"
          >
            <div className="relative">
              <img
                src={imageUrl!}
                alt="Floor plan"
                className="block w-full h-auto"
                draggable={false}
              />
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                {polygonApartments.map((apt) => {
                  const visible = isVisible(apt);
                  const isSelected = apt.id === selectedApartmentId;
                  return (
                    <polygon
                      key={apt.id}
                      points={pointsToSvg(apt.polygonData!)}
                      fill={getStatusColor(apt.status, visible ? (isSelected ? 0.55 : 0.35) : 0.1)}
                      stroke={isSelected ? "#2563eb" : getStatusStroke(apt.status)}
                      strokeWidth={isSelected ? 0.6 : 0.3}
                      className="transition-all duration-200"
                      style={{
                        cursor: visible && apt.status !== "UNAVAILABLE" ? "pointer" : "default",
                        opacity: visible ? 1 : 0.3,
                      }}
                      onMouseEnter={(e) => handlePolygonMouseEnter(apt, e)}
                      onMouseMove={(e) => handlePolygonMouseMove(apt, e)}
                      onMouseLeave={handlePolygonMouseLeave}
                      onClick={() => handlePolygonClick(apt)}
                    />
                  );
                })}
              </svg>
            </div>
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );

  /** Legacy SVG-based render */
  const renderSvgBased = () => (
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={4}
      wheel={{ step: 0.1 }}
      panning={{ velocityDisabled: true }}
      doubleClick={{ disabled: true }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
            <button onClick={() => zoomIn()} className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white" title="Zoom in">
              <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button onClick={() => zoomOut()} className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white" title="Zoom out">
              <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
              </svg>
            </button>
            <button onClick={() => resetTransform()} className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white text-xs font-medium text-gray-700" title="Reset">
              ↺
            </button>
          </div>
          <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
            <LegacySvgFloorPlan
              svgContent={svgContent!}
              apartments={apartments}
              onApartmentClick={onApartmentClick}
              selectedApartmentId={selectedApartmentId}
              filterStatus={filterStatus}
              colors={colors}
              onTooltipShow={(apt, x, y) =>
                setTooltip({ visible: true, x, y, apartment: apt })
              }
              onTooltipHide={() => setTooltip((prev) => ({ ...prev, visible: false }))}
              containerRef={containerRef}
            />
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );

  const hasImagePolygons = imageUrl && polygonApartments.length > 0;
  const hasImage = !!imageUrl;
  const hasSvg = !!svgContent;

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-lg ${className}`}>
      {hasImagePolygons ? renderImageBased() : hasImage ? (
        // Image without polygons — just show the image with zoom
        <TransformWrapper initialScale={1} minScale={0.5} maxScale={4}>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
                <button onClick={() => zoomIn()} className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white" title="Zoom in">
                  <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
                <button onClick={() => zoomOut()} className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white" title="Zoom out">
                  <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                  </svg>
                </button>
                <button onClick={() => resetTransform()} className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md hover:bg-white text-xs font-medium text-gray-700" title="Reset">↺</button>
              </div>
              <TransformComponent wrapperClass="!w-full" contentClass="!w-full">
                <img src={imageUrl} alt="Floor plan" className="block w-full h-auto" draggable={false} />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      ) : hasSvg ? renderSvgBased() : (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No floor plan available</p>
        </div>
      )}

      {/* Tooltip overlay */}
      {renderTooltip()}
    </div>
  );
}

/**
 * Legacy SVG floor plan renderer - colorizes SVG elements by svgPathId
 */
function LegacySvgFloorPlan({
  svgContent,
  apartments,
  onApartmentClick,
  selectedApartmentId,
  filterStatus,
  colors,
  onTooltipShow,
  onTooltipHide,
  containerRef,
}: {
  svgContent: string;
  apartments: ApartmentData[];
  onApartmentClick?: (apartment: ApartmentData) => void;
  selectedApartmentId?: string | null;
  filterStatus?: string[];
  colors: typeof defaultColors;
  onTooltipShow: (apt: ApartmentData, x: number, y: number) => void;
  onTooltipHide: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const svgRef = useRef<HTMLDivElement>(null);

  const statusFillColors: Record<string, string> = {
    AVAILABLE: getStatusColorUtil("AVAILABLE", colors, 0.25),
    RESERVED: getStatusColorUtil("RESERVED", colors, 0.25),
    SOLD: getStatusColorUtil("SOLD", colors, 0.25),
    UNAVAILABLE: getStatusColorUtil("UNAVAILABLE", colors, 0.25),
  };

  // Attach event handlers to SVG elements
  const attachHandlers = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      svgRef.current = node;

      apartments.forEach((apt) => {
        if (!apt.svgPathId) return;
        const el = node.querySelector(`#${CSS.escape(apt.svgPathId)}`) as SVGElement | null;
        if (!el) return;

        const vis = !filterStatus || filterStatus.includes(apt.status);
        const fillColor = statusFillColors[apt.status] || statusFillColors.UNAVAILABLE;
        const strokeColor = colors[apt.status.toLowerCase() as keyof typeof colors] || colors.unavailable;

        el.style.fill = fillColor;
        el.style.stroke = strokeColor as string;
        el.style.strokeWidth = `${colors.strokeWidth}`;
        el.style.transition = "all 0.2s ease";
        el.style.opacity = vis ? "1" : "0.3";
        el.style.cursor = vis && apt.status !== "UNAVAILABLE" ? "pointer" : "default";

        if (apt.id === selectedApartmentId) {
          el.style.strokeWidth = "4";
          el.style.filter = "brightness(0.85)";
        }

        el.onmouseenter = (e) => {
          if (!vis) return;
          el.style.filter = "brightness(0.88)";
          el.style.strokeWidth = "3";
          const cr = containerRef.current?.getBoundingClientRect();
          if (cr) {
            onTooltipShow(apt, e.clientX - cr.left, e.clientY - cr.top - 10);
          }
        };
        el.onmousemove = (e) => {
          if (!vis) return;
          const cr = containerRef.current?.getBoundingClientRect();
          if (cr) {
            onTooltipShow(apt, e.clientX - cr.left, e.clientY - cr.top - 10);
          }
        };
        el.onmouseleave = () => {
          if (apt.id !== selectedApartmentId) {
            el.style.filter = "";
            el.style.strokeWidth = `${colors.strokeWidth}`;
          }
          onTooltipHide();
        };
        el.onclick = () => {
          if (vis && apt.status !== "UNAVAILABLE") onApartmentClick?.(apt);
        };
      });
    },
    [apartments, selectedApartmentId, filterStatus, colors, onApartmentClick, onTooltipShow, onTooltipHide, containerRef]
  );

  return (
    <div
      ref={attachHandlers}
      className="w-full [&>svg]:w-full [&>svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
