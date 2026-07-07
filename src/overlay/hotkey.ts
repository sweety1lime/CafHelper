import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Регистрирует глобальный хоткей показа/скрытия оверлея.
// Возвращает null при успехе или текст ошибки (занятая комбинация и т.п.).
export async function applyGlobalHotkey(hotkey: string): Promise<string | null> {
  try {
    await unregisterAll();
    await register(hotkey, async (event) => {
      if (event.state !== "Pressed") return;
      const win = getCurrentWindow();
      if (await win.isVisible()) {
        await win.hide();
      } else {
        await win.show();
        await win.setFocus();
      }
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export async function hideOverlay(): Promise<void> {
  await getCurrentWindow().hide();
}
