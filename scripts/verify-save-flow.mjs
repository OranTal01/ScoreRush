import { chromium, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const engine =
  process.env.UI_REVIEW_ENGINE === "webkit" ? "webkit" : "chromium";
const output = `/tmp/scorerush-save-review/${engine}`;
await mkdir(output, { recursive: true });
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const first = "11111111-1111-4111-8111-111111111111",
  second = "22222222-2222-4222-8222-222222222222";
try {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    let fail = false,
      count = 0,
      bonuses = 0;
    await page.route("**/api/match-predictions", async (route) => {
      count++;
      const body = route.request().postDataJSON();
      assert.equal(body.advance, true);
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (fail)
        return route.fulfill({
          status: 400,
          json: { status: "error", code: "locked" },
        });
      return route.fulfill({
        json: {
          status: "success",
          predictedHome: body.predictedHome,
          predictedAway: body.predictedAway,
          continuation: {
            nextMatchId: body.matchId === first ? second : null,
            remaining: body.matchId === first ? 1 : 0,
          },
        },
      });
    });
    await page.route("**/api/bonus-predictions", async (route) => {
      bonuses++;
      await new Promise((resolve) => setTimeout(resolve, 350));
      return route.fulfill({
        json: fail
          ? { status: "error", code: "locked" }
          : { status: "success", categoryId: "bonus-cat" },
      });
    });
    await page.goto(`http://127.0.0.1:4173/predictions/${first}`);
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page
      .getByRole("button", { name: "הוספת שער לManchester United" })
      .click();
    await page.getByRole("button", { name: "שמירה והבא ←" }).click();
    assert.equal(
      await page.locator("[data-save-toast]").count(),
      0,
      "Never claim success while pending",
    );
    await page.waitForURL(`**/predictions/${second}`);
    await page.getByRole("heading", { name: "המשחק הבא" }).waitFor();
    await page.getByText("הניחוש נשמר בהצלחה", { exact: true }).waitFor();
    assert.equal(count, 1);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const toast = await page.locator("[data-save-toast]").boundingBox();
    assert.ok(
      toast.x >= 0 &&
        toast.x + toast.width <= width &&
        toast.y >= 0 &&
        toast.y < 80,
    );
    await page.screenshot({
      path: `${output}/next-toast-${width}.png`,
      fullPage: true,
    });
    fail = true;
    await page.getByRole("button", { name: "סגירת הודעת השמירה" }).click();
    await page.getByRole("button", { name: "הוספת שער לArsenal" }).click();
    await page.getByRole("button", { name: "שמירה והבא ←" }).click();
    await page.getByText("הניחוש לא נשמר", { exact: true }).waitFor();
    assert.ok(page.url().endsWith(second));
    assert.equal(
      await page.locator('input[name="predictedHome"]').inputValue(),
      "1",
    );
    assert.equal(
      await page.getByText("הניחוש נשמר בהצלחה", { exact: true }).count(),
      0,
    );
    fail = false;
    await page.getByRole("button", { name: "שמירה והבא ←" }).click();
    await page.waitForURL("**/predictions");
    await page.getByText(/סיימתם את המשחקים הפתוחים/).waitFor();
    await page.screenshot({
      path: `${output}/complete-${width}.png`,
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:4173/bonuses");
    await page
      .getByRole("textbox")
      .first()
      .fill("Michael Olise · FC Bayern München");
    await page.getByRole("button", { name: "שמירת בחירות", exact: true }).click();
    await page.getByText("הבונוסים נשמרו בהצלחה", { exact: true }).waitFor();
    assert.ok(page.url().endsWith("/bonuses"));
    assert.equal(bonuses, 1);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `${output}/bonus-toast-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "סגירת הודעת השמירה" }).click();
    fail = true;
    await page.getByRole("textbox").first().fill("Lamine Yamal");
    await page.getByRole("button", { name: "שמירת בחירות", exact: true }).click();
    await page.getByText("הבונוסים לא נשמרו", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("textbox").first().inputValue(),
      "Lamine Yamal",
    );
    assert.equal(
      await page.getByText("הבונוסים נשמרו בהצלחה", { exact: true }).count(),
      0,
    );
    await page.unroute("**/api/match-predictions");
    await page.unroute("**/api/bonus-predictions");
  }
  assert.deepEqual(errors, []);
  console.log(
    `${engine}: four widths passed — next match, persisted toast, round completion, failed save, bonus success/error, retained inputs and no overflow`,
  );
} finally {
  await browser.close();
}
