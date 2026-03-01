import bg from "./bg.json";
import en from "./en.json";

export const supportedLngs = ["bg", "en"] as const;
export const fallbackLng = "bg";
export const defaultNS = "translation";

export type SupportedLanguage = (typeof supportedLngs)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  bg: "Български",
  en: "English",
};

export const i18nResources = {
  bg: { translation: bg },
  en: { translation: en },
};
