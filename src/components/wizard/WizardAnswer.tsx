import type { ServerDataBundle, WizardAnswerData } from "../../types";
import { ScenarioCard } from "../ScenarioCard";
import { QuickPhraseChip } from "../QuickPhraseChip";

// Собранный ответ мастера: подсказки + быстрые фразы + карточки сценариев.
// scenarioIds/phraseLabels резолвятся по базе выбранного сервера,
// поэтому номера статей внутри всегда серверные.
export function WizardAnswer({
  answer,
  bundle,
}: {
  answer: WizardAnswerData;
  bundle: ServerDataBundle;
}) {
  const scenarios = answer.scenarioIds
    .map((id) => bundle.scenarios.find((s) => s.id === id))
    .filter((s) => s != null);
  const phrases = (answer.phraseLabels ?? [])
    .map((label) => bundle.quickPhrases.find((p) => p.label === label))
    .filter((p) => p != null);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-neutral-100">{answer.title}</div>

      {answer.tips && answer.tips.length > 0 && (
        <ul className="space-y-1 text-xs leading-relaxed text-amber-200/90 select-text">
          {answer.tips.map((tip, i) => (
            <li key={i}>⚠ {tip}</li>
          ))}
        </ul>
      )}

      {phrases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {phrases.map((p) => (
            <QuickPhraseChip key={p.label} phrase={p} />
          ))}
        </div>
      )}

      {scenarios.map((s) => (
        <ScenarioCard
          key={s.id}
          scenario={s}
          articles={bundle.articles}
          defaultOpen={scenarios.length === 1}
        />
      ))}
    </div>
  );
}
