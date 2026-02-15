"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { getStoredLanguage, setStoredLanguage } from "@/lib/client/language";
import type { Language } from "@/lib/shared/types";

const COPY = {
  en: {
    title: "Page not found",
    description: "This page does not exist in this game box.",
    back: "Back to home"
  },
  ru: {
    title: "Страница не найдена",
    description: "Такой страницы нет в этой игровой коробке.",
    back: "На главную"
  }
} as const;

export default function NotFoundPage() {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  function updateLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
  }

  const copy = COPY[language];

  return (
    <main className="shell stack-xl">
      <section className="panel stack-md">
        <div className="row-wrap space-between">
          <p className="eyebrow">404</p>
          <LanguageToggle language={language} onChange={updateLanguage} />
        </div>
        <h1 className="title-lg">{copy.title}</h1>
        <p className="muted">{copy.description}</p>
        <Link href="/" className="text-link">
          {copy.back}
        </Link>
      </section>
    </main>
  );
}
