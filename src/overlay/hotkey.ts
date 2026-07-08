import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Pin } from "../types";
import { togglePin } from "./pins";

async function toggleMainWindow(): Promise<void> {
  const win = getCurrentWindow();
  if (await win.isVisible()) {
    await win.hide();
  } else {
    await win.show();
    await win.setFocus();
  }
}

// Регистрирует главный хоткей показа/скрытия + хоткеи всех пинов за один проход.
// Вызывать ТОЛЬКО из главного окна (пины свои шорткаты не регистрируют, иначе
// unregisterAll затирал бы чужие). Возвращает карту ошибок по комбинациям
// (занятая клавиша и т.п.), пустую при полном успехе.
export async function applyAllHotkeys(
  mainHotkey: string,
  pins: Pin[],
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  try {
    await unregisterAll();
  } catch {
    /* нечего снимать — не страшно */
  }

  const bindings: { accel: string; run: () => void }[] = [
    { accel: mainHotkey, run: () => void toggleMainWindow() },
  ];
  const seen = new Set<string>([mainHotkey]);
  for (const pin of pins) {
    if (!pin.hotkey) continue;
    if (seen.has(pin.hotkey)) {
      errors[pin.hotkey] = "клавиша уже занята";
      continue;
    }
    seen.add(pin.hotkey);
    bindings.push({ accel: pin.hotkey, run: () => void togglePin(pin) });
  }

  for (const b of bindings) {
    try {
      await register(b.accel, (event) => {
        if (event.state !== "Pressed") return;
        b.run();
      });
    } catch (e) {
      errors[b.accel] = e instanceof Error ? e.message : String(e);
    }
  }
  return errors;
}

export async function hideOverlay(): Promise<void> {
  await getCurrentWindow().hide();
}
