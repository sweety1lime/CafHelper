import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Pin } from "../types";

// Все окна пинов имеют label вида `pin-<id>` — по нему capability pin-* выдаёт права,
// а хоткей-менеджер находит и переключает конкретное окно.
export const PIN_LABEL_PREFIX = "pin-";

export function pinWindowLabel(id: string): string {
  return `${PIN_LABEL_PREFIX}${id}`;
}

// id пина попадает в label окна Tauri, а тот принимает только [a-zA-Z0-9-/:_]
// (кириллица из заголовка фразы не годится) — генерим гарантированно ASCII.
export function newPinId(prefix: "ph" | "art"): string {
  const rnd =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

async function getPinWindow(id: string): Promise<WebviewWindow | null> {
  return WebviewWindow.getByLabel(pinWindowLabel(id));
}

// Создаёт окно пина. Позицию/размер восстанавливает плагин window-state (по label),
// поэтому явные x/y не передаём — только дефолт для самого первого открытия.
function createPinWindow(pin: Pin): WebviewWindow {
  return new WebviewWindow(pinWindowLabel(pin.id), {
    url: `index.html?pin=${encodeURIComponent(pin.id)}`,
    title: pin.title,
    width: 340,
    height: 220,
    minWidth: 220,
    minHeight: 120,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    center: true,
  });
}

// Показать/скрыть окно пина. Первое обращение создаёт окно (сразу видимым),
// дальше просто show/hide — webview остаётся «тёплым», переключение мгновенно.
export async function togglePin(pin: Pin): Promise<void> {
  const win = await getPinWindow(pin.id);
  if (!win) {
    createPinWindow(pin);
    return;
  }
  if (await win.isVisible()) {
    await win.hide();
  } else {
    await win.show();
    await win.setFocus();
  }
}

// Явно показать (из настроек кнопкой «Показать»).
export async function showPin(pin: Pin): Promise<void> {
  const win = await getPinWindow(pin.id);
  if (!win) {
    createPinWindow(pin);
    return;
  }
  await win.show();
  await win.setFocus();
}

// Закрыть и уничтожить окно пина (при удалении пина в настройках).
export async function destroyPinWindow(id: string): Promise<void> {
  const win = await getPinWindow(id);
  if (win) await win.close();
}
