import { useState } from "react";
import type { QuickPhrase } from "../types";
import { copyText } from "../lib/clipboard";

// Кнопка-фраза: один клик — текст в буфере, готов для вставки в чат
export function QuickPhraseChip({ phrase }: { phrase: QuickPhrase }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title={phrase.text}
      onClick={async () => {
        await copyText(phrase.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
        copied
          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
          : "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/25"
      }`}
    >
      {copied ? "✓ Скопировано" : `⧉ ${phrase.label}`}
    </button>
  );
}
