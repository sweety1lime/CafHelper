import { useMemo, useState } from "react";
import type { ServerDataBundle, WizardNode, WizardOption } from "../../types";
import { getWizardTree } from "../../data/loader";
import { WizardAnswer } from "./WizardAnswer";

// Мастер ситуаций: «Что происходит?» -> чипы -> собранный ответ.
// Живёт в пустом состоянии вкладки «Поиск»; ввод текста в поиск его скрывает.
export function WizardPanel({ bundle }: { bundle: ServerDataBundle }) {
  const tree = useMemo(getWizardTree, []);
  const nodeById = useMemo(
    () => new Map<string, WizardNode>(tree.nodes.map((n) => [n.id, n])),
    [tree],
  );
  // выбранные опции от корня; последняя может указывать на answer (лист)
  const [path, setPath] = useState<WizardOption[]>([]);

  const current = path.length === 0 ? nodeById.get(tree.root) : undefined;
  const last = path[path.length - 1];
  const node = last?.next ? nodeById.get(last.next) : current;
  const answer = last?.answer;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] p-2.5">
      {path.length === 0 ? (
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Или выбери ситуацию
        </div>
      ) : (
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
          {path.map((opt, i) => (
            <button
              key={opt.id}
              // клик по крошке возвращает к вопросу, который шёл ПОСЛЕ этого выбора
              onClick={() => setPath(path.slice(0, i + 1))}
              title="Вернуться к этому шагу"
              className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300 transition hover:bg-sky-500/30"
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setPath([])}
            className="ml-1 text-neutral-500 transition hover:text-neutral-300"
          >
            ✕ сначала
          </button>
        </div>
      )}

      {answer ? (
        <WizardAnswer answer={answer} bundle={bundle} />
      ) : node ? (
        <div>
          <div className="mb-1.5 text-xs text-neutral-400">{node.question}</div>
          <div className="flex flex-wrap gap-1.5">
            {node.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPath([...path, opt])}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-sky-400/40 hover:bg-sky-500/10"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
