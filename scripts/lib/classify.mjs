// Классификация выкачанных тем (data/raw/<server>/*.txt) по заголовку темы
// (первая строка файла) вместо хрупких номеров файлов: на каждом сервере
// порядок тем в разделе свой.
//
// Четыре кодекса определяются по «прилагательное + кодекс», чтобы не зацепить
// Трудовой/Налоговый/Воздушный кодексы и «Кодекс этики» — они уходят в laws.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Порядок слов различается по серверам: «Административный Кодекс» (Атланта)
// vs «Кодекс … об административных правонарушениях» (Нью-Йорк), поэтому
// матчим стем и слово «кодекс» независимо. \w не матчит кириллицу.
const CODEX_STEMS = [
  ["criminal", /уголовн/i],
  ["procedural", /процессуальн/i],
  ["administrative", /административн/i],
  ["traffic", /дорожн/i],
];
const KODEKS_RE = /кодекс/i;

export const NON_CONTENT_RE = /^_|\.html$|README/i;

// -> { codex: "criminal"|"procedural"|"administrative"|"traffic"|"laws", title }
export function classifyRawFile(path) {
  const title = readFileSync(path, "utf-8").split("\n", 1)[0].trim();
  // «Приложение к Уголовному кодексу …» — отдельный акт, не сам кодекс
  if (KODEKS_RE.test(title) && !/приложени/i.test(title)) {
    for (const [codex, re] of CODEX_STEMS) {
      if (re.test(title)) return { codex, title };
    }
  }
  return { codex: "laws", title };
}

// Раскладывает каталог raw-файлов по кодексам.
// -> { codexFiles: {criminal?, procedural?, administrative?, traffic?}, lawFiles: [...], problems: [...] }
// problems — человекочитаемые строки: кодекс не найден или найден дважды.
export function classifyDir(rawDir) {
  const codexFiles = {};
  const lawFiles = [];
  const problems = [];

  const entries = readdirSync(rawDir).filter((f) => f.endsWith(".txt") && !NON_CONTENT_RE.test(f));
  for (const file of entries) {
    const path = join(rawDir, file);
    const { codex, title } = classifyRawFile(path);
    if (codex === "laws") {
      lawFiles.push({ path, file, title });
    } else if (codexFiles[codex]) {
      problems.push(`${codex}: найден дважды — «${codexFiles[codex].title}» и «${title}»`);
    } else {
      codexFiles[codex] = { path, file, title };
    }
  }

  for (const [codex] of CODEX_STEMS) {
    if (!codexFiles[codex]) problems.push(`${codex}: кодекс не найден среди ${entries.length} тем`);
  }
  return { codexFiles, lawFiles, problems };
}
