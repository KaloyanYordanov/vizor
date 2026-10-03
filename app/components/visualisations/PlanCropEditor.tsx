import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Region } from "~/lib/visualisations/shared";
export function PlanCropEditor({
  imageUrl,
  region,
  onChange,
}: {
  imageUrl: string;
  region: Region;
  onChange: (region: Region) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<SVGSVGElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Region | null>(null);
  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };
  const r = region;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{t("visualisations.drawHint")}</p>
      <div className="relative bg-white border rounded-xl overflow-hidden">
        <img
          src={imageUrl}
          alt={t("visualisations.sourcePlan")}
          className="w-full h-auto"
          draggable={false}
        />
        <svg
          ref={ref}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full touch-none"
          style={{ cursor: "crosshair" }}
          onPointerDown={(e) => {
            if (!r) return;
            start.current = point(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!start.current) return;
            const p = point(e),
              s = start.current;
            setDraft({
              x: Math.min(p.x, s.x),
              y: Math.min(p.y, s.y),
              width: Math.abs(p.x - s.x),
              height: Math.abs(p.y - s.y),
            });
          }}
          onPointerUp={(e) => {
            if (start.current) {
              const p = point(e),
                s = start.current;
              const next = {
                x: Math.min(p.x, s.x),
                y: Math.min(p.y, s.y),
                width: Math.abs(p.x - s.x),
                height: Math.abs(p.y - s.y),
              };
              if (next.width >= 0.02 && next.height >= 0.02) onChange(next);
            }
            start.current = null;
            setDraft(null);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDraft(null);
          }}
        >
          <rect
            x={r.x * 100}
            y={r.y * 100}
            width={r.width * 100}
            height={r.height * 100}
            fill="#3b82f630"
            stroke="#2563eb"
            strokeWidth=".45"
          />
          {draft && (
            <rect
              x={draft.x * 100}
              y={draft.y * 100}
              width={draft.width * 100}
              height={draft.height * 100}
              fill="#3b82f640"
              stroke="#2563eb"
              strokeWidth=".5"
            />
          )}
        </svg>
      </div>
      {r && (
        <fieldset className="grid grid-cols-4 gap-2">
          <legend className="text-xs text-gray-500 mb-1">
            {t("visualisations.bounds")}
          </legend>
          {(["x", "y", "width", "height"] as const).map((key) => (
            <label key={key} className="text-xs">
              {t(`visualisations.${key}`)} %
              <input
                className="input mt-1"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={Math.round(r[key] * 1000) / 10}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  if (Number.isFinite(v)) onChange({ ...r, [key]: v });
                }}
              />
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
