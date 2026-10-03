import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PublicVisualisation } from "~/lib/visualisations/shared";
export function ApartmentVisualisationGallery({
  apartmentId,
  initialItems,
}: {
  apartmentId: string;
  initialItems?: PublicVisualisation[];
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PublicVisualisation[]>(initialItems ?? []);
  const [selected, setSelected] = useState<PublicVisualisation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      setSelected(null);
      return;
    }
    const controller = new AbortController();
    setItems([]);
    setSelected(null);
    fetch(`/api/apartments/${apartmentId}/visualisations`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { visualisations: [] }))
      .then((d) => setItems(d.visualisations || []))
      .catch(() => {});
    return () => controller.abort();
  }, [apartmentId, initialItems]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{t("visualisations.gallery")}</h2>
      <p className="text-xs text-gray-500">{t("visualisations.disclaimer")}</p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rounded-xl border overflow-hidden text-left"
            onClick={() => setSelected(item)}
          >
            <img
              src={item.thumbnailUrl}
              alt={item.label}
              loading="lazy"
              className="w-full aspect-square object-cover"
              onError={() =>
                setItems((xs) => xs.filter((x) => x.id !== item.id))
              }
            />
            <span className="block p-2 text-sm">
              {item.label}
              <span className="block text-xs text-gray-500">
                {t(`visualisations.styles.${item.styleId}.name`)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
        className="rounded-xl p-4 max-w-4xl w-[95vw] backdrop:bg-black/70"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{selected?.label}</h3>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setSelected(null)}
          >
            {t("visualisations.close")}
          </button>
        </div>
        {selected && (
          <img
            src={selected.imageUrl}
            alt={selected.label}
            className="w-full max-h-[75vh] object-contain"
          />
        )}
        <p className="text-xs text-gray-500 mt-2">
          {t("visualisations.disclaimer")}
        </p>
      </dialog>
    </section>
  );
}
