// Конвертер реальных кодексов Majestic RP (выкачанных scrape-forum.mjs)
// в JSON-формат CafHelper (data/servers/<id>/<codex>.json).
//
// Разметка различается не только между кодексами, но и между СЕРВЕРАМИ,
// поэтому режим определяется автоматически по пре-скану файла:
//   uk-bare   УК Атланты/Детройта: статьи «6.2 (F/R/CR) Текст» + Приоритет розыска + Наказание
//   grouped   КоАП Атланты: группы «Статья 7. Название», статьи «Статья 7.1. Текст»
//   statya    всё остальное: статьи «Статья 13. …» / «Статья 15.1 (R/F) Название»,
//             главы «Глава I.» и/или «Раздел 1 - …»
// Отдельно детектится перезапуск нумерации в каждой главе (ПК Чикаго):
// тогда одинаковые номера в разных главах — разные статьи, а не поправки.
//
// Использование:
//   node scripts/majestic2json.mjs <input.txt> <codex> <output.json> ["Название кодекса"]

import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, codex, outputPath, codexName] = process.argv.slice(2);
const NAMES = {
  criminal: "Уголовный кодекс штата SA",
  procedural: "Процессуальный кодекс штата SA",
  administrative: "Административный кодекс штата SA",
  traffic: "Дорожный кодекс штата SA",
};
if (!inputPath || !NAMES[codex] || !outputPath) {
  console.error("Использование: node scripts/majestic2json.mjs <input.txt> <codex> <output.json>");
  process.exit(1);
}

const raw = readFileSync(inputPath, "utf-8")
  .replace(/\r\n/g, "\n")
  .replace(/={5} СЛЕДУЮЩИЙ ПОСТ ={5}/g, "\n")
  .replace(/[​﻿]/g, ""); // zero-width из форумной разметки

const lines = raw.split("\n").map((l) => l.trim());

const CHAPTER_RE = /^(?:Раздел\s+\d+\.?\s*)?Глава\s+([IVXLC\d]+)(?:[.\s-]|$)/i;
// «Раздел 1 - Общая часть» как самостоятельная глава (Детройт) — только
// если в файле нет «Глав»
const RAZDEL_RE = /^Раздел\s+([IVXLC\d]+)\s*[-—.:]/i;
const UK_ARTICLE_RE = /^(\d+(?:\.\d+)+)\.?\s*(\([A-ZА-Я/.\s]+\))?\s*[.\s—-]*(.+)$/;
// «Статья 15.1 (R/F) (S) Название» — флаги бывают и в статья-формате (Чикаго)
const STATYA_RE = /^Статья\s+(\d+(?:\.\d+)*)\.?\s*((?:\([A-ZА-Яa-zа-я/.,\s]*\)\s*)+)?(.*)$/i;
const PUNISHMENT_RE = /^Наказание\s*[:—-]?\s*(.*)$/i;
const PRIORITY_RE = /^Приоритет розыска\s*[:—-]?\s*(.*)$/i;

// ---- Пре-скан: выбор режима ----
let bareUkCount = 0;
let statyaDotted = 0;
let statyaInt = 0;
let hasGlava = false;
{
  // перезапуск нумерации: одинаковые номера статей в разных главах
  const chaptersByNumber = new Map();
  let chapterIdx = 0;
  for (const line of lines) {
    if (!line) continue;
    if (CHAPTER_RE.test(line)) {
      hasGlava = true;
      chapterIdx++;
      continue;
    }
    if (RAZDEL_RE.test(line)) {
      chapterIdx++;
      continue;
    }
    const st = line.match(STATYA_RE);
    if (st) {
      if (st[1].includes(".")) statyaDotted++;
      else statyaInt++;
      const set = chaptersByNumber.get(st[1]) ?? new Set();
      set.add(chapterIdx);
      chaptersByNumber.set(st[1], set);
      continue;
    }
    if (UK_ARTICLE_RE.test(line)) bareUkCount++;
  }
  var dupAcrossChapters = [...chaptersByNumber.values()].filter((s) => s.size > 1).length;
}

// uk-bare — не только УК: на Vegas/SF процессуальный и административный
// кодексы тоже размечены голыми номерами «1.1. Текст» без слова «Статья»
const mode =
  codex === "administrative" && statyaDotted >= 5 && statyaInt >= 2 && statyaDotted > statyaInt
    ? "grouped"
    : bareUkCount >= 10 && bareUkCount > statyaDotted + statyaInt
      ? "uk-bare"
      : "statya";
// поправки в поздних постах (Атланта) vs перезапуск нумерации в главах (Чикаго)
const perChapterNumbering = dupAcrossChapters >= 5;

const chapters = [];
const byKey = new Map();
let chapter = null;
let article = null;

function ensureChapter(title) {
  chapter = { title, articles: [] };
  chapters.push(chapter);
}

function flush() {
  if (!article) return;
  article.text = article.text.trim().replace(/\n{3,}/g, "\n\n");
  if (!chapter) ensureChapter("Общие положения");
  const key = perChapterNumbering ? `${chapters.length}:${article.number}` : article.number;
  const existing = byKey.get(key);
  if (existing) {
    // поправка: обновляем содержимое, сохраняя место статьи в исходной главе
    Object.assign(existing, article);
  } else {
    chapter.articles.push(article);
    byKey.set(key, article);
  }
  article = null;
}

// У статьи вида «Статья 13. Правило Миранды.» короткий хвост — это название;
// длинный хвост — это сразу текст диспозиции.
function splitTitle(rest, number) {
  const cleaned = rest.trim();
  if (cleaned && cleaned.length <= 90) return { title: cleaned.replace(/\.$/, ""), text: "" };
  const firstSentence = cleaned.split(/(?<=\.)\s/)[0] ?? cleaned;
  const title =
    firstSentence.length <= 110 ? firstSentence.replace(/\.$/, "") : `${cleaned.slice(0, 100).trim()}…`;
  return { title: title || `Статья ${number}`, text: cleaned };
}

const cleanFlags = (s) => s?.replace(/[()]/g, " ").trim().replace(/\s+/g, "/") || undefined;

for (const line of lines) {
  if (!line) {
    if (article) article.text += "\n";
    continue;
  }

  // главы: «Глава …» всегда; «Раздел …» — только если «Глав» в файле нет
  // (иначе «Раздел I. Уголовный закон» дал бы пустую главу-обёртку)
  if (mode !== "grouped" && (CHAPTER_RE.test(line) || (!hasGlava && RAZDEL_RE.test(line)))) {
    flush();
    ensureChapter(line.replace(/\s+/g, " "));
    continue;
  }

  const punishment = line.match(PUNISHMENT_RE);
  if (punishment && article) {
    article.punishment = punishment[1] || article.punishment;
    continue;
  }
  const priority = line.match(PRIORITY_RE);
  if (priority && article) {
    article.priority = priority[1];
    continue;
  }

  if (mode === "uk-bare") {
    const m = line.match(UK_ARTICLE_RE);
    if (m) {
      const depth = m[1].split(".").length;
      // «12.8.1 (F/CR) …» — отдельный состав преступления (есть флаги) -> своя статья;
      // «4.3.1 …» без флагов — пункт-перечисление общей части -> текст родительской статьи
      if (depth >= 3 && !m[2]) {
        if (article) article.text += (article.text.endsWith("\n") || !article.text ? "" : "\n") + line;
        continue;
      }
      flush();
      const { title, text } = splitTitle(m[3], m[1]);
      article = { number: m[1], title, text, tags: [] };
      const flags = cleanFlags(m[2]);
      if (flags) article.flags = flags;
      continue;
    }
  } else {
    const m = line.match(STATYA_RE);
    if (m) {
      const number = m[1];
      if (mode === "grouped" && !number.includes(".")) {
        // КоАП Атланты: «Статья 7. Название» — заголовок группы
        flush();
        ensureChapter(line.replace(/\s+/g, " "));
        continue;
      }
      flush();
      const { title, text } = splitTitle(m[3], number);
      article = { number, title, text, tags: [] };
      const flags = cleanFlags(m[2]);
      if (flags) article.flags = flags;
      continue;
    }
  }

  if (article) {
    article.text += (article.text.endsWith("\n") || !article.text ? "" : "\n") + line;
  }
}
flush();

const result = {
  codex,
  name: codexName ?? NAMES[codex],
  updated: new Date().toISOString().slice(0, 10),
  chapters: chapters.filter((c) => c.articles.length > 0),
};

writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf-8");
const total = result.chapters.reduce((n, c) => n + c.articles.length, 0);
const withPunishment = result.chapters.reduce(
  (n, c) => n + c.articles.filter((a) => a.punishment).length,
  0,
);
console.log(
  `${codex} [${mode}${perChapterNumbering ? ", нумерация по главам" : ""}]: глав ${result.chapters.length}, статей ${total} (с наказанием: ${withPunishment}) -> ${outputPath}`,
);
