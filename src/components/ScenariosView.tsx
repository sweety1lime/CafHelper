import type { ServerDataBundle } from "../types";
import { ScenarioCard } from "./ScenarioCard";

export function ScenariosView({ bundle }: { bundle: ServerDataBundle }) {
  return (
    <div className="h-full space-y-2 overflow-y-auto pr-1">
      {bundle.scenarios.length === 0 && (
        <p className="mt-4 text-center text-xs text-neutral-500">
          Для этого сервера пока нет сценариев.
        </p>
      )}
      {bundle.scenarios.map((s) => (
        <ScenarioCard key={s.id} scenario={s} articles={bundle.articles} />
      ))}
    </div>
  );
}
