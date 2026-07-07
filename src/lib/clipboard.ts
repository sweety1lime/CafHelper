import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Article } from "../types";
import { CODEX_LABELS } from "../types";

export async function copyText(text: string): Promise<void> {
  try {
    await writeText(text);
  } catch {
    await navigator.clipboard.writeText(text);
  }
}

// «УК 12.8 — Незаконное ношение оружия» / для законов: «Закон "Об Ордерах…", ст.3 — Название»
export function articleShortRef(article: Article): string {
  if (article.codex === "laws") {
    return `${article.chapter}, ст.${article.number} — ${article.title}`;
  }
  return `${CODEX_LABELS[article.codex].short} ${article.number} — ${article.title}`;
}
