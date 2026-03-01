import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { i18nResources, supportedLngs, fallbackLng, defaultNS } from "./config";

/**
 * Server-side i18n instance factory.
 * Creates a fresh i18n instance for each request to avoid state leaking between requests.
 * Defaults to Bulgarian.
 */
export async function createI18nServerInstance(lng?: string): Promise<I18nInstance> {
  const instance = i18n.createInstance();

  await instance.use(initReactI18next).init({
    resources: i18nResources,
    supportedLngs: [...supportedLngs],
    fallbackLng,
    defaultNS,
    lng: lng || fallbackLng,
    interpolation: { escapeValue: false },
  });

  return instance;
}
