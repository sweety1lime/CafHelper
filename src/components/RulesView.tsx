import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getRules } from "../data/loader";
import type { Rule } from "../types";

// Вкладка «Правила»: OOC/RP-правила проекта (ограбления, похищения, DM/RK/PG),
// общие для всех серверов. Выбор категории сверху, ниже — карточки правил.
export function RulesView() {
  const { categories, updated } = getRules();
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const cat = categories.find((c) => c.id === active) ?? categories[0];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap gap-1">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              c.id === cat?.id
                ? "bg-white/15 text-white"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      {cat && (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {cat.intro && <p className="text-xs text-neutral-400">{cat.intro}</p>}
          {cat.rules.map((r) => (
            <RuleCard key={r.id} rule={r} />
          ))}
          <button
            onClick={() => void openUrl(cat.source).catch(() => {})}
            className="mt-1 text-[10px] text-neutral-600 underline decoration-dotted transition hover:text-neutral-400"
          >
            Источник на форуме
          </button>
          <p className="pb-1 text-[10px] text-neutral-600">
            Правила от: {updated}. Финальное слово — за администрацией сервера.
          </p>
        </div>
      )}
    </div>
  );
}

export function RuleCard({ rule, categoryTitle }: { rule: Rule; categoryTitle?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      {categoryTitle && (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300/80">
          Правила · {categoryTitle}
        </div>
      )}
      <div className="flex items-start gap-2">
        {rule.code && (
          <span className="mt-0.5 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-300">
            {rule.code}
          </span>
        )}
        <span className="flex-1 text-sm font-medium text-neutral-100">{rule.title}</span>
      </div>
      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-300 select-text">
        {rule.text}
      </p>
      {rule.punishment && (
        <div className="mt-1 text-xs text-amber-300/90">⚖ {rule.punishment}</div>
      )}
      {rule.forOfficer && (
        <div className="mt-1.5 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-xs text-sky-200/90">
          <span className="font-semibold text-sky-300">Сотруднику: </span>
          {rule.forOfficer}
        </div>
      )}
    </div>
  );
}
