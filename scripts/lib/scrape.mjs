// Скрейп одного форумного раздела (XenForo) в data/raw/<server>/:
// все темы раздела, все посты каждой темы (кодексы размазаны по постам),
// с раскрытием спойлеров. Используется scrape-forum.mjs (один сервер)
// и scrape-all.mjs (все серверы одной сессией браузера).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { waitForContentOrLogin } from "./browser.mjs";

export const THREAD_LIST_SEL = ".structItem-title a[href*='/threads/']";

export function slugify(title) {
  const map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
  return title
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "thread";
}

// Скрейпит раздел sectionUrl в outDir. Возвращает статус
// { scrapedAt, sectionUrl, threadsFound, threadsSaved, errors } —
// он же пишется в outDir/_status.json (по нему scrape-all скипает свежие серверы).
export async function scrapeSection(page, sectionUrl, outDir) {
  mkdirSync(outDir, { recursive: true });
  const status = { scrapedAt: "", sectionUrl, threadsFound: 0, threadsSaved: 0, errors: [] };

  console.log(`[1/3] Открываю раздел: ${sectionUrl}`);
  await page.goto(sectionUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if ((await waitForContentOrLogin(page, THREAD_LIST_SEL)) === "timeout") {
    status.errors.push("не дождался списка тем (3 мин)");
    return finish(status, outDir);
  }

  // Собираем темы со всех страниц раздела
  console.log("[2/3] Собираю список тем…");
  const threads = [];
  for (let pageNum = 1; pageNum <= 20; pageNum++) {
    const url = pageNum === 1 ? sectionUrl : `${sectionUrl.replace(/\/$/, "")}/page-${pageNum}`;
    if (pageNum > 1) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(1500);
      if ((await page.locator(THREAD_LIST_SEL).count()) === 0) break;
    }
    const items = await page.$$eval(THREAD_LIST_SEL, (links) =>
      links.map((a) => ({ title: a.textContent.trim(), url: a.href })),
    );
    const before = threads.length;
    for (const item of items) {
      if (!threads.some((t) => t.url === item.url)) threads.push(item);
    }
    console.log(`  страница ${pageNum}: +${threads.length - before} тем`);
    if (threads.length - before === 0 && pageNum > 1) break;
    const hasNext = (await page.locator("a.pageNav-jump--next").count()) > 0;
    if (!hasNext) break;
  }
  writeFileSync(join(outDir, "_threads.json"), JSON.stringify(threads, null, 2), "utf-8");
  status.threadsFound = threads.length;
  console.log(`  всего тем: ${threads.length} (список: ${outDir}/_threads.json)`);

  // Выкачиваем ВСЕ посты каждой темы, со всех страниц темы, с раскрытием спойлеров
  console.log("[3/3] Выкачиваю темы…");
  for (const [i, thread] of threads.entries()) {
    try {
      const textParts = [];
      const htmlParts = [];
      let title = thread.title;

      for (let tp = 1; tp <= 10; tp++) {
        const url = tp === 1 ? thread.url : `${thread.url.replace(/\/$/, "")}/page-${tp}`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForSelector("article.message-body .bbWrapper", { timeout: 30_000 });
        if (tp === 1) {
          title = (await page.textContent("h1.p-title-value").catch(() => null))?.trim() ?? thread.title;
        }
        // раскрыть спойлеры, иначе innerText не увидит скрытый текст
        await page
          .$$eval(".bbCodeSpoiler-button", (btns) => btns.forEach((b) => b.click()))
          .catch(() => {});
        await page.waitForTimeout(300);

        const posts = page.locator("article.message-body .bbWrapper");
        const count = await posts.count();
        for (let k = 0; k < count; k++) {
          textParts.push(await posts.nth(k).innerText());
          htmlParts.push(await posts.nth(k).innerHTML());
        }
        const hasNext = (await page.locator("a.pageNav-jump--next").count()) > 0;
        if (!hasNext) break;
        await page.waitForTimeout(500);
      }

      const base = `${String(i + 1).padStart(2, "0")}-${slugify(thread.title)}`;
      writeFileSync(
        join(outDir, `${base}.txt`),
        `${title}\n${thread.url}\n\n${textParts.join("\n\n===== СЛЕДУЮЩИЙ ПОСТ =====\n\n")}`,
        "utf-8",
      );
      writeFileSync(join(outDir, `${base}.html`), htmlParts.join("\n<!-- POST -->\n"), "utf-8");
      status.threadsSaved++;
      console.log(`  [${i + 1}/${threads.length}] ✓ ${thread.title} (постов: ${textParts.length})`);
    } catch (e) {
      status.errors.push(`${thread.title}: ${e.message.split("\n")[0]}`);
      console.log(`  [${i + 1}/${threads.length}] ✗ ${thread.title} — ${e.message.split("\n")[0]}`);
    }
    await page.waitForTimeout(800); // вежливая пауза
  }

  return finish(status, outDir);
}

function finish(status, outDir) {
  status.scrapedAt = new Date().toISOString();
  writeFileSync(join(outDir, "_status.json"), JSON.stringify(status, null, 2), "utf-8");
  return status;
}
