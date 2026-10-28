import { test, expect } from "@playwright/test";
import { loadDecks } from "../scripts/project.mjs";

const sourceDecks = await loadDecks();
const expected = Object.fromEntries(sourceDecks.map(deck => [
  deck.output,
  deck.slides.map(slide => slide.html.match(/<section\b[^>]*\bid="([^"]+)"/)[1])
]));

for (const [pagePath, ids] of Object.entries(expected)) {
  test.describe(pagePath, () => {
    test("loads every slide, navigation, notes, and overview", async ({
      page,
    }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/" + pagePath);
      await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
        "id",
        ids[0],
      );
      await expect(page.locator("#slide-total")).toHaveText(
        String(ids.length).padStart(2, "0"),
      );

      for (let index = 1; index < ids.length; index++) {
        await page.keyboard.press("ArrowRight");
        await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
          "id",
          ids[index],
        );
        await expect(page).toHaveURL(new RegExp("#" + ids[index] + "$"));
      }
      await expect(page.locator("#next-button")).toBeDisabled();
      await page.keyboard.press("Home");
      await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
        "id",
        ids[0],
      );
      const pivot = Math.min(4, ids.length - 1);
      await page.keyboard.press(String(pivot + 1));
      await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
        "id",
        ids[pivot],
      );
      await page.keyboard.press("n");
      await expect(page.locator("#notes-panel")).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      await expect(page.locator("#notes-text")).not.toBeEmpty();
      await page.keyboard.press("Escape");
      await expect(page.locator("#notes-panel")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      await page.keyboard.press("o");
      await expect(page.locator("#overview")).toHaveAttribute(
        "aria-hidden",
        "false",
      );
      await expect(page.locator(".overview-card")).toHaveCount(ids.length);
      await expect(page.locator(".overview-card").nth(pivot)).toBeFocused();
      const theme = await page.locator(".presentation").getAttribute("data-theme");
      await expect(page.locator(".overview-preview").first()).toHaveAttribute("data-theme", theme);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await expect(page.locator("#overview")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
        "id",
        ids[Math.min(pivot + 1, ids.length - 1)],
      );
      expect(errors).toEqual([]);
    });

    test("keeps each slide and primary action inside the 16:9 canvas", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto("/" + pagePath);
      for (let index = 0; index < ids.length; index++) {
        if (index) await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(80);
        const overflows = await page
          .locator("#stage > .slide.is-active")
          .evaluate((slide) => {
            const canvas = document
              .querySelector("#stage")
              .getBoundingClientRect();
            const content = [
              ...slide.querySelectorAll(
                "h1,h2,h3,button,input,.deck-footer,.end-footer,.slide-folio",
              ),
            ];
            return content
              .filter((element) => {
                if (!element.getClientRects().length) return false;
                const box = element.getBoundingClientRect();
                return (
                  box.width > 0 &&
                  (box.left < canvas.left - 1 ||
                    box.right > canvas.right + 1 ||
                    box.top < canvas.top - 1 ||
                    box.bottom > canvas.bottom + 1)
                );
              })
              .map((element) => ({
                tag: element.tagName,
                text: element.textContent.trim().slice(0, 30),
              }));
          });
        expect(overflows, "slide " + ids[index]).toEqual([]);
      }
    });
  });
}

test("scales cleanly on a narrow viewport while controls remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teamflow.html");
  const stage = page.locator("#stage");
  await expect(stage).toBeVisible();
  await expect(page.locator("#next-button")).toBeVisible();
  const dimensions = await stage.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      viewportWidth: innerWidth,
    };
  });
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.height / dimensions.width).toBeCloseTo(9 / 16, 2);
  await page.locator("#next-button").click();
  await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
    "id",
    "problem",
  );
});

test("gallery links to each deck and is keyboard accessible", async ({
  page,
}) => {
  await page.goto("/gallery.html");
  await expect(page.locator(".gallery-top a")).toBeVisible();
  await expect(page.locator(".gallery-card")).toHaveCount(sourceDecks.length);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", /\.html/);
});

test("teamflow calculator follows its stated scenario assumptions", async ({
  page,
}) => {
  await page.goto("/teamflow.html#calculator");
  await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
    "id",
    "calculator",
  );
  await expect(page.locator("#saved-value")).toHaveText("7.2");
  await page.locator("#team-size").fill("12");
  await expect(page.locator("#team-size-value")).toHaveText("12 人");
  await expect(page.locator("#before-value")).toHaveText("14.4 小时");
  await expect(page.locator("#after-value")).toHaveText("3.6 小时");
  await expect(page.locator("#saved-value")).toHaveText("10.8");
  await page.locator("#next-button").click();
  await page.locator("#next-button").click();
  await page.locator("#revisit-calculator").click();
  await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
    "id",
    "calculator",
  );
});

test("coding agent deck keeps demo behavior local to its slides", async ({
  page,
}) => {
  await page.goto("/coding-agent.html#live-demo");
  await expect(page.locator("#stage > .slide.is-active")).toHaveAttribute(
    "id",
    "live-demo",
  );
  await page.locator("#build-button").click();
  await expect(page.locator("#mini-browser")).toHaveClass(/is-visible/, {
    timeout: 5000,
  });
  await expect(page.locator("#build-status")).toContainText("检查完成");
  await page.goto("/coding-agent.html#frontier");
  await page.locator("#scene-button").click();
  await expect(page.locator("#scene-button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#scene-caption")).toHaveText(
    "你刚刚改变了这个空间。",
  );
});

test("deck pages load with no external requests", async ({ page }) => {
  const external = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:9876/"))
      external.push(request.url());
  });
  for (const pagePath of ["/", "/teamflow.html", "/gallery.html"])
    await page.goto(pagePath);
  expect(external).toEqual([]);
});
