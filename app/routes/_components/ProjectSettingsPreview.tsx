import React, { useState } from "react";

export default function PreviewSettings({ project }: { project: any }) {
  const fallback = {
    currencySymbol: "€",
    areaUnit: "m²",
    primaryColor: "#3b82f6",
    availableColor: "#22c55e",
    reservedColor: "#f59e0b",
    soldColor: "#ef4444",
    unavailableColor: "#9ca3af",
    strokeColor: "#1e293b",
    strokeWidth: 2,
    tooltipStyle: "modern",
  } as const;

  const [preview, setPreview] = useState({
    currencySymbol: project.currencySymbol ?? fallback.currencySymbol,
    areaUnit: project.areaUnit ?? fallback.areaUnit,
    primaryColor: project.primaryColor ?? fallback.primaryColor,
    availableColor: project.availableColor ?? fallback.availableColor,
    reservedColor: project.reservedColor ?? fallback.reservedColor,
    soldColor: project.soldColor ?? fallback.soldColor,
    unavailableColor: project.unavailableColor ?? fallback.unavailableColor,
    strokeColor: project.strokeColor ?? fallback.strokeColor,
    strokeWidth: project.strokeWidth ?? fallback.strokeWidth,
    tooltipStyle: project.tooltipStyle ?? (fallback.tooltipStyle as string),
  });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* form controls (left/center) — keep names for server submission */}
      <div className="md:col-span-2 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Currency Symbol</label>
            <input
              name="currencySymbol"
              className="input"
              defaultValue={project.currencySymbol ?? fallback.currencySymbol}
              placeholder="€"
              onChange={(e) => setPreview((p) => ({ ...p, currencySymbol: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Area Unit</label>
            <input
              name="areaUnit"
              className="input"
              defaultValue={project.areaUnit ?? fallback.areaUnit}
              placeholder="m²"
              onChange={(e) => setPreview((p) => ({ ...p, areaUnit: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <p className="label mb-2">Status Colors</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col items-center gap-2">
              <input
                type="color"
                name="availableColor"
                defaultValue={project.availableColor ?? fallback.availableColor}
                className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                onChange={(e) => setPreview((p) => ({ ...p, availableColor: e.target.value }))}
              />
              <span className="text-xs text-gray-600">Available</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <input
                type="color"
                name="reservedColor"
                defaultValue={project.reservedColor ?? fallback.reservedColor}
                className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                onChange={(e) => setPreview((p) => ({ ...p, reservedColor: e.target.value }))}
              />
              <span className="text-xs text-gray-600">Reserved</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <input
                type="color"
                name="soldColor"
                defaultValue={project.soldColor ?? fallback.soldColor}
                className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                onChange={(e) => setPreview((p) => ({ ...p, soldColor: e.target.value }))}
              />
              <span className="text-xs text-gray-600">Sold</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <input
                type="color"
                name="unavailableColor"
                defaultValue={project.unavailableColor ?? fallback.unavailableColor}
                className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                onChange={(e) => setPreview((p) => ({ ...p, unavailableColor: e.target.value }))}
              />
              <span className="text-xs text-gray-600">Unavailable</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 items-end">
          <div className="flex flex-col items-center gap-2">
            <input
              type="color"
              name="primaryColor"
              defaultValue={project.primaryColor ?? fallback.primaryColor}
              className="h-10 w-14 cursor-pointer rounded border border-gray-200"
              onChange={(e) => setPreview((p) => ({ ...p, primaryColor: e.target.value }))}
            />
            <span className="text-xs text-gray-600">Primary</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <input
              type="color"
              name="strokeColor"
              defaultValue={project.strokeColor ?? fallback.strokeColor}
              className="h-10 w-14 cursor-pointer rounded border border-gray-200"
              onChange={(e) => setPreview((p) => ({ ...p, strokeColor: e.target.value }))}
            />
            <span className="text-xs text-gray-600">Stroke</span>
          </div>
          <div>
            <label className="label">Stroke Width</label>
            <input
              type="number"
              name="strokeWidth"
              min={1}
              max={8}
              defaultValue={project.strokeWidth ?? fallback.strokeWidth}
              className="input"
              onChange={(e) => setPreview((p) => ({ ...p, strokeWidth: Number(e.target.value || fallback.strokeWidth) }))}
            />
          </div>
        </div>

        <div>
          <label className="label">Tooltip Style</label>
          <select
            name="tooltipStyle"
            className="input"
            defaultValue={project.tooltipStyle ?? fallback.tooltipStyle}
            onChange={(e) => setPreview((p) => ({ ...p, tooltipStyle: e.target.value }))}
          >
            <option value="modern">Modern (dark, rounded)</option>
            <option value="minimal">Minimal (compact)</option>
            <option value="detailed">Detailed (card with all info)</option>
          </select>
        </div>
      </div>

      {/* live preview */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold mb-3">Live preview</h4>
        <div className="space-y-3">
          <div className="p-3 rounded-md" style={{ background: preview.primaryColor, color: "white" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs">Apartment</div>
                <div className="text-lg font-bold">Apt 101</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{preview.currencySymbol}{(68000).toLocaleString()}</div>
                <div className="text-xs">{(68).toLocaleString()}{preview.areaUnit}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: preview.availableColor }} />
              <span className="text-xs text-gray-600 whitespace-nowrap">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: preview.reservedColor }} />
              <span className="text-xs text-gray-600 whitespace-nowrap">Reserved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: preview.soldColor }} />
              <span className="text-xs text-gray-600 whitespace-nowrap">Sold</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: preview.unavailableColor }} />
              <span className="text-xs text-gray-600 whitespace-nowrap">Unavailable</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Tooltip preview ({preview.tooltipStyle})</p>
            {preview.tooltipStyle === "modern" && (
              <div className="inline-block rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow">Apt 101 — 2 rooms · 65m²</div>
            )}
            {preview.tooltipStyle === "minimal" && (
              <div className="inline-block rounded px-2 py-1 text-xs bg-white border border-gray-200">Apt 101 — 65m²</div>
            )}
            {preview.tooltipStyle === "detailed" && (
              <div className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="font-semibold">Apt 101</div>
                <div className="text-xs text-gray-500">2 rooms · 65m² · {preview.currencySymbol}{(95000).toLocaleString()}</div>
                <div className="mt-2 text-xs">Features: balcony, parking</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
