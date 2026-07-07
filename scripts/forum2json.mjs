// forum2json — конвертер текста кодекса с форума Majestic RP в JSON для CafHelper.
//
// Использование:
//   1. Открой тему кодекса на forum.majestic-rp.ru, выдели текст и сохрани в .txt (UTF-8).
//   2. node scripts/forum2json.mjs <input.txt> <codex> [output.json]
//      где <codex> — criminal | procedural | administrative | traffic
//
// Ожидаемая разметка (типовая для форума):
//   Глава I. Название главы
//   Статья 13.2. Название статьи
//   Текст статьи...
//   Наказание: 4 года лишения свободы
//
// Результат нужно вычитать глазами: разметка тем на форуме гуляет.

import { readFileSync, writeFileSync } from "node:fs";

const CODEX_NAMES = {
  criminal: "Уголовный кодекс штата",
  procedural: "Процессуальный кодекс штата",
  administrative: "Административный кодекс штата",
  traffic: "Дорожный кодекс штата",
};

const [inputPath, codex, outputPath] = process.argv.slice(2);
if (!inputPath || !CODEX_NAMES[codex]) {
  console.error("Использование: node scripts/forum2json.mjs <input.txt> <criminal|procedural|administrative|traffic> [output.json]");
  process.exit(1);
}

const raw = readFileSync(inputPath, "utf-8").replace(/\r\n/g, "\n");
const lines = raw.split("\n").map((l) => l.trim());

const CHAPTER_RE = /^(Глава|Раздел)\s+([IVXLC\d]+)[.\s—-]*(.*)$/i;
const ARTICLE_RE = /^Статья\s+([\d]+(?:\.[\d]+)*)[.\s—-]*(.*)$/i;
const PUNISHMENT_RE = /^(Наказание|Санкция|Мера наказания)\s*[:—-]\s*(.*)$/i;

const chapters = [];
let currentChapter = null;
let currentArticle = null;

function flushArticle() {
  if (!currentArticle) return;
  currentArticle.text = currentArticle.text.trim();
  if (!currentChapter) {
    currentChapter = { title: "Глава I. Общие положения", articles: [] };
    chapters.push(currentChapter);
  }
  currentChapter.articles.push(currentArticle);
  currentArticle = null;
}

for (const line of lines) {
  if (!line) continue;

  const chapterMatch = line.match(CHAPTER_RE);
  if (chapterMatch) {
    flushArticle();
    currentChapter = { title: line, articles: [] };
    chapters.push(currentChapter);
    continue;
  }

  const articleMatch = line.match(ARTICLE_RE);
  if (articleMatch) {
    flushArticle();
    currentArticle = {
      number: articleMatch[1],
      title: articleMatch[2] || "(без названия)",
      text: "",
      tags: [],
    };
    continue;
  }

  const punishmentMatch = line.match(PUNISHMENT_RE);
  if (punishmentMatch && currentArticle) {
    currentArticle.punishment = punishmentMatch[2];
    continue;
  }

  if (currentArticle) {
    currentArticle.text += (currentArticle.text ? " " : "") + line;
  }
}
flushArticle();

const result = {
  codex,
  name: CODEX_NAMES[codex],
  updated: new Date().toISOString().slice(0, 10),
  chapters: chapters.filter((c) => c.articles.length > 0),
};

const out = outputPath ?? `${codex}.json`;
writeFileSync(out, JSON.stringify(result, null, 2) + "\n", "utf-8");

const total = result.chapters.reduce((n, c) => n + c.articles.length, 0);
console.log(`Готово: ${out} — глав: ${result.chapters.length}, статей: ${total}`);
if (total === 0) {
  console.warn("Внимание: не распознано ни одной статьи. Проверь, что строки начинаются со «Статья N.»");
}
