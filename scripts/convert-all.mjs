// Конвертирует выкачанные raw-каталоги в базы приложения:
// classify -> majestic2json ×4 -> build-laws -> validate.
// Прошедшим валидацию серверам ставит hasData:true в data/servers.json
// и draft:true в сгенерированные JSON (снимается вручную после сверки).
//
// Использование:
//   node scripts/convert-all.mjs [--only=newyork,detroit]
//
// atlanta уже сверена — её draft не трогаем.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { classifyDir } from "./lib/classify.mjs";
import { validateServer } from "./validate-data.mjs";

const RAW_ROOT = "data/raw";
const SERVERS_ROOT = "data/servers";
const REVIEWED = new Set(["atlanta"]); // базы, сверенные человеком — draft не ставим

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
let targets = readdirSync(RAW_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
if (only) targets = targets.filter((t) => only.includes(t));
if (!targets.length) {
  console.error(`Нет raw-каталогов в ${RAW_ROOT} (проверь --only).`);
  process.exit(1);
}

const report = [];
for (const serverId of targets) {
  console.log(`\n===== ${serverId} =====`);
  const rawDir = join(RAW_ROOT, serverId);
  const outDir = join(SERVERS_ROOT, serverId);
  mkdirSync(outDir, { recursive: true });

  const { codexFiles, problems } = classifyDir(rawDir);
  for (const p of problems) console.log(`  ⚠ ${p}`);

  for (const [codex, f] of Object.entries(codexFiles)) {
    try {
      // имя кодекса не передаём: дефолты majestic2json аккуратнее рваного
      // регистра форумных заголовков и одинаковы для всех серверов (штат SA)
      execFileSync(
        process.execPath,
        ["scripts/majestic2json.mjs", f.path, codex, join(outDir, `${codex}.json`)],
        { stdio: "inherit" },
      );
    } catch {
      console.log(`  ✗ ${codex}: конвертер упал на ${f.file}`);
    }
  }
  try {
    execFileSync(process.execPath, ["scripts/build-laws.mjs", serverId], { stdio: "inherit" });
  } catch {
    console.log("  ✗ build-laws упал");
  }

  const res = validateServer(serverId);
  const ok = res.errors.length === 0 && problems.length === 0;
  for (const e of res.errors) console.log(`  ✗ ${e}`);
  const statLine = Object.entries(res.stats).map(([k, v]) => `${k}:${v}`).join(" ");
  console.log(`  ${ok ? "✓" : "✗"} ${statLine} (предупреждений: ${res.warnings.length})`);
  report.push({ serverId, ok, statLine, errors: res.errors.length + problems.length });

  if (ok && !REVIEWED.has(serverId)) {
    for (const codex of ["criminal", "procedural", "administrative", "traffic", "laws"]) {
      const path = join(outDir, `${codex}.json`);
      if (!existsSync(path)) continue;
      const data = JSON.parse(readFileSync(path, "utf-8"));
      data.draft = true;
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
    }
  }
}

// hasData:true — только прошедшим; новые id дописываем из forum-sections.json
const registryPath = "data/servers.json";
const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
const sections = existsSync("data/forum-sections.json")
  ? JSON.parse(readFileSync("data/forum-sections.json", "utf-8")).servers
  : [];
for (const { serverId, ok } of report) {
  if (!ok) continue;
  let entry = registry.servers.find((s) => s.id === serverId);
  if (!entry) {
    const name = sections.find((s) => s.id === serverId)?.name ?? serverId;
    entry = { id: serverId, name, hasData: false };
    registry.servers.push(entry);
  }
  entry.hasData = true;
}
writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");

console.log("\n===== ИТОГО =====");
for (const r of report) console.log(`  ${r.serverId.padEnd(15)} ${r.ok ? "✓" : `✗ (ошибок: ${r.errors})`} ${r.statLine}`);
const bad = report.filter((r) => !r.ok);
if (bad.length) {
  console.log(`\nНе прошли: ${bad.map((r) => r.serverId).join(", ")} — чини парсер/разметку и перезапусти с --only=…`);
  process.exit(1);
}
