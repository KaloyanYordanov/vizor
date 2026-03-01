import { useTranslation } from "react-i18next";
import { supportedLngs, languageNames, type SupportedLanguage } from "~/i18n/config";

/**
 * Language switcher dropdown.
 * Persists the selected language to localStorage via i18next.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();

  const handleChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <select
      value={i18n.language}
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 ${className}`}
      aria-label="Language"
    >
      {supportedLngs.map((lng) => (
        <option key={lng} value={lng}>
          {languageNames[lng as SupportedLanguage]}
        </option>
      ))}
    </select>
  );
}
