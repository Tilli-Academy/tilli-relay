import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import { samplePostmanCollection, uniqueId } from "../../helpers/test-data";
import path from "path";
import fs from "fs";

test.describe("Postman Import and Export", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("imports a Postman v2.1 collection", async ({ page }) => {
    const collection = samplePostmanCollection(`Import Test ${uniqueId()}`);
    const tmpFile = path.join("/tmp", `postman-${uniqueId()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(collection));
    const fileInput = page.locator(SEL.importFileInput);
    await fileInput.setInputFiles(tmpFile);
    await ws.expectToast(/imported|2 request/i);
    await expect(page.locator(SEL.sidebar)).toContainText(
      collection.info.name,
    );
    fs.unlinkSync(tmpFile);
  });

  test("imported collection has correct requests", async ({ page }) => {
    const collection = samplePostmanCollection(`Verify ${uniqueId()}`);
    const tmpFile = path.join("/tmp", `postman-${uniqueId()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(collection));
    await page.locator(SEL.importFileInput).setInputFiles(tmpFile);
    await ws.expectToast(/imported/i);
    // Wait for the sidebar to update and the collection to appear
    const collectionButton = page
      .locator(SEL.sidebar)
      .getByRole("button", { name: new RegExp(collection.info.name) });
    await expect(collectionButton).toBeVisible({ timeout: 10_000 });
    await collectionButton.click();
    await expect(page.locator(SEL.sidebar)).toContainText("Get Users", {
      timeout: 10_000,
    });
    await expect(page.locator(SEL.sidebar)).toContainText("Create User");
    fs.unlinkSync(tmpFile);
  });

  test("shows error for invalid JSON file", async ({ page }) => {
    const tmpFile = path.join("/tmp", `invalid-${uniqueId()}.json`);
    fs.writeFileSync(tmpFile, "this is not valid json!!!");
    await page.locator(SEL.importFileInput).setInputFiles(tmpFile);
    await ws.expectToast(/failed|error|invalid/i);
    fs.unlinkSync(tmpFile);
  });

  test("exports a collection as Postman JSON", async ({ page, api }) => {
    const collection = await api.createCollection(`Export Test ${uniqueId()}`);
    await api.addRequestToCollection(
      collection.id,
      "Export Req",
      "curl https://httpbin.org/get",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.getByText(collection.name).first().hover();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByText(collection.name)
        .first()
        .locator("..")
        .locator("..")
        .locator('[title="Export as Postman JSON"]')
        .click(),
    ]);
    expect(download.suggestedFilename()).toContain(".json");
    await api.deleteCollection(collection.id);
  });
});
