import { useMemo, useState } from "react";
import type { CodexId, ServerDataBundle } from "../types";
import { CODEX_IDS, CODEX_LABELS } from "../types";
import { ArticleCard } from "./ArticleCard";

export function CodexView({ bundle }: { bundle: ServerDataBundle }) {
  const [codex, setCodex] = useState<CodexId>("criminal");
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  const chapters = useMemo(() => {
    const byChapter = new Map<string, typeof bundle.articles>();
    for (const article of bundle.articles) {
      if (article.codex !== codex) continue;
      const list = byChapter.get(article.chapter) ?? [];
      list.push(article);
      byChapter.set(article.chapter, list);
    }
    return [...byChapter.entries()];
  }, [bundle, codex]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-5 gap-1">
        {CODEX_IDS.map((id) => (
          <button
            key={id}
            onClick={() => {
              setCodex(id);
              setOpenChapter(null);
            }}
            title={bundle.codexNames[id] ?? CODEX_LABELS[id].full}
            className={`rounded-md px-1 py-1 text-xs font-semibold transition ${
              codex === id
                ? "bg-sky-500/25 text-sky-200"
                : "bg-white/5 text-neutral-400 hover:bg-white/10"
            }`}
          >
            {CODEX_LABELS[id].short}
            <span
              className={`block text-[9px] font-normal ${
                codex === id ? "text-sky-300/70" : "text-neutral-600"
              }`}
            >
              {CODEX_LABELS[id].nav}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        <div className="text-xs font-medium text-neutral-400">
          {bundle.codexNames[codex] ?? CODEX_LABELS[codex].full}
        </div>
        {chapters.length === 0 && (
          <p className="mt-4 text-center text-xs text-neutral-500">
            Для этого кодекса на выбранном сервере пока нет данных.
          </p>
        )}
        {chapters.map(([chapter, articles]) => {
          const open = openChapter === chapter;
          return (
            <div key={chapter}>
              <button
                className="flex w-full items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-left text-xs font-semibold text-neutral-200 transition hover:bg-white/10"
                onClick={() => setOpenChapter(open ? null : chapter)}
              >
                <span className="flex-1">{chapter}</span>
                <span className="text-neutral-500">{open ? "▲" : `${articles.length} ▼`}</span>
              </button>
              {open && (
                <div className="mt-1.5 space-y-1.5">
                  {articles.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
