// Адаптирует сценарии Атланты (шаблон, id канонические — на них ссылается
// data/common/wizard.json) под другой сервер.
//
// Матчинг статей — по ПОЛНЫМ ТЕКСТАМ с IDF-взвешиванием: токены заголовка
// (вес ×3) и текста атлантской статьи ищутся в заголовках+текстах статей
// целевого кодекса; редкие в целевом корпусе слова весят больше. Это
// переносит «УК 12.8 ношение оружия» на сервер, где статья называется иначе.
//
// Ссылки переписываются и в articleRefs, и в текстах: короткие («ПК 14»)
// и словесные («статьи 8 Дорожного кодекса»). Сомнительные ссылки получают
// unverified:true — UI показывает их с ⚠ «не сверено».
//
// Ручные решения — data/adapt-overrides.json:
//   { "<serverId>": { "<codex>": { "<атлантский номер>": "<целевой>" | null } } }
// null = аналога нет, ссылка выкидывается из articleRefs.
//
// Миранда: текст «Вы имеете право хранить молчание…» извлекается из ПК
// целевого сервера и подставляется в быструю фразу.
//
// Использование: node scripts/adapt-scenarios.mjs <serverId>
// ВАЖНО: id сценариев не переименовывать — сломается мастер ситуаций.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TEMPLATE_SERVER = "atlanta";
const OVERRIDES_FILE = "data/adapt-overrides.json";
const serverId = process.argv[2];
if (!serverId || serverId === TEMPLATE_SERVER) {
  console.error("Использование: node scripts/adapt-scenarios.mjs <serverId≠atlanta>");
  process.exit(1);
}

const CODEXES = ["criminal", "procedural", "administrative", "traffic"];
const LABEL_TO_CODEX = { УК: "criminal", ПК: "procedural", КоАП: "administrative", ДК: "traffic" };
const SHORT_REF_RE = /\b(УК|ПК|КоАП|ДК)\s*(\d+(?:\.\d+)*)/g;
// «статьи 8 Дорожного кодекса», «статьёй 20 Процессуального Кодекса»
const VERBOSE_REF_RE =
  /(стать[а-яё]+)\s+(\d+(?:\.\d+)*)\s+(Уголовного|Процессуального|Административного|Дорожного)\s+кодекса/gi;
const ADJ_TO_CODEX = {
  уголовного: "criminal",
  процессуального: "procedural",
  административного: "administrative",
  дорожного: "traffic",
};

// пороги подобраны по санити-прогону atlanta->atlanta (идентичность = 1.0)
const CONFIDENT_SCORE = 0.5;
const REMAP_SCORE = 0.35;
const VERIFIED_SCORE = 0.55; // remapped ниже — unverified

function loadArticles(server) {
  const byCodex = {};
  for (const codex of CODEXES) {
    const path = `data/servers/${server}/${codex}.json`;
    if (!existsSync(path)) {
      console.error(`Нет ${path} — сначала сконвертируй базу (convert-all.mjs --only=${server})`);
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(path, "utf-8"));
    const list = [];
    for (const ch of data.chapters) for (const a of ch.articles) list.push(a);
    byCodex[codex] = list;
  }
  return byCodex;
}

const tokenize = (s) =>
  (s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/)
    .filter((t) => t.length > 2);

// --- IDF-взвешенный поиск по целевому кодексу ---
function buildTargetIndex(articles) {
  const docs = articles.map((a) => new Set(tokenize(`${a.title} ${a.text ?? ""}`)));
  const titleDocs = articles.map((a) => new Set(tokenize(a.title)));
  const df = new Map();
  for (const doc of docs) for (const t of doc) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length || 1;
  const idf = (t) => Math.log(1 + n / (1 + (df.get(t) ?? 0)));
  return { docs, titleDocs, idf };
}

// вес токена источника: заголовок ×3, текст ×1 (первые ~800 символов)
function sourceWeights(article) {
  const w = new Map();
  for (const t of tokenize(article.text?.slice(0, 800))) w.set(t, 1);
  for (const t of tokenize(article.title)) w.set(t, 3);
  return w;
}

// кандидат без единого общего слова с ЗАГОЛОВКОМ источника не может быть
// уверенным совпадением, какой бы текст ни совпал (ловит «77% ложных»)
const NO_TITLE_OVERLAP_CAP = 0.45;

function bestMatch(srcArticle, targetArticles, index) {
  const weights = sourceWeights(srcArticle);
  const titleTokens = new Set(tokenize(srcArticle.title));
  let denom = 0;
  for (const [t, w] of weights) denom += w * index.idf(t);
  if (denom === 0) return null;
  let best = null;
  let bestScore = 0;
  for (let i = 0; i < targetArticles.length; i++) {
    let num = 0;
    let titleHit = false;
    for (const [t, w] of weights) {
      if (index.docs[i].has(t)) {
        num += w * index.idf(t);
        // слово из заголовка источника должно встретиться в ЗАГОЛОВКЕ цели
        if (titleTokens.has(t) && index.titleDocs[i].has(t)) titleHit = true;
      }
    }
    let score = num / denom;
    if (!titleHit) score = Math.min(score, NO_TITLE_OVERLAP_CAP);
    if (score > bestScore) {
      bestScore = score;
      best = targetArticles[i];
    }
  }
  return best ? { article: best, score: bestScore } : null;
}

const src = loadArticles(TEMPLATE_SERVER);
const dst = loadArticles(serverId);
const indexes = Object.fromEntries(CODEXES.map((c) => [c, buildTargetIndex(dst[c])]));
const overridesAll = existsSync(OVERRIDES_FILE) ? JSON.parse(readFileSync(OVERRIDES_FILE, "utf-8")) : {};
const overrides = overridesAll[serverId] ?? {};
const template = JSON.parse(readFileSync(`data/servers/${TEMPLATE_SERVER}/scenarios.json`, "utf-8"));

// codex -> (номер в шаблоне -> {number|null, status, score?, note})
const mapping = Object.fromEntries(CODEXES.map((c) => [c, new Map()]));

function resolveRef(codex, number) {
  const cached = mapping[codex].get(number);
  if (cached) return cached;

  let result;
  const manual = overrides[codex]?.[number];
  if (manual !== undefined) {
    // override: null | "номер" | "кодекс номер" («criminal 6.2»)
    if (manual === null) {
      result = { number: null, codex, status: "dropped", note: "override: аналога нет" };
    } else {
      const [a, b] = String(manual).split(/\s+/);
      result = b
        ? { number: b, codex: a, status: "confident", note: "override" }
        : { number: a, codex, status: "confident", note: "override" };
    }
  } else {
    const srcArt = src[codex].find((a) => a.number === number);
    if (!srcArt) {
      result = { number, codex, status: "unresolved", note: "нет такой статьи даже в шаблоне" };
    } else {
      // ищем по всем кодексам: серверы раскладывают нормы по-разному
      // (у NY опьянение за рулём не в ДК); свой кодекс получает бонус
      let m = null;
      let mCodex = codex;
      for (const c of CODEXES) {
        const cand = bestMatch(srcArt, dst[c], indexes[c]);
        if (!cand) continue;
        const eff = cand.score + (c === codex ? 0.1 : 0);
        if (!m || eff > m.eff) {
          m = { ...cand, eff };
          mCodex = c;
        }
      }
      const pct = m ? Math.round(m.score * 100) : 0;
      const moved = mCodex !== codex ? ` [${codex} -> ${mCodex}!]` : "";
      if (m && m.score >= CONFIDENT_SCORE) {
        result = {
          number: m.article.number,
          codex: mCodex,
          status: mCodex === codex && m.article.number === number ? "confident" : "remapped",
          score: m.score,
          note: `${number} -> ${m.article.number} (${pct}%)${moved} «${m.article.title.slice(0, 50)}»`,
        };
      } else if (m && m.score >= REMAP_SCORE) {
        result = {
          number: m.article.number,
          codex: mCodex,
          status: "remapped",
          score: m.score,
          note: `${number} -> ${m.article.number} (${pct}%, слабо)${moved} «${m.article.title.slice(0, 50)}»`,
        };
      } else {
        result = { number, codex, status: "unresolved", score: m?.score ?? 0, note: `лучшее ${pct}%` };
      }
    }
  }
  mapping[codex].set(number, result);
  return result;
}

const isUnverified = (res) =>
  res.status === "unresolved" || (res.status === "remapped" && (res.score ?? 0) < VERIFIED_SCORE);

const CODEX_TO_LABEL = { criminal: "УК", procedural: "ПК", administrative: "КоАП", traffic: "ДК" };
const CODEX_TO_ADJ = {
  criminal: "Уголовного",
  procedural: "Процессуального",
  administrative: "Административного",
  traffic: "Дорожного",
};

function rewriteInline(text, stats) {
  let out = text.replace(SHORT_REF_RE, (m, label, number) => {
    const res = resolveRef(LABEL_TO_CODEX[label], number);
    stats[res.status === "dropped" ? "unresolved" : res.status]++;
    if (!res.number) return m;
    if (res.number === number && res.codex === LABEL_TO_CODEX[label]) return m;
    return `${CODEX_TO_LABEL[res.codex]} ${res.number}`;
  });
  out = out.replace(VERBOSE_REF_RE, (m, word, number, adj) => {
    const res = resolveRef(ADJ_TO_CODEX[adj.toLowerCase()], number);
    stats[res.status === "dropped" ? "unresolved" : res.status]++;
    if (!res.number) return m;
    if (res.number === number && res.codex === ADJ_TO_CODEX[adj.toLowerCase()]) return m;
    return `${word} ${res.number} ${CODEX_TO_ADJ[res.codex]} кодекса`;
  });
  return out;
}

// --- Миранда целевого сервера из его ПК ---
function extractMiranda() {
  for (const codex of ["procedural", "criminal"]) {
    for (const a of dst[codex]) {
      const text = `${a.title}\n${a.text ?? ""}`;
      const i = text.search(/Вы имеете право хранить молчание/i);
      if (i === -1) continue;
      // до конца абзаца/предложения-блока, максимум ~400 символов
      let frag = text.slice(i, i + 400);
      const cut = frag.search(/\n\s*\n/);
      if (cut > 40) frag = frag.slice(0, cut);
      frag = frag.trim().replace(/\s+/g, " ");
      return { text: frag, from: `${codex} ${a.number}` };
    }
  }
  return null;
}

const out = {
  updated: new Date().toISOString().slice(0, 10),
  draft: true,
  quickPhrases: structuredClone(template.quickPhrases ?? []),
  scenarios: [],
};

const report = [];
for (const s of template.scenarios) {
  const stats = { confident: 0, remapped: 0, unresolved: 0 };
  const scenario = structuredClone(s);
  scenario.articleRefs = scenario.articleRefs
    .map((ref) => {
      const res = resolveRef(ref.codex, ref.number);
      if (res.status === "dropped") return null;
      stats[res.status]++;
      const next = { ...ref, codex: res.codex, number: res.number };
      if (isUnverified(res)) next.unverified = true;
      return next;
    })
    .filter(Boolean);
  scenario.steps = scenario.steps.map((t) => rewriteInline(t, stats));
  scenario.phrases = scenario.phrases.map((t) => rewriteInline(t, stats));
  scenario.pitfalls = scenario.pitfalls.map((t) => rewriteInline(t, stats));
  scenario.situation = rewriteInline(scenario.situation, stats);
  out.scenarios.push(scenario);
  report.push({ id: s.id, ...stats });
}

// быстрые фразы: словесные ссылки + серверная Миранда
const phraseStats = { confident: 0, remapped: 0, unresolved: 0 };
for (const p of out.quickPhrases) p.text = rewriteInline(p.text, phraseStats);
const miranda = extractMiranda();
if (miranda) {
  const mp = out.quickPhrases.find((p) => p.label === "Миранда (задержание)");
  if (mp) mp.text = miranda.text;
}

writeFileSync(`data/servers/${serverId}/scenarios.json`, JSON.stringify(out, null, 2) + "\n", "utf-8");

console.log(`\n=== ${serverId}: адаптация сценариев (${out.scenarios.length}) ===`);
for (const r of report) {
  const mark = r.unresolved ? "✗" : r.remapped ? "~" : "✓";
  console.log(`  ${mark} ${r.id.padEnd(26)} confident:${r.confident} remapped:${r.remapped} unresolved:${r.unresolved}`);
}
console.log(miranda ? `Миранда: взята из ${miranda.from}: «${miranda.text.slice(0, 80)}…»` : "Миранда: НЕ найдена в ПК/УК — фраза осталась атлантской, сверь вручную");
console.log("\nКарта переносов (не-confident):");
for (const codex of CODEXES) {
  for (const [from, res] of mapping[codex]) {
    if (res.status !== "confident") console.log(`  ${codex} ${from}: ${res.status}${res.note ? ` — ${res.note}` : ""}`);
  }
}
