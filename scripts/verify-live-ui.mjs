import { chromium, webkit } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const engine =
  process.env.UI_REVIEW_ENGINE === "webkit" ? "webkit" : "chromium";
const output = `/tmp/scorerush-ui-review/${engine}`;
await mkdir(output, { recursive: true });
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const route of [
      "live",
      "live-delayed",
      "live-scores",
      "live-extra",
      "live-stale",
      "live-onboarding",
      "live-empty",
    ]) {
      await page.goto(`http://127.0.0.1:4173/${route}`);
      await page
        .getByRole("heading", { name: "ערב המשחקים", exact: true })
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `Overflow ${route} ${width}`,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `${output}/${route}-${width}.png`,
          fullPage: true,
        });
      if (["live-stale", "live-onboarding", "live-empty"].includes(route))
        assert.equal(
          await page
            .getByRole("heading", { name: "הטבלה הזמנית", exact: true })
            .count(),
          0,
        );
      if (route === "live-extra")
        assert.match(
          await page.locator("main").innerText(),
          /תוצאת 90 דקות לצורך הניקוד/,
        );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto("http://127.0.0.1:4173/live");
  await page
    .getByRole("heading", { name: "הטבלה הזמנית", exact: true })
    .waitFor();
  const initial = await page.evaluate(() => window.liveFixture);
  let fail = false,
    requests = 0,
    different = false;
  await page.route("**/api/live", async (route) => {
    requests++;
    if (fail)
      return route.fulfill({ status: 503, json: { error: "unavailable" } });
    const now = await page.evaluate(() => Date.now());
    return route.fulfill({
      json: {
        ...initial,
        tournamentId: different ? "another" : initial.tournamentId,
        generatedAt: new Date(now).toISOString(),
        games: initial.games.map((m) => ({
          ...m,
          syncedAt: new Date(now).toISOString(),
        })),
        standings: initial.standings.map((p) =>
          p.id === "self"
            ? { ...p, projectedPoints: 96, temporaryPoints: 12 }
            : p,
        ),
      },
    });
  });
  const hero = page.getByRole("region", { name: "המצב שלכם בערב המשחקים" });
  await page.getByRole("button", { name: "רענון ↻" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector('[aria-label="המצב שלכם בערב המשחקים"]')
      .textContent.includes("96"),
  );
  assert.equal(requests, 1);
  fail = true;
  await page.getByRole("button", { name: "רענון ↻" }).click();
  await page.getByRole("status").filter({ hasText: "העדכון מתעכב" }).waitFor();
  assert.match(await hero.innerText(), /96/);
  // Normal polling retries and withdraws expired provisional standings.
  await page.clock.fastForward(241000);
  await page
    .getByRole("status")
    .filter({ hasText: "ההערכה הזמנית הוסתרה" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "הטבלה הזמנית", exact: true })
      .count(),
    0,
  );
  assert.match(await hero.innerText(), /84/);
  assert.ok(requests >= 3);
  await page.screenshot({
    path: `${output}/live-refresh-expired-390.png`,
    fullPage: true,
  });
  fail = false;
  different = true;
  await page.getByRole("button", { name: "רענון ↻" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "הטורניר הפעיל השתנה" })
    .waitFor();
  assert.match(await hero.innerText(), /84/);
  different = false;
  await page.getByRole("button", { name: "רענון ↻" }).click();
  await page
    .getByRole("heading", { name: "הטבלה הזמנית", exact: true })
    .waitFor();
  assert.match(await hero.innerText(), /96/);
  assert.deepEqual(errors, []);
  console.log(
    `${engine}: 28 live layouts passed; refresh, polling, failure, staleness, tournament isolation and recovery passed`,
  );
} finally {
  await browser.close();
}
