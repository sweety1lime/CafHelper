import type { Article } from "../types";
import { CODEX_LABELS } from "../types";
import { calcClipboardString, summarizeCalc, yearsWord } from "../lib/penalty";
import { useStore } from "../store/useStore";
import { CopyButton } from "./CopyButton";

// Панель калькулятора наказаний: суммирует сроки и штрафы отмеченных статей
export function CalcBar({ articles }: { articles: Article[] }) {
  const { calc, toggleCalc, clearCalc } = useStore();
  const selected = calc
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is Article => Boolean(a));
  if (selected.length === 0) return null;

  const sum = summarizeCalc(selected);

  return (
    <div className="shrink-0 border-t border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-emerald-300">
          Калькулятор · {selected.length} ст.
        </span>
        <span className="flex-1 text-xs text-neutral-200">
          {sum.years > 0 && (
            <span className="mr-2">
              срок: <b>до {sum.years} {yearsWord(sum.years)}</b>
            </span>
          )}
          {sum.fine > 0 && (
            <span>
              штраф: <b>до ${sum.fine.toLocaleString("en-US")}</b>
            </span>
          )}
        </span>
        <CopyButton
          text={calcClipboardString(selected, sum)}
          title="Скопировать строку для рапорта"
        />
        <button
          title="Очистить калькулятор"
          onClick={clearCalc}
          className="rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {selected.map((a) => (
          <button
            key={a.id}
            title={`${a.title} — убрать`}
            onClick={() => toggleCalc(a.id)}
            className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-neutral-300 transition hover:bg-red-500/20 hover:text-red-300"
          >
            {CODEX_LABELS[a.codex].short} {a.number} ✕
          </button>
        ))}
      </div>
    </div>
  );
}
