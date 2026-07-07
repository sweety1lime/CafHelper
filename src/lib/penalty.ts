import type { Article } from "../types";
import { CODEX_LABELS } from "../types";

// Разбирает строку наказания: «до 4 лет лишения свободы», «штраф до $2000», «штраф до 5.000$»
export function parsePunishment(p?: string): { years: number; fine: number } {
  if (!p) return { years: 0, fine: 0 };
  const yearsMatch = p.match(/до\s+(\d+)\s*(?:лет|год)/i);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
  const fineMatch = p.match(/\$\s?([\d\s.,]*\d)|([\d][\d\s.,]*\d|\d)\s?\$/);
  const fineRaw = fineMatch ? (fineMatch[1] ?? fineMatch[2]) : null;
  const fine = fineRaw ? parseInt(fineRaw.replace(/\D/g, ""), 10) || 0 : 0;
  return { years, fine };
}

export interface CalcSummary {
  years: number;
  fine: number;
  unparsed: Article[]; // статьи без распознанного наказания
}

export function summarizeCalc(articles: Article[]): CalcSummary {
  let years = 0;
  let fine = 0;
  const unparsed: Article[] = [];
  for (const a of articles) {
    const p = parsePunishment(a.punishment);
    if (p.years === 0 && p.fine === 0) unparsed.push(a);
    years += p.years;
    fine += p.fine;
  }
  return { years, fine, unparsed };
}

// Строка для рапорта: «УК 12.8, УК 17.5 | срок: до 7 лет | штраф: до $3000»
export function calcClipboardString(articles: Article[], sum: CalcSummary): string {
  const refs = articles.map((a) => `${CODEX_LABELS[a.codex].short} ${a.number}`).join(", ");
  const parts = [refs];
  if (sum.years > 0) parts.push(`срок: до ${sum.years} ${yearsWord(sum.years)}`);
  if (sum.fine > 0) parts.push(`штраф: до $${sum.fine.toLocaleString("en-US")}`);
  return parts.join(" | ");
}

export function yearsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "года";
  return "лет";
}
