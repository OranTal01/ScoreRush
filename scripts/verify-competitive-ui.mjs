import { chromium, webkit } from "@playwright/test";
import { mkdir, stat } from "node:fs/promises";
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
    await page.setViewportSize({ width, height: width >= 1000 ? 1000 : 844 });
    for (const route of [
      "/",
      "/predictions",
      "/leaderboard",
      "/summaries",
      "/history",
      "/history-empty",
      "/friends",
      "/friends-hidden",
      "/welcome",
    ]) {
      await page.goto(`http://127.0.0.1:4173${route}`);
      await page.locator("main").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `Overflow ${route} ${width}`,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `${output}/${route === "/" ? "home" : route.slice(1)}-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/predictions");
  await page.getByRole("button", { name: "מילוי מהיר ⚡" }).click();
  const forms = page.locator("[data-quick-match]");
  assert.equal(await forms.count(), 2);
  const first = forms.nth(0),
    second = forms.nth(1);
  assert.equal(await first.locator("input").first().inputValue(), "");
  let requests = 0;
  await page.route("**/api/match-predictions", async (route) => {
    requests++;
    const data = route.request().postDataJSON();
    if (requests === 1) {
      assert.equal(data.predictedHome, 0);
      assert.equal(data.predictedAway, 2);
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 200,
        json: { status: "success", predictedHome: 0, predictedAway: 2 },
      });
    } else
      await route.fulfill({
        status: 400,
        json: { status: "error", code: "locked" },
      });
  });
  await first.locator("input").nth(0).fill("0");
  await first.locator("input").nth(1).fill("2");
  await first.getByRole("button", { name: "שמירה והבא ←" }).click();
  await first.getByRole("button", { name: "הניחוש שמור ✓" }).waitFor();
  assert.equal(await page.getByRole("progressbar").getAttribute("value"), "1");
  assert.equal(
    await second
      .locator("input")
      .first()
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await second.locator("input").nth(0).fill("1");
  await second.locator("input").nth(1).fill("0");
  await second.getByRole("button", { name: "שמירה והבא ←" }).click();
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /ננעל/);
  assert.equal(await page.getByRole("progressbar").getAttribute("value"), "1");
  assert.equal(requests, 2);
  await page.screenshot({
    path: `${output}/quick-save-error-390.png`,
    fullPage: true,
  });
  page.once("dialog", (d) => d.accept());
  await page.goto("http://127.0.0.1:4173/summaries");
  await page.goto("http://127.0.0.1:4173/predictions");
  await page.getByRole("button", { name: "מילוי מהיר ⚡" }).click();
  await page
    .locator("[data-quick-match]")
    .nth(1)
    .locator("input")
    .first()
    .waitFor();
  assert.equal(
    await page
      .locator("[data-quick-match]")
      .nth(1)
      .locator("input")
      .first()
      .inputValue(),
    "1",
  );
  assert.equal(requests, 2, "Restoration must not submit a draft");
  const quick = page.locator("[data-quick-match]").first();
  await quick.locator("input").nth(0).fill("0");
  await quick.locator("input").nth(1).fill("2");
  page.once("dialog", (d) => d.accept());
  await quick.getByRole("link", { name: "פרטים" }).click();
  await page
    .getByRole("button", { name: "הוספת שער לManchester United" })
    .waitFor();
  assert.equal(
    await page.locator('input[name="predictedHome"]').inputValue(),
    "0",
  );
  assert.equal(
    await page.locator('input[name="predictedAway"]').inputValue(),
    "2",
  );
  assert.equal(requests, 2);
  // Detail saves now use the same bounded HTTP endpoint as quick entry.
  // This fixture checks draft clearing when the follow-up read is unavailable;
  // verify-save-flow.mjs covers successful automatic navigation separately.
  await page.unroute("**/api/match-predictions");
  await page.route("**/api/match-predictions", (route) =>
    route.fulfill({
      status: 200,
      json: { status: "success", predictedHome: 0, predictedAway: 2 },
    }),
  );
  await page.locator('button[type="submit"]').click();
  await page.getByRole("status").filter({ hasText: /נשמר/ }).waitFor();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem(
        "scorerush:prediction-draft:v1:test-cup:self:11111111-1111-4111-8111-111111111111",
      ),
    ),
    null,
  );
  await page.goto("http://127.0.0.1:4173/welcome");
  await page.getByRole("button", { name: "ממשיכים עם הכינוי שלי ←" }).click();
  await page.screenshot({
    path: `${output}/welcome-rules-390.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "הבנתי, עוברים לניחוש ←" }).click();
  await page.locator("[data-quick-match] input").nth(0).fill("2");
  await page.locator("[data-quick-match] input").nth(1).fill("1");
  await page.reload();
  await page
    .getByRole("navigation", { name: "שלבי ההיכרות" })
    .getByRole("button", { name: /ניחוש ראשון/ })
    .click();
  assert.equal(
    await page.locator("[data-quick-match] input").nth(0).inputValue(),
    "2",
  );
  assert.equal(
    await page.getByRole("progressbar").getAttribute("aria-valuenow"),
    "2",
  );
  await page.unroute("**/api/match-predictions");
  await page.route("**/api/match-predictions", (route) =>
    route.fulfill({
      status: 200,
      json: { status: "success", predictedHome: 2, predictedAway: 1 },
    }),
  );
  await page.getByRole("button", { name: "שמירה והבא ←" }).click();
  await page.getByText("✓ הניחוש הראשון שלכם כבר באתר").waitFor();
  assert.equal(
    await page.getByRole("progressbar").getAttribute("aria-valuenow"),
    "3",
  );
  await page.getByRole("button", { name: "מעולה, להתראות ←" }).click();
  await page.getByRole("button", { name: "אמשיך בלי התראות כרגע" }).click();
  assert.equal(
    await page.getByRole("progressbar").getAttribute("aria-valuenow"),
    "4",
  );
  await page.screenshot({
    path: `${output}/welcome-finish-390.png`,
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:4173/history");
  await page.getByRole("combobox").selectOption("b");
  assert.match(await page.getByRole("img").getAttribute("aria-label"), /עילאי/);
  await page.goto("http://127.0.0.1:4173/summaries");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "הורדת תמונה לקבוצה ↓" }).click();
  const download = await downloadEvent;
  await download.saveAs(`${output}/summary-export.png`);
  assert((await stat(`${output}/summary-export.png`)).size > 30000);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      layoutChecks: 36,
      drafts: "cross-screen restore, no automatic submission, clear on success",
      welcome:
        "complete with a confirmed first pick and explicit notification skip",
      history: "ranking selection passed",
      quickSave: "passed",
      lockFailure: "passed",
      focusNext: "passed",
      pngExport: "passed",
      browserErrors: errors,
      output,
    }),
  );
} finally {
  await browser.close();
}
