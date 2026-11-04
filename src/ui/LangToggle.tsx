"use client";

import { setLang, useLang, useT } from "@/i18n";
import { common } from "@/i18n/dict/common";
import { Segmented } from "./Segmented";

export function LangToggle({ className }: { className?: string }) {
  const lang = useLang();
  const t = useT(common);
  return (
    <Segmented
      aria-label={t.language}
      className={`ui-lang type-mono-s ${className ?? ""}`}
      value={lang}
      onChange={setLang}
      options={[
        { value: "en", label: "EN" },
        { value: "de", label: "DE" },
      ]}
    />
  );
}
