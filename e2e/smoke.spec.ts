import { expect, test } from "@playwright/test";

test("home page renders the Phase 1 token showcase", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ScoreRush/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "ScoreRush" })).toBeVisible();
});
