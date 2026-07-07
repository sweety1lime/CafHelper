// Скрейпит разделы «Одобренные законопроекты» всех серверов из
// data/forum-sections.json одной сессией браузера (Cloudflare кликается
// один раз в начале). Прерывать безопасно: сервер со свежим _status.json
// при повторном запуске пропускается.
//
// Использование:
//   node scripts/scrape-all.mjs [--only=atlanta,newyork] [--force] [--max-age-days=7]

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { launchForumContext } from "./lib/browser.mjs";
import { scrapeSection } from "./lib/scrape.mjs";

const SECTIONS_FILE = "data/forum-sections.json";

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const force = args.includes("--force");
const maxAgeDays = Number(args.find((a) => a.startsWith("--max-age-days="))?.slice(15) ?? 7);

if (!existsSync(SECTIONS_FILE)) {
  console.error(`Нет ${SECTIONS_FILE} — сначала: node scripts/discover-sections.mjs`);
  process.exit(1);
}
let { servers } = JSON.parse(readFileSync(SECTIONS_FILE, "utf-8"));
if (only) servers = servers.filter((s) => only.includes(s.id));
if (!servers.length) {
  console.error("Список серверов пуст (проверь --only).");
  process.exit(1);
}

function isFresh(serverId) {
  const statusPath = join("data/raw", serverId, "_status.json");
  if (!existsSync(statusPath)) return false;
  const status = JSON.parse(readFileSync(statusPath, "utf-8"));
  if (status.errors?.length || status.threadsSaved < status.threadsFound) return false;
  const ageDays = (Date.now() - Date.parse(status.scrapedAt)) / 86_400_000;
  return ageDays <= maxAgeDays;
}

const { ctx, page } = await launchForumContext();
const report = [];
for (const [i, server] of servers.entries()) {
  console.log(`\n===== [${i + 1}/${servers.length}] ${server.id} (${server.name}) =====`);
  if (!force && isFresh(server.id)) {
    console.log("  свежий _status.json без ошибок — пропускаю (--force чтобы перекачать)");
    report.push({ id: server.id, skipped: true });
    continue;
  }
  try {
    const status = await scrapeSection(page, server.sectionUrl, `data/raw/${server.id}`);
    report.push({ id: server.id, ...status });
  } catch (e) {
    console.error(`  FATAL ${server.id}: ${e.message.split("\n")[0]}`);
    report.push({ id: server.id, threadsFound: 0, threadsSaved: 0, errors: [e.message.split("\n")[0]] });
  }
}
await ctx.close();

console.log("\n===== ИТОГО =====");
for (const r of report) {
  const line = r.skipped
    ? "пропущен (свежий)"
    : `${r.threadsSaved}/${r.threadsFound} тем${r.errors?.length ? `, ошибок: ${r.errors.length}` : ""}`;
  console.log(`  ${r.id.padEnd(15)} ${line}`);
}
const bad = report.filter((r) => !r.skipped && (r.errors?.length || r.threadsSaved === 0));
if (bad.length) {
  console.log(`\nС проблемами: ${bad.map((r) => r.id).join(", ")} — перезапусти с --only=${bad.map((r) => r.id).join(",")}`);
  process.exit(1);
}
