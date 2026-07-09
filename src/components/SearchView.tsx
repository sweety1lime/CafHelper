import { useMemo, useState } from "react";
import type { ServerDataBundle } from "../types";
import type { SearchEngine } from "../search/engine";
import { useStore } from "../store/useStore";
import { ArticleCard } from "./ArticleCard";
import { ScenarioCard } from "./ScenarioCard";
import { RuleCard } from "./RulesView";
import { QuickPhraseChip } from "./QuickPhraseChip";
import { WizardPanel } from "./wizard/WizardPanel";

export function SearchView({
  engine,
  bundle,
}: {
  engine: SearchEngine;
  bundle: ServerDataBundle;
}) {
  const [query, setQuery] = useState("");
  const [showWeak, setShowWeak] = useState(false);
  const results = useMemo(() => engine.search(query), [engine, query]);
  const hasQuery = query.trim().length > 1;
  const favorites = useStore((s) => s.favorites);
  const favoriteArticles = useMemo(
    () => favorites.map((id) => bundle.articles.find((a) => a.id === id)).filter((a) => a != null),
    [favorites, bundle],
  );

  // слабые сценарии/правила не показываем вовсе (статьи дают запасной путь),
  // слабые статьи прячем за разворачиваемым блоком
  const scenarios = results.scenarios.filter((s) => !s.weak);
  const rules = results.rules.filter((r) => !r.weak);
  const strongArticles = results.articles.filter((a) => !a.weak);
  const weakArticles = results.articles.filter((a) => a.weak);

  return (
    <div className="flex h-full flex-col gap-2">
      <input
        autoFocus
        data-onboarding="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Опиши ситуацию или статью…"
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-sky-400/60"
      />

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {!hasQuery && (
          <>
            <div className="mt-1" data-onboarding="wizard">
              <WizardPanel bundle={bundle} />
            </div>
            {bundle.quickPhrases.length > 0 && (
              <div className="mt-1">
                <div
                  className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                  title="Клик по фразе кладёт её в буфер обмена — вставь в чат игры"
                >
                  Быстрое копирование — клик кладёт фразу в буфер
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bundle.quickPhrases.map((p) => (
                    <QuickPhraseChip key={p.label} phrase={p} />
                  ))}
                </div>
              </div>
            )}
            {favoriteArticles.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  ★ Избранное
                </div>
                <div className="space-y-1.5">
                  {favoriteArticles.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {hasQuery &&
          scenarios.length === 0 &&
          rules.length === 0 &&
          results.articles.length === 0 && (
            <p className="mt-4 text-center text-xs text-neutral-500">
              Ничего не найдено. Попробуй другие слова или загляни во вкладку «Кодексы».
            </p>
          )}

        {scenarios.map((s) => (
          <ScenarioCard
            key={s.item.id}
            scenario={s.item}
            articles={bundle.articles}
            defaultOpen={scenarios.length === 1}
          />
        ))}
        {rules.map((r) => (
          <RuleCard key={r.item.docId} rule={r.item} categoryTitle={r.item.categoryTitle} />
        ))}
        {strongArticles.map((a) => (
          <ArticleCard key={a.item.id} article={a.item} matchedTerms={a.matchedTerms} />
        ))}

        {weakArticles.length > 0 && (
          <>
            <button
              onClick={() => setShowWeak((v) => !v)}
              className="mt-1 flex w-full items-center gap-2 text-xs text-neutral-500 transition hover:text-neutral-300"
            >
              <span className="h-px flex-1 bg-white/10" />
              Слабые совпадения ({weakArticles.length}) {showWeak ? "▲" : "▼"}
              <span className="h-px flex-1 bg-white/10" />
            </button>
            {showWeak && (
              <div className="space-y-2 opacity-60">
                {weakArticles.map((a) => (
                  <ArticleCard key={a.item.id} article={a.item} matchedTerms={a.matchedTerms} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
