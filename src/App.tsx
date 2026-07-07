import { useEffect, useMemo, useState } from "react";
import { getServers, loadServerBundle } from "./data/loader";
import type { ServerDataBundle } from "./types";
import { SearchEngine } from "./search/engine";
import { applyGlobalHotkey, hideOverlay } from "./overlay/hotkey";
import { useStore } from "./store/useStore";
import { SearchView } from "./components/SearchView";
import { CodexView } from "./components/CodexView";
import { ScenariosView } from "./components/ScenariosView";
import { SettingsView } from "./components/SettingsView";
import { ServerPicker } from "./components/ServerPicker";
import { CalcBar } from "./components/CalcBar";
import { Onboarding } from "./components/Onboarding";
import "./index.css";

type Tab = "search" | "codex" | "scenarios" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "search", label: "Поиск" },
  { id: "codex", label: "Кодексы" },
  { id: "scenarios", label: "Сценарии" },
  { id: "settings", label: "Настройки" },
];

export default function App() {
  const { serverId, hotkey, autoHide, setServer, onboardingDone } = useStore();
  const [tab, setTab] = useState<Tab>("search");
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  // инкремент заставляет перечитать данные после обновления базы
  const [dataRevision, setDataRevision] = useState(0);

  // база грузится асинхронно (ленивые чанки, см. loader.ts)
  const [bundle, setBundle] = useState<ServerDataBundle | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  useEffect(() => {
    if (!serverId) {
      setBundle(null);
      return;
    }
    let stale = false;
    setBundleLoading(true);
    void loadServerBundle(serverId).then((b) => {
      if (stale) return;
      setBundle(b);
      setBundleLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [serverId, dataRevision]);
  const engine = useMemo(() => (bundle ? new SearchEngine(bundle) : null), [bundle]);

  useEffect(() => {
    applyGlobalHotkey(hotkey).then(setHotkeyError);
  }, [hotkey]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") void hideOverlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // автоскрытие: клик обратно в игру уводит фокус — прячем оверлей (вернуть — хоткей)
  useEffect(() => {
    if (!autoHide) return;
    const onBlur = () => void hideOverlay();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [autoHide]);

  const serverName = getServers().find((s) => s.id === serverId)?.name;

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-xl border border-white/15 bg-neutral-900/95 shadow-2xl">
      {/* Шапка — зона перетаскивания окна */}
      <header
        data-tauri-drag-region
        data-onboarding="header"
        className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2"
      >
        <span data-tauri-drag-region className="text-sm font-bold text-neutral-100">
          Caf<span className="text-sky-400">Helper</span>
        </span>
        {serverName && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-neutral-300">
            {serverName}
          </span>
        )}
        <span data-tauri-drag-region className="flex-1" />
        <span className="text-xs text-neutral-600" title={`${hotkey} — скрыть/показать оверлей`}>
          {hotkey} — скрыть/показать
        </span>
        <button
          title="Скрыть оверлей (Esc)"
          onClick={() => void hideOverlay()}
          className="rounded-md px-2 py-0.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          —
        </button>
      </header>

      {bundleLoading ? (
        <main className="flex flex-1 items-center justify-center text-xs text-neutral-500">
          Загрузка базы…
        </main>
      ) : !bundle || !engine || !serverId ? (
        <main className="flex-1 overflow-hidden p-3">
          <ServerPicker onPick={setServer} />
        </main>
      ) : (
        <>
          <nav className="flex shrink-0 gap-1 px-3 pt-2" data-onboarding="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  tab === t.id
                    ? "bg-white/15 text-white"
                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {bundle.draft && (
            <div className="mx-3 mt-2 shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200/90">
              ⚠ База — черновик: тексты статей требуют сверки с форумом сервера
            </div>
          )}

          <main className="min-h-0 flex-1 p-3">
            {tab === "search" && <SearchView engine={engine} bundle={bundle} />}
            {tab === "codex" && <CodexView bundle={bundle} />}
            {tab === "scenarios" && <ScenariosView bundle={bundle} />}
            {tab === "settings" && (
              <SettingsView
                bundle={bundle}
                hotkeyError={hotkeyError}
                onDataUpdated={() => setDataRevision((r) => r + 1)}
              />
            )}
          </main>

          <CalcBar articles={bundle.articles} />
          {!onboardingDone && <Onboarding />}
        </>
      )}
    </div>
  );
}
