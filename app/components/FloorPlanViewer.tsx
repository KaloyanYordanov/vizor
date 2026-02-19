import { useEffect, useRef, useState } from "react";

interface ApartmentData {
  id: string;
  number: string;
  rooms: number;
  area: number;
  price: number | null;
  status: string;
  svgPathId: string | null;
  description?: string | null;
  features?: string | null;
  pricePerSqm?: number | null;
}

interface FloorPlanViewerProps {
  svgContent: string;
  apartments: ApartmentData[];
  onApartmentClick?: (apartment: ApartmentData) => void;
  selectedApartmentId?: string | null;
  className?: string;
  filterStatus?: string[];
}

/**
 * Interactive floor plan SVG viewer with apartment region highlights.
 * Colorizes apartment regions by status and shows tooltips on hover.
 */
export function FloorPlanViewer({
  svgContent,
  apartments,
  onApartmentClick,
  selectedApartmentId,
  className = "",
  filterStatus,
}: FloorPlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    apartment: ApartmentData | null;
  }>({ visible: false, x: 0, y: 0, apartment: null });

  const statusColors: Record<string, { fill: string; stroke: string }> = {
    AVAILABLE: { fill: "#dcfce7", stroke: "#22c55e" },
    RESERVED: { fill: "#fef9c3", stroke: "#f59e0b" },
    SOLD: { fill: "#fecaca", stroke: "#ef4444" },
    UNAVAILABLE: { fill: "#e5e7eb", stroke: "#9ca3af" },
  };

  // Apply colors and attach event handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const filteredApts = filterStatus
      ? apartments.filter((a) => filterStatus.includes(a.status))
      : apartments;
    const hiddenApts = filterStatus
      ? apartments.filter((a) => !filterStatus.includes(a.status))
      : [];

    // Colorize regions by status
    apartments.forEach((apt) => {
      if (!apt.svgPathId) return;
      const el = container.querySelector(`#${CSS.escape(apt.svgPathId)}`) as SVGElement | null;
      if (!el) return;

      const colors = statusColors[apt.status] || statusColors.UNAVAILABLE;
      el.style.fill = colors.fill;
      el.style.stroke = colors.stroke;
      el.style.strokeWidth = "2";
      el.style.transition = "all 0.2s ease";
      el.setAttribute("data-status", apt.status.toLowerCase());

      // Dim filtered-out apartments
      if (hiddenApts.find((a) => a.id === apt.id)) {
        el.style.opacity = "0.3";
        el.style.cursor = "default";
      } else {
        el.style.opacity = "1";
        el.style.cursor = apt.status === "UNAVAILABLE" ? "default" : "pointer";
      }

      // Selected highlight
      if (apt.id === selectedApartmentId) {
        el.style.strokeWidth = "4";
        el.style.filter = "brightness(0.85)";
      }
    });

    // Event handlers
    const handleMouseEnter = (apt: ApartmentData) => (e: Event) => {
      if (filterStatus && !filterStatus.includes(apt.status)) return;
      const el = e.currentTarget as SVGElement;
      el.style.filter = "brightness(0.88)";
      el.style.strokeWidth = "3";

      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 10,
        apartment: apt,
      });
    };

    const handleMouseLeave = (apt: ApartmentData) => (e: Event) => {
      const el = e.currentTarget as SVGElement;
      if (apt.id !== selectedApartmentId) {
        el.style.filter = "";
        el.style.strokeWidth = "2";
      }
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    const handleClick = (apt: ApartmentData) => () => {
      if (filterStatus && !filterStatus.includes(apt.status)) return;
      if (apt.status === "UNAVAILABLE") return;
      onApartmentClick?.(apt);
    };

    const cleanups: (() => void)[] = [];

    apartments.forEach((apt) => {
      if (!apt.svgPathId) return;
      const el = container.querySelector(`#${CSS.escape(apt.svgPathId)}`) as SVGElement | null;
      if (!el) return;

      const enterHandler = handleMouseEnter(apt);
      const leaveHandler = handleMouseLeave(apt);
      const clickHandler = handleClick(apt);

      el.addEventListener("mouseenter", enterHandler);
      el.addEventListener("mouseleave", leaveHandler);
      el.addEventListener("click", clickHandler);

      cleanups.push(() => {
        el.removeEventListener("mouseenter", enterHandler);
        el.removeEventListener("mouseleave", leaveHandler);
        el.removeEventListener("click", clickHandler);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [svgContent, apartments, selectedApartmentId, onApartmentClick, filterStatus]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full [&>svg]:w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {/* Tooltip */}
      {tooltip.visible && tooltip.apartment && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-gray-900 text-white rounded-lg px-3 py-2 shadow-xl text-sm whitespace-nowrap">
            <p className="font-semibold">Apt {tooltip.apartment.number}</p>
            <p className="text-gray-300 text-xs">
              {tooltip.apartment.rooms} rooms · {tooltip.apartment.area}m²
              {tooltip.apartment.price && ` · €${tooltip.apartment.price.toLocaleString()}`}
            </p>
            <p className="text-xs mt-0.5">
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1 ${
                  {
                    AVAILABLE: "bg-green-400",
                    RESERVED: "bg-yellow-400",
                    SOLD: "bg-red-400",
                    UNAVAILABLE: "bg-gray-400",
                  }[tooltip.apartment.status]
                }`}
              />
              {tooltip.apartment.status.charAt(0) + tooltip.apartment.status.slice(1).toLowerCase()}
            </p>
          </div>
          <div className="w-3 h-3 bg-gray-900 rotate-45 mx-auto -mt-1.5" />
        </div>
      )}
    </div>
  );
}
