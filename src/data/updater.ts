import { cacheKey } from "./loader";

// Базовый URL репозитория с данными, например:
// "https://raw.githubusercontent.com/<user>/cafhelper-data/main"
// Пустая строка — обновления выключены, используются вшитые в сборку данные.
export const DATA_BASE_URL = "";

const DATA_FILES = ["criminal", "procedural", "administrative", "traffic", "laws", "scenarios"];

export interface UpdateResult {
  updated: boolean;
  version?: string;
  error?: string;
}

function versionKey(serverId: string): string {
  return `cafhelper-data-version:${serverId}`;
}

export function getLocalDataVersion(serverId: string): string | null {
  return localStorage.getItem(versionKey(serverId));
}

// Сверяет версию из manifest.json с локальной; при расхождении
// докачивает JSON выбранного сервера и кладёт их в localStorage.
export async function checkAndUpdate(serverId: string): Promise<UpdateResult> {
  if (!DATA_BASE_URL) {
    return { updated: false, error: "Источник обновлений не настроен (DATA_BASE_URL)" };
  }
  try {
    const resp = await fetch(`${DATA_BASE_URL}/manifest.json`, { cache: "no-store" });
    if (!resp.ok) return { updated: false, error: `manifest.json: HTTP ${resp.status}` };
    const manifest = (await resp.json()) as { version: string };

    if (getLocalDataVersion(serverId) === manifest.version) {
      return { updated: false, version: manifest.version };
    }

    for (const file of DATA_FILES) {
      const fileResp = await fetch(
        `${DATA_BASE_URL}/data/servers/${serverId}/${file}.json`,
        { cache: "no-store" },
      );
      if (fileResp.ok) {
        localStorage.setItem(cacheKey(serverId, file), await fileResp.text());
      }
    }
    localStorage.setItem(versionKey(serverId), manifest.version);
    return { updated: true, version: manifest.version };
  } catch (e) {
    return { updated: false, error: e instanceof Error ? e.message : String(e) };
  }
}
