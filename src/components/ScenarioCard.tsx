import { useState } from "react";
import type { Article, Scenario } from "../types";
import { CODEX_LABELS } from "../types";
import { articleShortRef } from "../lib/clipboard";
import { CopyButton } from "./CopyButton";

interface Props {
  scenario: Scenario;
  articles: Article[]; // все статьи сервера, для резолва articleRefs
  defaultOpen?: boolean;
}

type Section = "refs" | "phrases" | "pitfalls";

// Инлайн-аккордеон внутри карточки: раскрытый сценарий показывает только
// порядок действий, остальное — за кликом (иначе карточка выше окна)
function SectionToggle({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-500 transition hover:text-neutral-300"
      >
        {label} ({count}) <span className="text-[9px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function ScenarioCard({ scenario, articles, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  // при defaultOpen (единственный результат поиска) сразу раскрываем фразы —
  // самое востребованное в игре
  const [sections, setSections] = useState<Set<Section>>(
    () => new Set(defaultOpen ? (["phrases"] as Section[]) : []),
  );
  const toggleSection = (s: Section) =>
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const refs = scenario.articleRefs.map((ref) => {
    const article = articles.find((a) => a.codex === ref.codex && a.number === ref.number);
    return { ref, article };
  });

  return (
    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
          Сценарий
        </span>
        <span className="flex-1 text-sm font-medium text-neutral-100">{scenario.title}</span>
        <span className="text-xs text-neutral-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3">
          <p className="text-xs italic text-neutral-400 select-text">{scenario.situation}</p>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Порядок действий
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-neutral-200 select-text">
              {scenario.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <SectionToggle
            label="На что ссылаться"
            count={refs.length}
            open={sections.has("refs")}
            onToggle={() => toggleSection("refs")}
          >
            <div className="flex flex-wrap gap-1.5">
              {refs.map(({ ref, article }, i) => (
                <span
                  key={i}
                  title={
                    ref.unverified
                      ? "Перенесено с другого сервера автоматически и не сверено — проверь статью во вкладке «Кодексы»"
                      : article
                        ? `${article.title}${ref.note ? ` (${ref.note})` : ""}`
                        : ref.note
                  }
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                    ref.unverified
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {ref.unverified && "⚠ "}
                  {CODEX_LABELS[ref.codex].short} {ref.number}
                  {ref.unverified && <span className="text-[9px] text-amber-300/70">не сверено</span>}
                  {article && !ref.unverified && <CopyButton text={articleShortRef(article)} />}
                </span>
              ))}
            </div>
          </SectionToggle>

          <SectionToggle
            label="Готовые фразы"
            count={scenario.phrases.length}
            open={sections.has("phrases")}
            onToggle={() => toggleSection("phrases")}
          >
            <div className="space-y-1">
              {scenario.phrases.map((phrase, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 rounded bg-white/5 px-2 py-1.5 text-xs leading-relaxed text-neutral-200"
                >
                  <span className="flex-1 select-text">{phrase}</span>
                  <CopyButton text={phrase} title="Скопировать фразу" />
                </div>
              ))}
            </div>
          </SectionToggle>

          <SectionToggle
            label="На чём ловят"
            count={scenario.pitfalls.length}
            open={sections.has("pitfalls")}
            onToggle={() => toggleSection("pitfalls")}
          >
            <ul className="space-y-1 text-xs leading-relaxed text-amber-200/90 select-text">
              {scenario.pitfalls.map((pitfall, i) => (
                <li key={i}>⚠ {pitfall}</li>
              ))}
            </ul>
          </SectionToggle>
        </div>
      )}
    </div>
  );
}
