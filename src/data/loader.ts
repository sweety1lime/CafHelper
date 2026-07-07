import type {
  Article,
  CodexFile,
  CodexId,
  ScenarioFile,
  ServerDataBundle,
  ServerInfo,
  SynonymGroup,
  WizardFile,
} from "../types";
import { CODEX_IDS } from "../types";
import serversJson from "../../data/servers.json";
import synonymsJson from "../../data/common/synonyms.json";
import wizardJson from "../../data/common/wizard.json";

// JSON серверов попадают в сборку отдельными чанками (glob без eager):
// при ~18 серверах по ~1 МБ вшивать всё в главный чанк нельзя — грузится
// только база выбранного сервера. Поверх может лечь кэш обновлений из
// GitHub (см. updater.ts): localStorage имеет приоритет над вшитой версией.
const bundled = import.meta.glob("../../data/servers/*/*.json") as Record<
  string,
  () => Promise<{ default: unknown }>
>;

export function getServers(): ServerInfo[] {
  return (serversJson as { servers: ServerInfo[] }).servers;
}

export function getSynonymGroups(): SynonymGroup[] {
  return (synonymsJson as { groups: SynonymGroup[] }).groups;
}

// Дерево мастера ситуаций — общее для всех серверов (маленькое, вшито eager)
export function getWizardTree(): WizardFile {
  return wizardJson as WizardFile;
}

export function cacheKey(serverId: string, file: string): string {
  return `cafhelper-data:servers/${serverId}/${file}.json`;
}

async function readJson<T>(serverId: string, file: string): Promise<T | null> {
  const cached = localStorage.getItem(cacheKey(serverId, file));
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      localStorage.removeItem(cacheKey(serverId, file));
    }
  }
  const load = bundled[`../../data/servers/${serverId}/${file}.json`];
  if (!load) return null;
  return (await load()).default as T;
}

export async function loadServerBundle(serverId: string): Promise<ServerDataBundle | null> {
  const articles: Article[] = [];
  const codexNames: Partial<Record<CodexId, string>> = {};
  let updated = "";
  let hasAnything = false;
  let draft = false;

  const seenIds = new Set<string>();
  for (const codex of CODEX_IDS) {
    const file = await readJson<CodexFile>(serverId, codex);
    if (!file) continue;
    hasAnything = true;
    codexNames[codex] = file.name;
    if (file.draft) draft = true;
    if (file.updated > updated) updated = file.updated;
    for (const chapter of file.chapters) {
      for (const a of chapter.articles) {
        // в «Законах» номера статей повторяются между законами — id должен быть уникален
        let id = `${codex}-${a.number}`;
        for (let n = 2; seenIds.has(id); n++) id = `${codex}-${a.number}@${n}`;
        seenIds.add(id);
        articles.push({
          id,
          codex,
          chapter: chapter.title,
          number: a.number,
          title: a.title,
          text: a.text,
          punishment: a.punishment,
          priority: a.priority,
          flags: a.flags,
          tags: a.tags ?? [],
        });
      }
    }
  }

  const scenarioFile = await readJson<ScenarioFile>(serverId, "scenarios");
  if (scenarioFile && scenarioFile.updated > updated) updated = scenarioFile.updated;
  if (scenarioFile?.draft) draft = true;

  if (!hasAnything) return null;
  return {
    serverId,
    articles,
    scenarios: scenarioFile?.scenarios ?? [],
    quickPhrases: scenarioFile?.quickPhrases ?? [],
    codexNames,
    updated,
    draft,
  };
}
