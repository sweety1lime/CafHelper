// Собирает все законы штата (кроме 4 кодексов) из data/raw/<server>/*.txt
// в один data/servers/<server>/laws.json: каждый закон = глава, статьи «Статья N.»
//
// Использование: node scripts/build-laws.mjs [server=atlanta]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { classifyDir } from "./lib/classify.mjs";

const server = process.argv[2] ?? "atlanta";
const RAW_DIR = `data/raw/${server}`;
const OUT = `data/servers/${server}/laws.json`;

const STATYA_RE = /^Статья\s+(\d+(?:\.\d+)*)\.?\s*(.*)$/i;
const PUNISHMENT_RE = /^Наказание\s*[:—-]?\s*(.*)$/i;

function splitTitle(rest, number) {
  const cleaned = rest.trim();
  if (cleaned && cleaned.length <= 90) return { title: cleaned.replace(/\.$/, ""), text: "" };
  const firstSentence = cleaned.split(/(?<=\.)\s/)[0] ?? cleaned;
  const title =
    firstSentence.length <= 110 ? firstSentence.replace(/\.$/, "") : `${cleaned.slice(0, 100).trim()}…`;
  return { title: title || `Статья ${number}`, text: cleaned };
}

function parseLaw(path) {
  const raw = readFileSync(path, "utf-8")
    .replace(/\r\n/g, "\n")
    .replace(/={5} СЛЕДУЮЩИЙ ПОСТ ={5}/g, "\n")
    .replace(/[​﻿]/g, "");
  const lines = raw.split("\n").map((l) => l.trim());
  const lawTitle = lines[0] || path;

  const articles = [];
  const byNumber = new Map(); // поправки в поздних постах заменяют статью
  let article = null;

  const flush = () => {
    if (!article) return;
    article.text = article.text.trim().replace(/\n{3,}/g, "\n\n");
    const existing = byNumber.get(article.number);
    if (existing) Object.assign(existing, article);
    else {
      articles.push(article);
      byNumber.set(article.number, article);
    }
    article = null;
  };

  for (const line of lines.slice(2)) {
    if (!line) {
      if (article) article.text += "\n";
      continue;
    }
    const punishment = line.match(PUNISHMENT_RE);
    if (punishment && article) {
      article.punishment = punishment[1] || article.punishment;
      continue;
    }
    const m = line.match(STATYA_RE);
    if (m) {
      flush();
      const { title, text } = splitTitle(m[2], m[1]);
      article = { number: m[1], title, text, tags: [] };
      continue;
    }
    if (article) article.text += (article.text.endsWith("\n") || !article.text ? "" : "\n") + line;
  }
  flush();
  return { title: lawTitle, articles };
}

// Кодексы (УК/ПК/КоАП/ДК) определяются по заголовку темы и конвертируются
// отдельно (majestic2json.mjs); сюда идёт всё остальное.
const { lawFiles, problems } = classifyDir(RAW_DIR);
for (const p of problems) console.warn(`  ⚠ ${p}`);

const chapters = [];
for (const { file } of lawFiles.sort((a, b) => a.file.localeCompare(b.file))) {
  const law = parseLaw(join(RAW_DIR, file));
  if (law.articles.length > 0) chapters.push(law);
  console.log(`  ${law.title.slice(0, 70)} — статей: ${law.articles.length}`);
}

const result = {
  codex: "laws",
  name: "Законы и Конституция штата",
  updated: new Date().toISOString().slice(0, 10),
  chapters,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf-8");
const total = chapters.reduce((n, c) => n + c.articles.length, 0);
console.log(`\nИтого: законов ${chapters.length}, статей ${total} -> ${OUT}`);
