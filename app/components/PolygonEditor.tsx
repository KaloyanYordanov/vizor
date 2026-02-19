import { useState, useRef, useCallback, useEffect } from "react";
import { ensureRgba } from "~/utils/colors";

/**
 * A single polygon: array of {x, y} points (0-1 normalized coordinates).
 * Each polygon is linked to an apartment by its ID.
 */
export interface PolygonPoint {
  x: number;
  y: number;
}

export interface DrawnPolygon {
  apartmentId: string;
  points: PolygonPoint[];
}

interface PolygonEditorProps {
  /** Background image URL for the floor plan */
  imageUrl: string;
  /** Existing polygons (already saved) */
  polygons: DrawnPolygon[];
  /** Items available for linking (apartments or floors) */
  apartments: { id: string; number: string; status: string }[];
  /** Called whenever polygons are modified */
  onPolygonsChange: (polygons: DrawnPolygon[]) => void;
  /** Label for the linkable item type (default: "Apartment") */
  itemLabel?: string;
  /** Status color map */
  statusColors?: Record<string, string>;
  className?: string;
}

type EditorMode = "draw" | "edit" | "select";

/**
 * Interactive polygon editor for drawing clickable zones on floor plan images.
 * Supports:
 *  - Drawing new polygons by clicking vertices
 *  - Editing existing polygons by dragging vertices
 *  - Zoom (Ctrl+/Ctrl-/scroll) and Pan (spacebar + drag)
 *  - Linking polygons to apartments
 *  - Status-based coloring
 */
export function PolygonEditor({
  imageUrl,
  polygons,
  apartments,
  onPolygonsChange,
  itemLabel = "Apartment",
  statusColors = {
    AVAILABLE: ensureRgba("#22c55e", 0.35),
    RESERVED: ensureRgba("#f59e0b", 0.35),
    SOLD: ensureRgba("#ef4444", 0.35),
    UNAVAILABLE: ensureRgba("#9ca3af", 0.35),
  },
  className = "",
}: PolygonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<EditorMode>("select");
  const [currentPoints, setCurrentPoints] = useState<PolygonPoint[]>([]);
  const [selectedPolygonIdx, setSelectedPolygonIdx] = useState<number | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<{ polyIdx: number; vertIdx: number } | null>(null);
  const [linkingApartment, setLinkingApartment] = useState<string>("");
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [hoveredPolygonIdx, setHoveredPolygonIdx] = useState<number | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Load image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Keyboard handlers for zoom/pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === "Escape") {
        if (mode === "draw" && currentPoints.length > 0) {
          setCurrentPoints([]);
          setMode("select");
        }
        setSelectedPolygonIdx(null);
      }
      // Ctrl+= zoom in, Ctrl+- zoom out
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setZoom((z) => Math.min(z * 1.2, 5));
        }
        if (e.key === "-") {
          e.preventDefault();
          setZoom((z) => Math.max(z / 1.2, 0.5));
        }
        if (e.key === "0") {
          e.preventDefault();
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      }
      // Delete selected polygon
      if ((e.key === "Delete" || e.key === "Backspace") && selectedPolygonIdx !== null) {
        const updated = polygons.filter((_, i) => i !== selectedPolygonIdx);
        onPolygonsChange(updated);
        setSelectedPolygonIdx(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceHeld(false);
        setIsPanning(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [mode, currentPoints, selectedPolygonIdx, polygons, onPolygonsChange]);

  // Scroll to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((z) => Math.min(Math.max(z * delta, 0.5), 5));
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  /** Convert screen coordinates to normalized (0-1) coordinates */
  const screenToNormalized = useCallback(
    (clientX: number, clientY: number): PolygonPoint => {
      const svg = svgRef.current;
      if (!svg || imageDimensions.width === 0) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    },
    [imageDimensions]
  );

  /** Handle SVG click — add point or close polygon */
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (spaceHeld || isPanning) return;
      if (mode !== "draw") return;

      const pt = screenToNormalized(e.clientX, e.clientY);

      // Close polygon if clicking near first point
      if (currentPoints.length >= 3) {
        const first = currentPoints[0];
        const dist = Math.sqrt(
          Math.pow(pt.x - first.x, 2) + Math.pow(pt.y - first.y, 2)
        );
        if (dist < 0.02) {
          // Polygon complete!
          const newPoly: DrawnPolygon = {
            apartmentId: "",
            points: [...currentPoints],
          };
          onPolygonsChange([...polygons, newPoly]);
          setCurrentPoints([]);
          setSelectedPolygonIdx(polygons.length);
          setMode("select");
          return;
        }
      }

      setCurrentPoints((prev) => [...prev, pt]);
    },
    [mode, currentPoints, polygons, onPolygonsChange, screenToNormalized, spaceHeld, isPanning]
  );

  /** Handle mouse down for panning or vertex dragging */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (spaceHeld) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }
    },
    [spaceHeld, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
      }
      if (draggingVertex) {
        const pt = screenToNormalized(e.clientX, e.clientY);
        const updated = [...polygons];
        const poly = { ...updated[draggingVertex.polyIdx] };
        const points = [...poly.points];
        points[draggingVertex.vertIdx] = pt;
        poly.points = points;
        updated[draggingVertex.polyIdx] = poly;
        onPolygonsChange(updated);
      }
    },
    [isPanning, panStart, draggingVertex, polygons, onPolygonsChange, screenToNormalized]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingVertex(null);
  }, []);

  /** Start dragging a vertex */
  const handleVertexMouseDown = useCallback(
    (e: React.MouseEvent, polyIdx: number, vertIdx: number) => {
      e.stopPropagation();
      if (mode === "edit" || mode === "select") {
        setDraggingVertex({ polyIdx, vertIdx });
        setSelectedPolygonIdx(polyIdx);
      }
    },
    [mode]
  );

  /** Convert polygon points to SVG polygon string */
  const pointsToSvg = (points: PolygonPoint[]): string =>
    points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");

  /** Get apartment info for a polygon */
  const getApartmentForPolygon = (poly: DrawnPolygon) =>
    apartments.find((a) => a.id === poly.apartmentId);

  /** Link selected polygon to apartment */
  const handleLinkApartment = (apartmentId: string) => {
    if (selectedPolygonIdx === null) return;
    const updated = [...polygons];
    updated[selectedPolygonIdx] = { ...updated[selectedPolygonIdx], apartmentId };
    onPolygonsChange(updated);
    setLinkingApartment("");
  };

  /** Get linked apartment IDs */
  const linkedApartmentIds = new Set(polygons.map((p) => p.apartmentId).filter(Boolean));

  const selectedPolygon = selectedPolygonIdx !== null ? polygons[selectedPolygonIdx] : null;
  const selectedApt = selectedPolygon ? getApartmentForPolygon(selectedPolygon) : null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(
            [
              { m: "select", label: "Select", icon: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" },
              { m: "draw", label: "Draw", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
              { m: "edit", label: "Edit", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
            ] as const
          ).map(({ m, label, icon }) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                if (m === "draw") {
                  setCurrentPoints([]);
                  setSelectedPolygonIdx(null);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-white shadow text-brand-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.2, 0.5))}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
            title="Zoom out (Ctrl+-)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 5))}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
            title="Zoom in (Ctrl++)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 text-xs"
            title="Reset view (Ctrl+0)"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        {mode === "draw" && (
          <span>
            Click to place polygon vertices. Click the <span className="text-red-500 font-medium">first point</span> to close.
            Press <kbd className="px-1 bg-gray-200 rounded">Esc</kbd> to cancel.
          </span>
        )}
        {mode === "select" && <span>Click a polygon to select it. Press <kbd className="px-1 bg-gray-200 rounded">Delete</kbd> to remove.</span>}
        {mode === "edit" && <span>Drag polygon vertices to reposition them. Hold <kbd className="px-1 bg-gray-200 rounded">Space</kbd> + drag to pan.</span>}
        <span className="ml-2 text-gray-400">
          Scroll or <kbd className="px-1 bg-gray-200 rounded">Ctrl+/-</kbd> to zoom.
          <kbd className="px-1 bg-gray-200 rounded ml-1">Space</kbd> + drag to pan.
        </span>
      </div>

      {/* Editor canvas */}
      <div
        ref={containerRef}
        className="relative border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-900"
        style={{ cursor: spaceHeld ? "grab" : mode === "draw" ? "crosshair" : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "relative",
          }}
        >
          {/* Background image */}
          <img
            src={imageUrl}
            alt="Floor plan"
            className="block w-full h-auto select-none"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />

          {/* SVG overlay (same size as image) */}
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            onClick={handleSvgClick}
            style={{ pointerEvents: spaceHeld ? "none" : "auto" }}
          >
            {/* Existing polygons */}
            {polygons.map((poly, i) => {
              const apt = getApartmentForPolygon(poly);
              const color = apt
                ? statusColors[apt.status] || statusColors.AVAILABLE
                : "rgba(100,130,255,0.3)";
              const isSelected = i === selectedPolygonIdx;
              const isHovered = i === hoveredPolygonIdx;

              return (
                <g key={i}>
                  <polygon
                    points={pointsToSvg(poly.points)}
                    fill={color}
                    stroke={isSelected ? "#2563eb" : isHovered ? "#3b82f6" : "#1e293b"}
                    strokeWidth={isSelected ? 0.6 : 0.3}
                    className="transition-all duration-150"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mode === "select" || mode === "edit") {
                        setSelectedPolygonIdx(i);
                      }
                    }}
                    onMouseEnter={() => setHoveredPolygonIdx(i)}
                    onMouseLeave={() => setHoveredPolygonIdx(null)}
                    style={{ cursor: mode === "draw" ? "crosshair" : "pointer" }}
                  />
                  {/* Apartment label */}
                  {/* Label with background for readability */}
                  {apt && poly.points.length > 0 && (() => {
                    const cx = poly.points.reduce((s, p) => s + p.x * 100, 0) / poly.points.length;
                    const cy = poly.points.reduce((s, p) => s + p.y * 100, 0) / poly.points.length;
                    const label = apt.number;
                    const charWidth = 1.5;
                    const padding = 1.5;
                    const rectW = Math.max(label.length * charWidth + padding * 2, 8);
                    const rectH = 4.5;
                    return (
                      <g pointerEvents="none">
                        <rect
                          x={cx - rectW / 2}
                          y={cy - rectH / 2}
                          width={rectW}
                          height={rectH}
                          rx={1}
                          fill="rgba(255,255,255,0.85)"
                          stroke="#475569"
                          strokeWidth={0.2}
                        />
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="2.5"
                          fontWeight="bold"
                          fill="#1e293b"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })()}
                  {/* Vertex handles (edit/select mode) */}
                  {(isSelected || mode === "edit") &&
                    poly.points.map((pt, vi) => (
                      <circle
                        key={vi}
                        cx={pt.x * 100}
                        cy={pt.y * 100}
                        r={0.8}
                        fill={vi === 0 ? "#ef4444" : "#3b82f6"}
                        stroke="#fff"
                        strokeWidth={0.3}
                        className="cursor-move"
                        onMouseDown={(e) => handleVertexMouseDown(e, i, vi)}
                      />
                    ))}
                </g>
              );
            })}

            {/* Current drawing polygon */}
            {mode === "draw" && currentPoints.length > 0 && (
              <g>
                <polyline
                  points={pointsToSvg(currentPoints)}
                  fill="rgba(59,130,246,0.2)"
                  stroke="#3b82f6"
                  strokeWidth={0.4}
                  strokeDasharray="1,0.5"
                />
                {currentPoints.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x * 100}
                    cy={pt.y * 100}
                    r={i === 0 ? 1.2 : 0.7}
                    fill={i === 0 ? "#ef4444" : "#3b82f6"}
                    stroke="#fff"
                    strokeWidth={0.3}
                    className={i === 0 && currentPoints.length >= 3 ? "cursor-pointer" : ""}
                  />
                ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Selected polygon panel */}
      {selectedPolygon && selectedPolygonIdx !== null && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Polygon #{selectedPolygonIdx + 1}
              {selectedApt && (
                <span className="ml-2 text-gray-400 font-normal">→ {itemLabel === "Floor" ? "" : "Apt "}{selectedApt.number}</span>
              )}
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const updated = polygons.filter((_, i) => i !== selectedPolygonIdx);
                  onPolygonsChange(updated);
                  setSelectedPolygonIdx(null);
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedPolygonIdx(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Deselect
              </button>
            </div>
          </div>

          {/* Link to item */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Link to {itemLabel}
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              value={selectedPolygon.apartmentId}
              onChange={(e) => handleLinkApartment(e.target.value)}
            >
              <option value="">— Unlinked —</option>
              {apartments.map((apt) => (
                <option
                  key={apt.id}
                  value={apt.id}
                  disabled={linkedApartmentIds.has(apt.id) && apt.id !== selectedPolygon.apartmentId}
                >
                  {itemLabel === "Floor" ? "" : "Apt "}{apt.number} ({apt.status.toLowerCase()})
                  {linkedApartmentIds.has(apt.id) && apt.id !== selectedPolygon.apartmentId ? " (linked)" : ""}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-gray-400">
            {selectedPolygon.points.length} vertices
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {polygons.length} polygon(s) · {polygons.filter((p) => p.apartmentId).length} linked
        </span>
        <span>
          {apartments.length - linkedApartmentIds.size} apartment(s) unlinked
        </span>
      </div>
    </div>
  );
}
