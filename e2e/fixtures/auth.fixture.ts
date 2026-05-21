/**
 * Authenticated test fixture.
 * Each Playwright worker gets its own test user with isolated data.
 * StorageState is reused so login only happens once per worker.
 *
 * IMPORTANT: Uses parallelIndex (0..workers-1) instead of workerIndex
 * to avoid ENOENT when workers are recycled (workerIndex keeps incrementing).
 */

import { test as base, expect } from "@playwright/test";
import path from "path";
import { ApiClient } from "../helpers/api-client";

// Per-worker credentials
export function testUserForWorker(index: number) {
  return {
    email: `e2e-worker-${index}@test.reqify.local`,
    password: "TestP@ss1234!",
  };
}

export function storageStatePath(index: number) {
  return path.resolve(__dirname, `../.auth/worker-${index}.json`);
}

// Extended test fixture with authenticated page, testUser, and api client
type AuthFixtures = {
  testUser: { email: string; password: string };
  api: ApiClient;
};

export const test = base.extend<AuthFixtures>({
  // Provide storageState from the file created in global-setup
  storageState: async ({}, use, workerInfo) => {
    await use(storageStatePath(workerInfo.parallelIndex));
  },

  testUser: async ({}, use, workerInfo) => {
    await use(testUserForWorker(workerInfo.parallelIndex));
  },

  api: async ({ playwright, baseURL }, use, workerInfo) => {
    // Create a request context that uses the same storageState cookies
    const storagePath = storageStatePath(workerInfo.parallelIndex);
    const context = await playwright.request.newContext({
      baseURL: baseURL!,
      storageState: storagePath,
    });
    const client = new ApiClient(context, baseURL!);
    await use(client);
    await context.dispose();
  },
});

export { expect };
