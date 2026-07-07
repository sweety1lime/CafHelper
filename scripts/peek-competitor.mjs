// Разведка UI конкурента (majestic.center) — открывает страницы в Edge и снимает скриншоты
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "competitor-shots";
const PROFILE_DIR = join(process.env.LOCALAPPDATA ?? ".", "cafhelper-scrape-profile");
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "https://atlanta.majestic.center/"],
  ["uk", "https://atlanta.majestic.center/criminal-code"],
  ["laws", "https://atlanta.majestic.center/laws"],
];

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: "msedge",
  headless: false,
  viewport: { width: 1400, height: 900 },
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

for (const [name, url] of PAGES) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
    // список внутренних ссылок с главной — понять структуру разделов
    if (name === "home") {
      const links = await page.$$eval("a[href]", (as) =>
        [...new Set(as.map((a) => `${a.textContent.trim().slice(0, 40)} -> ${a.getAttribute("href")}`))].slice(0, 60),
      );
      console.log("LINKS:\n" + links.join("\n"));
    }
    console.log(`shot: ${name} (${page.url()})`);
  } catch (e) {
    console.log(`fail ${name}: ${e.message.split("\n")[0]}`);
  }
}
await ctx.close();
