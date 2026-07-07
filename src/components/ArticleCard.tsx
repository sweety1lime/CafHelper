import { useState } from "react";
import type { Article } from "../types";
import { CODEX_LABELS } from "../types";
import { articleShortRef } from "../lib/clipboard";
import { copyText } from "../lib/clipboard";
import { useStore } from "../store/useStore";
import { CopyButton } from "./CopyButton";

function PriorityStars({ value }: { value: string }) {
  const n = parseInt(value, 10);
  if (!n || n < 1) return <span className="text-red-300/90">★ розыск {value}</span>;
  return (
    <span className="text-red-400/90" title={`Приоритет розыска ${n} из 5`}>
      <span className="mr-1 text-red-300/80">приоритет {n}</span>
      {"★".repeat(Math.min(n, 6))}
      <span className="text-white/15">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

// Человекочитаемые бейджи вместо сырых «F/R/CR»
const FLAG_BADGES: Record<string, { label: string; cls: string; hint: string }> = {
  F: { label: "Федеральная", cls: "bg-red-500/15 text-red-300", hint: "Федеральная статья" },
  R: { label: "Розыск", cls: "bg-amber-500/15 text-amber-300", hint: "Выдаётся розыск" },
  CR: { label: "Через суд", cls: "bg-violet-500/15 text-violet-300", hint: "Наказание назначает суд" },
};

function FlagBadges({ flags }: { flags: string }) {
  const tokens = flags.split(/[/,\s()]+/).filter(Boolean);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tokens.map((t, i) => {
        const badge = FLAG_BADGES[t.toUpperCase()];
        return badge ? (
          <span key={i} title={badge.hint} className={`rounded px-1 py-px text-[10px] font-medium ${badge.cls}`}>
            {badge.label}
          </span>
        ) : (
          <span key={i} className="text-neutral-500">
            {t}
          </span>
        );
      })}
    </span>
  );
}

export function ArticleCard({
  article,
  matchedTerms,
}: {
  article: Article;
  matchedTerms?: string[]; // чем совпал поиск — показывается только в результатах
}) {
  const [open, setOpen] = useState(false);
  const { favorites, toggleFavorite, calc, toggleCalc, calcHintSeen } = useStore();
  const isFavorite = favorites.includes(article.id);
  const inCalc = calc.includes(article.id);
  const label = CODEX_LABELS[article.codex].short;

  return (
    <div
      className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition hover:border-white/20"
      onClick={() => setOpen((v) => !v)}
    >
      <div className="flex items-start gap-2">
        <button
          title={isFavorite ? "Убрать из избранного" : "В избранное"}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(article.id);
          }}
          className={`mt-0.5 shrink-0 text-sm leading-none transition ${
            isFavorite ? "text-amber-300" : "text-neutral-600 hover:text-neutral-300"
          }`}
        >
          {isFavorite ? "★" : "☆"}
        </button>
        <span className="mt-0.5 shrink-0 rounded bg-sky-500/20 px-1.5 py-0.5 text-xs font-semibold text-sky-300">
          {label} {article.number}
        </span>
        <span className="flex-1 text-sm font-medium text-neutral-100">
          {article.title}
          {article.codex === "laws" && (
            <span className="mt-0.5 block text-xs font-normal text-neutral-500">
              {article.chapter}
            </span>
          )}
        </span>
        {article.punishment && (
          <button
            title={
              inCalc
                ? "Убрать из калькулятора"
                : "Добавить в калькулятор наказаний — внизу появится сумма срока и штрафа"
            }
            onClick={(e) => {
              e.stopPropagation();
              toggleCalc(article.id);
            }}
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold transition ${
              inCalc
                ? "bg-emerald-500/25 text-emerald-300"
                : calcHintSeen
                  ? "text-neutral-500 hover:bg-white/10 hover:text-white"
                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90 hover:bg-emerald-500/25"
            }`}
          >
            {/* до первого использования кнопка подписана — так её находят новички */}
            {inCalc ? "✓" : calcHintSeen ? "+" : "＋ срок"}
          </button>
        )}
        <CopyButton text={articleShortRef(article)} title="Скопировать ссылку на статью" />
      </div>
      {(article.punishment || article.priority || article.flags) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          {article.punishment && <span className="text-amber-300/90">⚖ {article.punishment}</span>}
          {article.priority && <PriorityStars value={article.priority} />}
          {article.flags && <FlagBadges flags={article.flags} />}
        </div>
      )}
      {matchedTerms && matchedTerms.length > 0 && (
        <div className="mt-0.5 truncate text-[10px] text-neutral-500">
          совпало: {matchedTerms.slice(0, 5).join(", ")}
        </div>
      )}
      {open && (
        <>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-neutral-300 select-text">
            {article.text}
          </p>
          {/* подписанные действия — те же кнопки, что иконки в шапке карточки */}
          <div
            className="mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => toggleFavorite(article.id)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-400 transition hover:border-white/25 hover:text-neutral-200"
            >
              {isFavorite ? "★ Убрать из избранного" : "☆ В избранное"}
            </button>
            {article.punishment && (
              <button
                onClick={() => toggleCalc(article.id)}
                className={`rounded-md border px-2 py-1 text-[10px] transition ${
                  inCalc
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200"
                }`}
              >
                {inCalc ? "✓ В калькуляторе" : "＋ В калькулятор наказаний"}
              </button>
            )}
            <button
              onClick={() => void copyText(articleShortRef(article))}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-neutral-400 transition hover:border-white/25 hover:text-neutral-200"
            >
              ⧉ Скопировать ссылку
            </button>
          </div>
        </>
      )}
    </div>
  );
}
