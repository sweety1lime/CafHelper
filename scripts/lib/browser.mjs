// Общая Playwright-обвязка для скриптов, ходящих на forum.majestic-rp.ru:
// настоящий Edge с видимым окном и постоянным профилем — так проходится Cloudflare,
// а при необходимости логина пользователь просто входит в открывшемся окне.

import { chromium } from "playwright";
import { join } from "node:path";

export const PROFILE_DIR = join(process.env.LOCALAPPDATA ?? ".", "cafhelper-scrape-profile");

const CHALLENGE_HINTS = ["Проверяем", "Checking your browser", "Just a moment", "Verify you are human"];

export async function launchForumContext() {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "msedge",
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return { ctx, page };
}

// Ждёт, пока на странице появится readySelector; попутно объясняет в консоли,
// что происходит (Cloudflare / нужен логин). Возвращает "ready" | "timeout".
export async function waitForContentOrLogin(page, readySelector, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((await page.locator(readySelector).count()) > 0) return "ready";
    const body = (await page.textContent("body").catch(() => "")) ?? "";
    if (CHALLENGE_HINTS.some((h) => body.includes(h))) {
      console.log("[wait] Cloudflare-проверка… (пройдёт сама или кликни чекбокс в окне браузера)");
    } else if (body.includes("войти") || body.includes("Вход") || page.url().includes("/login")) {
      console.log("[wait] Похоже, нужен вход в аккаунт — залогинься в окне браузера, я жду…");
    } else {
      console.log("[wait] Жду загрузку страницы…");
    }
    await page.waitForTimeout(3000);
  }
  return "timeout";
}
