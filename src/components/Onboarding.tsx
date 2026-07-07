import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

// Одноразовый тур при первом запуске: 4 подсказки с подсветкой элемента.
// Цели помечены атрибутом data-onboarding="…"; рамка рисуется по
// getBoundingClientRect — без порталов и сторонних библиотек.
const STEPS: { target: string; text: (hotkey: string) => string }[] = [
  {
    target: "search",
    text: () => "Опиши ситуацию своими словами — например «ствол за спиной». Поиск понимает жаргон и опечатки.",
  },
  {
    target: "wizard",
    text: () => "Не знаешь, с чего начать? Выбери ситуацию — соберу порядок действий, статьи и готовые фразы.",
  },
  {
    target: "tabs",
    text: () => "«Кодексы» — полные тексты законов. «Сценарии» — пошаговые инструкции с фразами для чата.",
  },
  {
    target: "header",
    text: (hotkey) => `Esc скрывает окно, ${hotkey} открывает снова. Окно можно перетаскивать за шапку.`,
  },
];

export function Onboarding() {
  const { hotkey, setOnboardingDone } = useStore();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(`[data-onboarding="${STEPS[step].target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={setOnboardingDone} />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-sky-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-neutral-900 p-3 shadow-2xl">
        <p className="text-xs leading-relaxed text-neutral-200">{STEPS[step].text(hotkey)}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-4 rounded-full ${i <= step ? "bg-sky-400" : "bg-white/15"}`}
              />
            ))}
          </div>
          <button
            onClick={setOnboardingDone}
            className="px-2 py-1 text-xs text-neutral-500 transition hover:text-neutral-300"
          >
            Пропустить
          </button>
          <button
            onClick={() => (last ? setOnboardingDone() : setStep(step + 1))}
            className="rounded-md bg-sky-500/25 px-3 py-1 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/40"
          >
            {last ? "Понятно" : "Далее"}
          </button>
        </div>
      </div>
    </div>
  );
}
