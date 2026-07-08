import { useState } from "react";
import { getServers } from "../data/loader";
import { checkAndUpdate, DATA_BASE_URL, getLocalDataVersion } from "../data/updater";
import { copyText } from "../lib/clipboard";
import { useStore } from "../store/useStore";
import { destroyPinWindow, showPin } from "../overlay/pins";
import type { Pin, ServerDataBundle } from "../types";

// у Discord нет ссылки на профиль по нику — даём ник с копированием в один клик
const FEEDBACK_DISCORD = "psychokid1488";

// KeyboardEvent -> формат акселератора Tauri ("Ctrl+Alt+F9")
function eventToAccelerator(e: React.KeyboardEvent): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
  let key = e.key;
  if (key === " ") key = "Space";
  else if (/^[a-zа-я]$/i.test(key)) key = key.toUpperCase();
  else if (!/^(F\d{1,2}|\d|[A-Z]|Space|Home|End|Insert|Delete|PageUp|PageDown)$/i.test(key)) return null;
  const mods = [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift"].filter(Boolean);
  return [...mods, key].join("+");
}

interface Props {
  bundle: ServerDataBundle;
  hotkeyErrors: Record<string, string>;
  onDataUpdated: () => void;
}

export function SettingsView({ bundle, hotkeyErrors, onDataUpdated }: Props) {
  const { serverId, setServer, hotkey, setHotkey, autoHide, setAutoHide, pins } = useStore();
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [feedbackCopied, setFeedbackCopied] = useState(false);
  const servers = getServers();

  return (
    <div className="h-full space-y-4 overflow-y-auto pr-1">
      <section>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Сервер
        </div>
        <select
          value={serverId ?? ""}
          onChange={(e) => setServer(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-sky-400/60"
        >
          {servers.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.hasData}>
              {s.name}
              {!s.hasData ? " — база в разработке" : ""}
            </option>
          ))}
        </select>
      </section>

      <section>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Горячая клавиша показа/скрытия
        </div>
        <input
          readOnly
          value={hotkey}
          onKeyDown={(e) => {
            e.preventDefault();
            const acc = eventToAccelerator(e);
            if (acc) setHotkey(acc);
          }}
          placeholder="Нажми комбинацию…"
          className="w-full cursor-pointer rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-sm font-semibold text-sky-300 outline-none focus:border-sky-400/60"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Кликни в поле и нажми клавишу (например F9 или Ctrl+Shift+L). Работает даже когда игра
          в фокусе. Выбирай клавишу, не занятую в игре — надёжнее всего F6–F12 или сочетания с
          Ctrl+Shift.
        </p>
        {hotkeyErrors[hotkey] && (
          <p className="mt-1 text-xs text-red-400">
            Не удалось зарегистрировать: {hotkeyErrors[hotkey]}
          </p>
        )}
      </section>

      <section>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Поведение оверлея
        </div>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <input
            type="checkbox"
            checked={autoHide}
            onChange={(e) => setAutoHide(e.target.checked)}
            className="mt-0.5 accent-sky-500"
          />
          <span className="text-xs text-neutral-300">
            <span className="font-semibold text-neutral-100">Автоскрытие при клике в игру</span>
            <br />
            Оверлей прячется, когда фокус уходит в другое окно (вернуть — {hotkey}). Для второго
            монитора оставь выключенным.
          </span>
        </label>
      </section>

      <section>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Пины — контент в отдельных окнах
        </div>
        {pins.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-500">
            Пинов пока нет. Кнопка 📌 на быстрой фразе или в калькуляторе выносит контент в
            отдельное окошко — назначь ему свободную клавишу, и оно будет всплывать поверх игры без
            основного приложения.
          </p>
        ) : (
          <>
            <p className="mb-1.5 text-xs text-neutral-500">
              Назначай пину клавишу, не занятую в игре — надёжнее всего F6–F12 или сочетания с
              Ctrl+Shift.
            </p>
            <div className="space-y-1.5">
              {pins.map((pin) => (
                <PinRow
                  key={pin.id}
                  pin={pin}
                  error={pin.hotkey ? hotkeyErrors[pin.hotkey] : undefined}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          База законов
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-300">
          <div>
            Данные от: <span className="font-semibold">{bundle.updated || "—"}</span>
          </div>
          <div>
            Версия обновления:{" "}
            <span className="font-semibold">
              {(serverId && getLocalDataVersion(serverId)) || "вшитая в приложение"}
            </span>
          </div>
        </div>
        <button
          disabled={checking}
          onClick={async () => {
            if (!serverId) return;
            setChecking(true);
            setUpdateStatus(null);
            const result = await checkAndUpdate(serverId);
            setChecking(false);
            if (result.error) setUpdateStatus(result.error);
            else if (result.updated) {
              setUpdateStatus(`База обновлена до версии ${result.version}`);
              onDataUpdated();
            } else setUpdateStatus("У тебя уже актуальная версия");
          }}
          className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-neutral-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          {checking ? "Проверяю…" : "Проверить обновления базы"}
        </button>
        {updateStatus && <p className="mt-1 text-xs text-neutral-400">{updateStatus}</p>}
        {!DATA_BASE_URL && (
          <p className="mt-1 text-xs text-neutral-600">
            Источник обновлений появится после публикации репозитория cafhelper-data.
          </p>
        )}
      </section>

      <section>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Обратная связь
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-neutral-300">
          Нашёл ошибку в статье или сценарии — особенно на серверах с пометкой «черновик»?
          Напиши в Discord:
          <button
            onClick={async () => {
              await copyText(FEEDBACK_DISCORD);
              setFeedbackCopied(true);
              setTimeout(() => setFeedbackCopied(false), 1200);
            }}
            className={`ml-1.5 rounded border px-1.5 py-0.5 font-semibold transition ${
              feedbackCopied
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/25"
            }`}
          >
            {feedbackCopied ? "✓ Скопировано" : `⧉ ${FEEDBACK_DISCORD}`}
          </button>
          <span className="mt-1 block text-neutral-500">
            Укажи сервер, статью/сценарий и что не так — исправление прилетит всем с обновлением
            базы.
          </span>
        </div>
      </section>

      <section className="pb-2 text-center text-xs text-neutral-600">
        CafHelper — помощник госструктур Majestic RP.
        <br />
        Esc — скрыть оверлей. Окно можно таскать за шапку.
      </section>
    </div>
  );
}

// Строка управления одним пином: заголовок, хоткей, показать, удалить
function PinRow({ pin, error }: { pin: Pin; error?: string }) {
  const { updatePin, removePin } = useStore();
  const [title, setTitle] = useState(pin.title);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400">
          {pin.kind === "phrase" ? "фраза" : "статьи"}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const t = title.trim();
            if (t && t !== pin.title) updatePin(pin.id, { title: t });
            else setTitle(pin.title);
          }}
          className="min-w-0 flex-1 rounded border border-white/10 bg-neutral-800 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-sky-400/60"
        />
        <button
          title="Показать окно"
          onClick={() => void showPin(pin)}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          Показать
        </button>
        <button
          title="Удалить пин"
          onClick={() => {
            void destroyPinWindow(pin.id);
            removePin(pin.id);
          }}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-red-500/20 hover:text-red-300"
        >
          🗑
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[11px] text-neutral-500">Хоткей:</span>
        <input
          readOnly
          value={pin.hotkey ?? ""}
          onKeyDown={(e) => {
            e.preventDefault();
            const acc = eventToAccelerator(e);
            if (acc) updatePin(pin.id, { hotkey: acc });
          }}
          placeholder="нажми клавишу…"
          className="w-32 cursor-pointer rounded border border-white/10 bg-white/5 px-2 py-1 text-center text-xs font-semibold text-sky-300 outline-none focus:border-sky-400/60"
        />
        {pin.hotkey && (
          <button
            title="Убрать хоткей"
            onClick={() => updatePin(pin.id, { hotkey: undefined })}
            className="rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[11px] text-red-400">
          Клавиша {pin.hotkey} не назначена: {error}
        </p>
      )}
    </div>
  );
}
