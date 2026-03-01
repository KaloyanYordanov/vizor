import { useState, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import { useTranslation } from "react-i18next";
import { PolygonEditor, type DrawnPolygon } from "~/components/PolygonEditor";

interface LinkableItem {
  id: string;
  number: string;
  status: string;
}

interface ImagePolygonMapperProps {
  /** Current image URL (null if none uploaded yet) */
  imageUrl: string | null;
  /** Initial polygon data */
  initialPolygons: DrawnPolygon[];
  /** Items to link polygons to (apartments or floors) */
  items: LinkableItem[];
  /** Label for the linkable item type */
  itemLabel: string;
  /** Form field name/value pairs to include with the image-save submission */
  imageSaveFields: Record<string, string>;
  /** Intent name for saving the image URL */
  imageSaveIntent: string;
  /** Form field name/value pairs to include with the polygon-save submission */
  polygonSaveFields: Record<string, string>;
  /** Intent name for saving polygons */
  polygonSaveIntent: string;
  /** Accepted file types */
  accept?: string;
  /** Upload button label */
  uploadLabel?: string;
  /** Description text shown above the upload button */
  description?: string;
}

/**
 * Shared component for image upload + polygon drawing + save.
 * Used for both building-level (floors) and floor-level (apartments) polygon mapping.
 */
export function ImagePolygonMapper({
  imageUrl,
  initialPolygons,
  items,
  itemLabel,
  imageSaveFields,
  imageSaveIntent,
  polygonSaveFields,
  polygonSaveIntent,
  accept = "image/png,image/jpeg,image/webp",
  uploadLabel = "Upload Image",
  description,
}: ImagePolygonMapperProps) {
  const imageFetcher = useFetcher();
  const polygonFetcher = useFetcher();
  const [isUploading, setIsUploading] = useState(false);
  const [polygons, setPolygons] = useState<DrawnPolygon[]>(initialPolygons);
  const { t } = useTranslation();

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          imageFetcher.submit(
            { intent: imageSaveIntent, imageUrl: data.url, ...imageSaveFields },
            { method: "post" }
          );
        }
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [imageFetcher, imageSaveIntent, imageSaveFields]
  );

  const handleSavePolygons = useCallback(() => {
    polygonFetcher.submit(
      {
        intent: polygonSaveIntent,
        polygons: JSON.stringify(polygons),
        ...polygonSaveFields,
      },
      { method: "post" }
    );
  }, [polygonFetcher, polygonSaveIntent, polygonSaveFields, polygons]);

  const isPolygonSaving = polygonFetcher.state !== "idle";
  const polygonResult = polygonFetcher.data as
    | { success?: boolean; message?: string; error?: string }
    | undefined;

  return (
    <div className="space-y-3">
      {description && <p className="text-xs text-gray-500">{description}</p>}

      {/* Upload control */}
      <div className="flex items-center gap-3">
        <label className="btn-secondary btn-sm cursor-pointer relative">
          {isUploading ? t("upload.uploading") : uploadLabel}
          <input
            type="file"
            accept={accept}
            onChange={handleImageUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isUploading}
          />
        </label>
        {imageUrl && (
          <span className="text-xs text-gray-400 truncate max-w-[200px]">
            {imageUrl}
          </span>
        )}
      </div>

      {/* Polygon Editor */}
      {imageUrl && (
        <div className="space-y-3">
          <PolygonEditor
            imageUrl={imageUrl}
            polygons={polygons}
            apartments={items}
            itemLabel={itemLabel}
            onPolygonsChange={setPolygons}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSavePolygons}
              className="btn-primary btn-sm"
              disabled={isPolygonSaving}
            >
              {isPolygonSaving ? t("upload.saving") : t("upload.savePolygonMappings", { label: itemLabel })}
            </button>
            {polygonResult && !isPolygonSaving && (
              <span
                className={`text-xs ${
                  polygonResult.error ? "text-red-600" : "text-green-600"
                }`}
              >
                {polygonResult.error || polygonResult.message || t("upload.saved")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
