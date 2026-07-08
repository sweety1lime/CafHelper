import { useState } from "react";
import type { QuickPhrase } from "../types";
import { copyText } from "../lib/clipboard";
import { useStore } from "../store/useStore";
import { newPinId, showPin } from "../overlay/pins";

// Кнопка-фраза: клик по тексту — в буфер; 📌 — вынести в отдельное окно-пин
export function QuickPhraseChip({ phrase }: { phrase: QuickPhrase }) {
  const [copied, setCopied] = useState(false);
  const { pins, addPin } = useStore();
  // пин этой фразы уже есть? тогда 📌 просто показывает окно
  const existing = pins.find((p) => p.kind === "phrase" && p.title === phrase.label);

  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-md border transition ${
        copied
          ? "border-emerald-500/50 bg-emerald-500/20"
          : "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/25"
      }`}
    >
      <button
        title={phrase.text}
        onClick={async () => {
          await copyText(phrase.text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className={`px-2.5 py-1.5 text-xs font-semibold transition ${
          copied ? "text-emerald-300" : "text-sky-200"
        }`}
      >
        {copied ? "✓ Скопировано" : `⧉ ${phrase.label}`}
      </button>
      <button
        title={existing ? "Показать окно-пин" : "Вынести в отдельное окно"}
        onClick={() => {
          if (existing) {
            void showPin(existing);
            return;
          }
          const pin = {
            id: newPinId("ph"),
            title: phrase.label,
            kind: "phrase" as const,
            text: phrase.text,
          };
          addPin(pin);
          void showPin(pin);
        }}
        className={`border-l border-white/10 px-1.5 text-xs transition hover:bg-white/10 ${
          existing ? "text-sky-300" : "text-neutral-400 hover:text-white"
        }`}
      >
        📌
      </button>
    </span>
  );
}
