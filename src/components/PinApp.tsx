import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { restoreStateCurrent, StateFlags } from "@tauri-apps/plugin-window-state";
import { useStore } from "../store/useStore";
import { copyText } from "../lib/clipboard";
import { CopyButton } from "./CopyButton";

// Мини-окно закреплённого контента (пина). Рендерится вместо основного App,
// когда окно открыто с ?pin=<id> (см. main.tsx). Читает пин из общего стора.
export function PinApp({ pinId }: { pinId: string }) {
  const pin = useStore((s) => s.pins.find((p) => p.id === pinId));

  // окно создаётся из JS — просим плагин вернуть его туда, где оставили
  useEffect(() => {
    restoreStateCurrent(StateFlags.POSITION | StateFlags.SIZE).catch(() => {});
  }, []);

  // Esc — скрыть окно (не закрыть: хоткей вернёт его мгновенно)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") void getCurrentWindow().hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // правки пина из главного окна долетают через localStorage другого окна
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cafhelper-settings") void useStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-xl border border-white/15 bg-neutral-900/95 shadow-2xl">
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2"
      >
        <span data-tauri-drag-region className="flex-1 truncate text-sm font-semibold text-neutral-100">
          {pin?.title ?? "Пин"}
        </span>
        <button
          title="Скрыть (Esc)"
          onClick={() => void getCurrentWindow().hide()}
          className="rounded-md px-2 py-0.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          —
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {!pin ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-neutral-500">
            Пин удалён. Закрой это окно.
          </div>
        ) : pin.kind === "phrase" ? (
          <PhraseBody text={pin.text} />
        ) : (
          <ArticlesBody items={pin.items} />
        )}
      </main>
    </div>
  );
}

function PhraseBody({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <p className="flex-1 select-text whitespace-pre-line text-sm leading-relaxed text-neutral-200">
        {text}
      </p>
      <button
        onClick={() => void copyText(text)}
        className="shrink-0 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25"
      >
        ⧉ Скопировать
      </button>
    </div>
  );
}

function ArticlesBody({ items }: { items: { articleId: string; ref: string; text?: string; punishment?: string }[] }) {
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-500">
        Список пуст.
      </div>
    );
  }
  const allRefs = items.map((i) => i.ref).join("\n");
  return (
    <div className="space-y-1.5">
      <button
        onClick={() => void copyText(allRefs)}
        className="w-full rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
      >
        ⧉ Скопировать все ({items.length})
      </button>
      {items.map((item) => (
        <div
          key={item.articleId}
          className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-neutral-100">{item.ref}</div>
            {item.punishment && (
              <div className="mt-0.5 text-[11px] text-amber-300/90">⚖ {item.punishment}</div>
            )}
          </div>
          <CopyButton text={item.ref} title="Скопировать ссылку" />
        </div>
      ))}
    </div>
  );
}
