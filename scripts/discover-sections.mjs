// Ищет на главной forum.majestic-rp.ru разделы «Одобренные законопроекты»
// каждого сервера и пишет data/forum-sections.json — источник истины
// для scrape-forum.mjs / scrape-all.mjs.
//
// Использование: node scripts/discover-sections.mjs
// (откроется окно Edge; если увидишь Cloudflare-проверку — кликни чекбокс)
//
// В конце печатает diff со списком серверов из data/servers.json.

import { readFileSync, writeFileSync } from "node:fs";
import { launchForumContext, waitForContentOrLogin } from "./lib/browser.mjs";

const FORUM_INDEX = "https://forum.majestic-rp.ru/";
const OUT = "data/forum-sections.json";
const SECTION_HREF = "odobrennyye-zakonoproyekty";

function toId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const { ctx, page } = await launchForumContext();
console.log(`Открываю ${FORUM_INDEX}`);
await page.goto(FORUM_INDEX, { waitUntil: "domcontentloaded", timeout: 60_000 });

if ((await waitForContentOrLogin(page, `a[href*='${SECTION_HREF}']`)) === "timeout") {
  console.error("Не дождался ссылок на «Одобренные законопроекты» (3 мин).");
  // На индексе таких ссылок может не быть вовсе (структура форума другая) —
  // подскажем, что видно на странице, чтобы поправить селекторы.
  const headings = await page
    .$$eval("h1, h2, h3, .block-header", (els) => els.map((e) => e.textContent.trim()).slice(0, 40))
    .catch(() => []);
  console.error("Заголовки на странице:", headings);
  await ctx.close();
  process.exit(1);
}

// Для каждой ссылки на раздел поднимаемся к блоку-категории сервера за именем.
// XenForo-структура может отличаться, поэтому пробуем несколько источников имени.
const found = await page.$$eval(`a[href*='${SECTION_HREF}']`, (links) =>
  links.map((a) => {
    const block =
      a.closest(".block--category") ?? a.closest(".block") ?? a.closest("[data-widget-key]");
    const header = block?.querySelector(".block-header a, .block-header, h2, h3");
    // ближайший заголовок выше по документу — запасной вариант
    let prevHeading = null;
    for (let el = a.closest(".node") ?? a; el && !prevHeading; el = el.parentElement) {
      let sib = el.previousElementSibling;
      while (sib && !prevHeading) {
        if (/^H[1-4]$/.test(sib.tagName)) prevHeading = sib.textContent.trim();
        sib = sib.previousElementSibling;
      }
    }
    return {
      url: a.href,
      category: header?.textContent.trim() ?? prevHeading ?? "",
    };
  }),
);
await ctx.close();

// Дедуп по URL (ссылка может встретиться в сайдбаре/виджетах)
const byUrl = new Map();
for (const f of found) {
  if (!byUrl.has(f.url) || (!byUrl.get(f.url).category && f.category)) byUrl.set(f.url, f);
}

const servers = [...byUrl.values()].map(({ url, category }) => {
  const name = category.replace(/majestic\s*rp/i, "").replace(/[|«»"]+/g, "").trim();
  return { id: toId(name) || `unknown-${url.match(/\.(\d+)\/?$/)?.[1] ?? "x"}`, name, sectionUrl: url };
});

writeFileSync(
  OUT,
  JSON.stringify({ updated: new Date().toISOString().slice(0, 10), servers }, null, 2) + "\n",
  "utf-8",
);

console.log(`\nНайдено разделов: ${servers.length} -> ${OUT}`);
for (const s of servers) console.log(`  ${s.id.padEnd(15)} ${s.name.padEnd(18)} ${s.sectionUrl}`);

// Diff с data/servers.json
const registry = JSON.parse(readFileSync("data/servers.json", "utf-8")).servers;
const regIds = new Set(registry.map((s) => s.id));
const foundIds = new Set(servers.map((s) => s.id));
const missing = registry.filter((s) => !foundIds.has(s.id));
const extra = servers.filter((s) => !regIds.has(s.id));
if (missing.length) console.log(`\nЕсть в servers.json, не найдены на форуме: ${missing.map((s) => s.id).join(", ")}`);
if (extra.length) console.log(`Найдены на форуме, нет в servers.json: ${extra.map((s) => s.id).join(", ")}`);
if (!missing.length && !extra.length) console.log("\nСписки совпадают с data/servers.json ✓");
