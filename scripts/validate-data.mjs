// Валидация сконвертированных баз: страховка от молчаливых потерь статей
// при отличающейся разметке форумов других серверов.
//
// Использование:
//   node scripts/validate-data.mjs [serverId]   (по умолчанию atlanta)
//   node scripts/validate-data.mjs --all        (все каталоги data/servers/*)
//
// Ошибки -> exit 1. Также используется convert-all.mjs как модуль.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SERVERS_DIR = "data/servers";
const WIZARD_FILE = "data/common/wizard.json";

// Минимумы статей — от реальной базы Атланты с запасом; ниже — подозрение,
// что парсер не понял разметку этого сервера.
const FLOORS = { criminal: 120, procedural: 40, administrative: 40, traffic: 70, laws: 300 };
const CODEXES = Object.keys(FLOORS);

const REF_LABELS = { УК: "criminal", ПК: "procedural", КоАП: "administrative", ДК: "traffic" };
const INLINE_REF_RE = /\b(УК|ПК|КоАП|ДК)\s*(\d+(?:\.\d+)*)/g;

// Регекспы наказаний — копия src/lib/penalty.ts (parsePunishment); скрипты ESM,
// TS-файл отсюда не импортировать. При изменении там — обновить тут.
function parsesAsPunishment(p) {
  return /до\s+(\d+)\s*(?:лет|год)/i.test(p) || /\$\s?([\d\s.,]*\d)|([\d][\d\s.,]*\d|\d)\s?\$/.test(p);
}

function readJsonIf(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : null;
}

export function validateServer(serverId) {
  const errors = [];
  const warnings = [];
  const stats = {};
  const numbersByCodex = {}; // для резолва ссылок сценариев

  for (const codex of CODEXES) {
    const file = join(SERVERS_DIR, serverId, `${codex}.json`);
    const data = readJsonIf(file);
    if (!data) {
      errors.push(`${codex}.json отсутствует`);
      stats[codex] = 0;
      continue;
    }

    const numbers = new Set();
    let total = 0;
    let unparsedPunishments = 0;
    for (const chapter of data.chapters ?? []) {
      if (!chapter.articles?.length) warnings.push(`${codex}: глава без статей — «${chapter.title}»`);
      // дубли ищем внутри главы: между главами номера легально повторяются
      // (laws: глава = закон; ПК Чикаго: нумерация перезапускается в главах)
      const scope = new Set();
      for (const a of chapter.articles ?? []) {
        total++;
        if (scope.has(a.number))
          errors.push(`${codex}: дубль номера ${a.number} (${chapter.title})`);
        scope.add(a.number);
        numbers.add(a.number);
        if (!a.title?.trim()) errors.push(`${codex} ${a.number}: пустой title`);
        if (!a.text?.trim() && !a.punishment?.trim())
          warnings.push(`${codex} ${a.number}: пустые text и punishment`);
        if (a.punishment?.trim() && !parsesAsPunishment(a.punishment)) unparsedPunishments++;
      }
    }
    stats[codex] = total;
    numbersByCodex[codex] = numbers;
    if (total === 0) errors.push(`${codex}: 0 статей`);
    else if (total < FLOORS[codex])
      warnings.push(`${codex}: всего ${total} статей (минимум по Атланте ~${FLOORS[codex]}) — проверь парсер`);
    if (unparsedPunishments > 0)
      warnings.push(`${codex}: наказаний без распознаваемого срока/штрафа: ${unparsedPunishments} (может быть законно: лишение лицензии и т.п.)`);
  }

  // Сценарии: уникальные id, резолв articleRefs и инлайн-ссылок в текстах
  const scen = readJsonIf(join(SERVERS_DIR, serverId, "scenarios.json"));
  if (!scen) {
    warnings.push("scenarios.json отсутствует");
  } else {
    stats.scenarios = scen.scenarios?.length ?? 0;
    // у draft-сценариев (автоадаптация с другого сервера) битые ссылки —
    // ожидаемая часть ручной сверки, не блокируем конвейер
    const refProblems = scen.draft ? warnings : errors;
    const ids = new Set();
    for (const s of scen.scenarios ?? []) {
      if (ids.has(s.id)) errors.push(`сценарий: дубль id «${s.id}»`);
      ids.add(s.id);
      for (const ref of s.articleRefs ?? []) {
        if (!numbersByCodex[ref.codex]?.has(ref.number)) {
          // unverified — заведомо несверенный автоперенос, это warning всегда
          (ref.unverified ? warnings : refProblems).push(
            `сценарий «${s.id}»: articleRef ${ref.codex} ${ref.number} не найден в базе`,
          );
        }
      }
      const texts = [s.situation, ...(s.steps ?? []), ...(s.phrases ?? []), ...(s.pitfalls ?? [])];
      for (const text of texts) {
        for (const m of (text ?? "").matchAll(INLINE_REF_RE)) {
          const codex = REF_LABELS[m[1]];
          if (!numbersByCodex[codex]?.has(m[2]))
            warnings.push(`сценарий «${s.id}»: в тексте ссылка ${m[1]} ${m[2]}, такой статьи нет`);
        }
      }
    }
  }

  return { errors, warnings, stats, scenarioIds: new Set((scen?.scenarios ?? []).map((s) => s.id)), quickPhraseLabels: new Set((scen?.quickPhrases ?? []).map((p) => p.label)) };
}

// Мастер ситуаций: связность дерева и резолв id по каждому hasData-серверу.
// tips обязаны быть сервер-нейтральными (без номеров статей).
export function validateWizard(serverResults) {
  const errors = [];
  const wizard = readJsonIf(WIZARD_FILE);
  if (!wizard) return { errors, skipped: true };

  const nodes = new Map(wizard.nodes.map((n) => [n.id, n]));
  if (!nodes.has(wizard.root)) errors.push(`wizard: root «${wizard.root}» не найден`);

  const reachable = new Set();
  const queue = [wizard.root];
  while (queue.length) {
    const id = queue.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = nodes.get(id);
    if (!node) {
      errors.push(`wizard: ссылка на несуществующий узел «${id}»`);
      continue;
    }
    for (const opt of node.options ?? []) {
      if (opt.next) queue.push(opt.next);
      if (opt.answer) {
        for (const tip of opt.answer.tips ?? []) {
          if (INLINE_REF_RE.test(tip))
            errors.push(`wizard ${id}/${opt.id}: в tips номер статьи («${tip.slice(0, 50)}…») — номера различаются между серверами, они живут в сценариях`);
          INLINE_REF_RE.lastIndex = 0;
        }
        for (const [serverId, res] of Object.entries(serverResults)) {
          for (const sid of opt.answer.scenarioIds ?? [])
            if (!res.scenarioIds.has(sid))
              errors.push(`wizard ${id}/${opt.id}: сценарий «${sid}» отсутствует у ${serverId}`);
          for (const label of opt.answer.phraseLabels ?? [])
            if (!res.quickPhraseLabels.has(label))
              errors.push(`wizard ${id}/${opt.id}: быстрая фраза «${label}» отсутствует у ${serverId}`);
        }
      }
      if (!opt.next && !opt.answer) errors.push(`wizard ${id}/${opt.id}: нет ни next, ни answer`);
    }
  }
  for (const id of nodes.keys()) {
    if (!reachable.has(id)) errors.push(`wizard: узел «${id}» недостижим из root`);
  }
  return { errors, skipped: false };
}

// ---- CLI ----
const arg = process.argv[2] ?? "atlanta";
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const registry = readJsonIf("data/servers.json")?.servers ?? [];
  const hasDataIds = new Set(registry.filter((s) => s.hasData).map((s) => s.id));
  const targets =
    arg === "--all"
      ? readdirSync(SERVERS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
      : [arg];

  let failed = false;
  const serverResults = {};
  for (const serverId of targets) {
    const res = validateServer(serverId);
    if (hasDataIds.has(serverId)) serverResults[serverId] = res;
    const statLine = Object.entries(res.stats).map(([k, v]) => `${k}:${v}`).join(" ");
    console.log(`\n=== ${serverId} — ${statLine}`);
    for (const e of res.errors) console.log(`  ✗ ${e}`);
    const shown = res.warnings.slice(0, 15);
    for (const w of shown) console.log(`  ⚠ ${w}`);
    if (res.warnings.length > shown.length) console.log(`  ⚠ … и ещё ${res.warnings.length - shown.length} предупреждений`);
    if (res.errors.length) failed = true;
    else console.log("  ✓ ошибок нет");
  }

  const wiz = validateWizard(serverResults);
  if (!wiz.skipped) {
    console.log(`\n=== wizard (${WIZARD_FILE})`);
    for (const e of wiz.errors) console.log(`  ✗ ${e}`);
    if (wiz.errors.length) failed = true;
    else console.log("  ✓ ошибок нет");
  }

  process.exit(failed ? 1 : 0);
}
