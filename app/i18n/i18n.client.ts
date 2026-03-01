import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { i18nResources, supportedLngs, fallbackLng, defaultNS } from "./config";

/**
 * Client-side i18n initialization.
 * Uses browser language detector with localStorage persistence.
 * Bulgarian is the default/fallback language.
 */
async function initI18nClient() {
  if (i18n.isInitialized) return i18n;

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: i18nResources,
      supportedLngs: [...supportedLngs],
      fallbackLng,
      defaultNS,
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "i18nextLng",
      },
    });

  return i18n;
}

export default initI18nClient;
