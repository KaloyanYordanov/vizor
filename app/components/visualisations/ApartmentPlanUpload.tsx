import { useState } from "react";
import { useTranslation } from "react-i18next";
export function ApartmentPlanUpload({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <div className="space-y-2">
      <input
        name="floorPlanUrl"
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="/uploads/plan.png"
      />
      <label className="btn-secondary btn-sm cursor-pointer">
        {t(busy ? "visualisations.uploading" : "visualisations.upload")}
        <input
          type="file"
          className="sr-only"
          disabled={busy}
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError(false);
            try {
              const form = new FormData();
              form.set("file", file);
              const res = await fetch("/api/upload", {
                method: "POST",
                body: form,
              });
              if (!res.ok) throw new Error();
              const data = await res.json();
              setValue(data.url);
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {t("visualisations.errors.INVALID_IMAGE")}
        </p>
      )}
    </div>
  );
}
