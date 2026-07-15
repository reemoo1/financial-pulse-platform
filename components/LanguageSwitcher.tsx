"use client";

import { Globe2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageSwitcher() {
  const { locale, toggleLocale } = useLanguage();
  const isArabic = locale === "ar";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="language-switcher"
      aria-label={isArabic ? "Switch language to English" : "تغيير اللغة إلى العربية"}
      title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
      data-no-translate
    >
      <Globe2 className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{isArabic ? "English" : "العربية"}</span>
      <span className="sm:hidden">{isArabic ? "EN" : "ع"}</span>
      <span className="language-switcher-code" aria-hidden="true">
        {isArabic ? "EN" : "AR"}
      </span>
    </button>
  );
}
