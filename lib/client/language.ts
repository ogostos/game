import { normalizeLanguage } from "@/lib/shared/i18n/language";
import type { Language } from "@/lib/shared/types";

const LANGUAGE_STORAGE_KEY = "imposter-party-language";

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function setStoredLanguage(language: Language): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}
