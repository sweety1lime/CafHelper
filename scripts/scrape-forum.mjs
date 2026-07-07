// Скрейпер законодательной базы одного сервера Majestic RP через Playwright.
//
// Запускает НАСТОЯЩИЙ браузер (Edge) с видимым окном и постоянным профилем:
// так проходится проверка Cloudflare, а если раздел требует логина —
// просто войди в аккаунт в открывшемся окне, скрипт подождёт и продолжит сам.
//
// Использование:
//   node scripts/scrape-forum.mjs [serverId] [url-раздела]
//
//   serverId    id сервера (по умолчанию atlanta), результат — data/raw/<serverId>/
//   url-раздела если не указан, берётся из data/forum-sections.json
//               (создаётся discover-sections.mjs)
//
// Для совместимости: если первым аргументом передан URL, он считается
// разделом Атланты (старый формат вызова).
//
// Результат: data/raw/<serverId>/*.txt + *.html + _threads.json + _status.json

import { existsSync, readFileSync } from "node:fs";
import { launchForumContext } from "./lib/browser.mjs";
import { scrapeSection } from "./lib/scrape.mjs";

const ATLANTA_URL = "https://forum.majestic-rp.ru/forums/odobrennyye-zakonoproyekty.562/";
const SECTIONS_FILE = "data/forum-sections.json";

let [serverId, sectionUrl] = process.argv.slice(2);
if (serverId?.startsWith("http")) {
  sectionUrl = serverId;
  serverId = "atlanta";
}
serverId ??= "atlanta";

if (!sectionUrl) {
  if (serverId === "atlanta") sectionUrl = ATLANTA_URL;
  if (existsSync(SECTIONS_FILE)) {
    const { servers } = JSON.parse(readFileSync(SECTIONS_FILE, "utf-8"));
    sectionUrl = servers.find((s) => s.id === serverId)?.sectionUrl ?? sectionUrl;
  }
}
if (!sectionUrl) {
  console.error(
    `Не знаю URL раздела для «${serverId}». Передай вторым аргументом или сгенерируй ${SECTIONS_FILE}: node scripts/discover-sections.mjs`,
  );
  process.exit(1);
}

const { ctx, page } = await launchForumContext();
console.log(`Сервер: ${serverId}`);
const status = await scrapeSection(page, sectionUrl, `data/raw/${serverId}`);
await ctx.close();

console.log(`\nГотово: сохранено ${status.threadsSaved}/${status.threadsFound} тем в data/raw/${serverId}`);
if (status.errors.length) {
  console.log(`Ошибки (${status.errors.length}):`);
  for (const e of status.errors) console.log(`  - ${e}`);
  process.exit(1);
}
