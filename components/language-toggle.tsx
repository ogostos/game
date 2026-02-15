"use client";

import type { Language } from "@/lib/shared/types";

interface LanguageToggleProps {
  language: Language;
  onChange: (language: Language) => void;
}

export function LanguageToggle({ language, onChange }: LanguageToggleProps) {
  return (
    <div className="pill-row" aria-label="Language selector">
      <button
        type="button"
        className={language === "en" ? "button-secondary" : "button-ghost"}
        onClick={() => onChange("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "ru" ? "button-secondary" : "button-ghost"}
        onClick={() => onChange("ru")}
      >
        RU
      </button>
    </div>
  );
}
