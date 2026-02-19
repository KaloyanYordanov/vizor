import { useState, useRef, useMemo } from "react";
import { ensureRgba } from "~/utils/colors";

interface FloorPolygon {
  apartmentId: string; // actually floorId — reuses PolygonEditor's generic field
  points: Array<{ x: number; y: number }>;
}

interface BuildingFloorSelectorProps {
  imageUrl: string;
  polygons: FloorPolygon[];
  floors: Array<{
    id: string;
    number: number;
    label: string | null;
    apartments: Array<{ status: string }>;
  }>;
  onFloorClick: (floorNumber: number) => void;
  colors?: {
    available?: string;
    reserved?: string;
    sold?: string;
    unavailable?: string;
  };
}

/**
 * Renders a building image with clickable polygon regions for floor selection.
 * Each polygon is linked to a floor via the floorsPolygonData stored on the Building model.
 */
export function BuildingFloorSelector({
  imageUrl,
  polygons,
  floors,
  onFloorClick,
  colors = {},
}: BuildingFloorSelectorProps) {
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const floorMap = useMemo(() => {
    const map = new Map<string, (typeof floors)[0]>();
    for (const f of floors) {
      map.set(f.id, f);
    }
    return map;
  }, [floors]);

  const getFillColor = (floor: (typeof floors)[0] | undefined, isHovered: boolean) => {
    if (!floor) return ensureRgba("rgba(100,130,255,0.2)", isHovered ? 0.55 : 0.2);
    const available = floor.apartments.filter((a) => a.status === "AVAILABLE").length;
    const total = floor.apartments.length;

    let baseColor: string;
    if (total === 0) {
      baseColor = colors.available || "#22c55e";
    } else if (available === 0) {
      baseColor = colors.sold || "#ef4444";
    } else if (available < total) {
      baseColor = colors.reserved || "#f59e0b";
    } else {
      baseColor = colors.available || "#22c55e";
    }

    const alpha = isHovered ? 0.55 : 0.3;
    return ensureRgba(baseColor, alpha);
  };

  const pointsToSvg = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");

  return (
    <div ref={containerRef} className="relative w-full">
      <img
        src={imageUrl}
        alt="Building"
        className="w-full h-auto block rounded-lg"
        draggable={false}
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        {polygons.map((poly, i) => {
          const floor = floorMap.get(poly.apartmentId);
          const isHovered = hoveredFloorId === poly.apartmentId;
          const floorNumber = floor?.number;
          if (!poly.points || poly.points.length < 3) return null;

          const cx = poly.points.reduce((s, p) => s + p.x * 100, 0) / poly.points.length;
          const cy = poly.points.reduce((s, p) => s + p.y * 100, 0) / poly.points.length;

          return (
            <g key={i}>
              <polygon
                points={pointsToSvg(poly.points)}
                fill={getFillColor(floor, isHovered)}
                stroke={isHovered ? "#2563eb" : "#1e293b"}
                strokeWidth={isHovered ? 0.6 : 0.3}
                className="cursor-pointer transition-all duration-150"
                onClick={() => floorNumber !== undefined && onFloorClick(floorNumber)}
                onMouseEnter={() => setHoveredFloorId(poly.apartmentId)}
                onMouseLeave={() => setHoveredFloorId(null)}
              />
              {floor && (() => {
                const label = floor.label || `Floor ${floor.number}`;
                const availCount = floor.apartments.filter((a) => a.status === "AVAILABLE").length;
                const subLabel = `${availCount} available`;
                const charW = 1.4;
                const pad = 2;
                const rectW = Math.max(label.length * charW, subLabel.length * charW * 0.72) + pad * 2;
                const rectH = 8;
                return (
                  <g pointerEvents="none" className="select-none">
                    <rect
                      x={cx - rectW / 2}
                      y={cy - rectH / 2}
                      width={rectW}
                      height={rectH}
                      rx={1.2}
                      fill="rgba(255,255,255,0.88)"
                      stroke="#475569"
                      strokeWidth={0.2}
                    />
                    <text
                      x={cx}
                      y={cy - 1.5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="2.5"
                      fontWeight="bold"
                      fill="#1e293b"
                    >
                      {label}
                    </text>
                    <text
                      x={cx}
                      y={cy + 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="1.8"
                      fill="#4b5563"
                    >
                      {subLabel}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
