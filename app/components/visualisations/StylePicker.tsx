import { useTranslation } from "react-i18next";
import { styles, type StyleId } from "~/lib/visualisations/shared";
export function StylePicker({
  value,
  onChange,
}: {
  value: StyleId;
  onChange: (s: StyleId) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="text-lg font-semibold mb-3">
        {t("visualisations.chooseStyle")}
      </legend>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {styles.map((s) => (
          <label
            key={s.id}
            className={`rounded-xl border-2 cursor-pointer overflow-hidden ${value === s.id ? "border-brand-500 ring-2 ring-brand-100" : "border-gray-200"}`}
          >
            <img
              src={`/images/visualisation-styles/${s.id}.webp`}
              alt={t(`visualisations.styles.${s.id}.name`)}
              className="w-full aspect-[3/2] object-cover"
              loading="lazy"
            />
            <div className="p-3">
              <span className="flex gap-2 items-center font-medium">
                <input
                  type="radio"
                  aria-label={t(`visualisations.styles.${s.id}.name`)}
                  name="style"
                  checked={value === s.id}
                  onChange={() => onChange(s.id)}
                />
                {t(`visualisations.styles.${s.id}.name`)}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {t(`visualisations.styles.${s.id}.description`)}
              </p>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {t("visualisations.stylePreviewHint")}
      </p>
    </fieldset>
  );
}
