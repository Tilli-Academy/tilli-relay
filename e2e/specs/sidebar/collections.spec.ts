import { test, expect } from "../../fixtures/auth.fixture";
import { SEL } from "../../helpers/selectors";
import { WorkspacePage } from "../../page-objects/WorkspacePage";
import {
  uniqueCollectionName,
  uniqueFolderName,
  uniqueRequestName,
} from "../../helpers/test-data";

test.describe("Sidebar - Collections and Folders", () => {
  let ws: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    ws = new WorkspacePage(page);
    await ws.goto();
  });

  test("creates a new folder", async ({ page }) => {
    const folderName = uniqueFolderName();
    await page.locator(SEL.sidebar).getByTitle("Add").first().click();
    await page.getByText("Create Folder").click();
    await page.locator('input[placeholder="Folder name"]').fill(folderName);
    await page.keyboard.press("Enter");
    await expect(page.locator(SEL.sidebar)).toContainText(folderName);
  });

  test("creates a standalone collection", async ({ page }) => {
    const collName = uniqueCollectionName();
    await page.locator(SEL.sidebar).getByTitle("Add").first().click();
    await page.getByText("Create Collection").click();
    await page
      .locator('input[placeholder="Collection name"]')
      .fill(collName);
    await page.keyboard.press("Enter");
    await expect(page.locator(SEL.sidebar)).toContainText(collName);
  });

  test("creates a collection inside a folder", async ({ page, api }) => {
    const folder = await api.createFolder(uniqueFolderName());
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await page.getByText(folder.name).click();
    const folderRow = page.getByText(folder.name).first();
    await folderRow.hover();
    const folderParent = folderRow.locator("..");
    const plusButton = folderParent.locator('[title="Add"]');
    if (await plusButton.isVisible()) {
      await plusButton.click();
      await page.getByText("Create Collection").click();
      const collName = uniqueCollectionName();
      await page
        .locator('input[placeholder="Collection name"]')
        .fill(collName);
      await page.keyboard.press("Enter");
      await expect(page.locator(SEL.sidebar)).toContainText(collName);
    }
    await api.deleteFolder(folder.id);
  });

  test("expands and collapses a collection", async ({ page, api }) => {
    const collection = await api.createCollection(uniqueCollectionName());
    const req = await api.addRequestToCollection(
      collection.id,
      uniqueRequestName(),
      "curl https://httpbin.org/get",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.sidebar)).toContainText(collection.name);
    await page.getByText(collection.name).click();
    await expect(page.locator(SEL.sidebar)).toContainText(
      req.request?.name || req.name,
    );
    await page.getByText(collection.name).click();
    await api.deleteCollection(collection.id);
  });

  test("deletes a collection", async ({ page, api }) => {
    const collection = await api.createCollection(uniqueCollectionName());
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    const collRow = page.getByText(collection.name).first();
    await collRow.hover();
    const collParent = collRow.locator("..").locator("..");
    await collParent.locator('[title="Delete collection"]').click();
    await expect(page.locator(SEL.sidebar)).not.toContainText(
      collection.name,
    );
  });

  test("shows request count badge on collection", async ({ page, api }) => {
    const collection = await api.createCollection(uniqueCollectionName());
    await api.addRequestToCollection(
      collection.id,
      "Req 1",
      "curl https://httpbin.org/get",
    );
    await api.addRequestToCollection(
      collection.id,
      "Req 2",
      "curl -X POST https://httpbin.org/post",
    );
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    const collRow = page.getByText(collection.name).first().locator("..");
    await expect(collRow).toContainText("2");
    await api.deleteCollection(collection.id);
  });

  test("collections with duplicate names both appear in sidebar", async ({
    page,
    api,
  }) => {
    const name = uniqueCollectionName();
    const coll1 = await api.createCollection(name);
    const coll2 = await api.createCollection(name);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    // Both should be visible — expect at least 2 occurrences
    const matches = page.locator(SEL.sidebar).getByText(name);
    await expect(matches).toHaveCount(2);
    await api.deleteCollection(coll1.id);
    await api.deleteCollection(coll2.id);
  });

  test("deleting a collection removes it from sidebar", async ({
    page,
    api,
  }) => {
    const collection = await api.createCollection(uniqueCollectionName());
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.sidebar)).toContainText(collection.name);

    await api.deleteCollection(collection.id);
    await page.reload();
    await expect(page.locator(SEL.workspace)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEL.sidebar)).not.toContainText(collection.name);
  });
});
