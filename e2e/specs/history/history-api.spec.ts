/**
 * History API tests: create, list, delete history entries.
 * These tests use createHistoryEntry directly to test the history CRUD API.
 * (History is normally written client-side after execution.)
 */

import { test, expect } from "../../fixtures/auth.fixture";
import { MOCK_BASE } from "../../helpers/test-data";

test.describe("History — API", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ api }) => {
    await api.clearHistory();
  });

  test("creating a history entry stores it", async ({ api }) => {
    await api.createHistoryEntry({
      method: "GET",
      url: `${MOCK_BASE}/get`,
      curl: `curl ${MOCK_BASE}/get`,
      statusCode: 200,
      timeMs: 150,
    });

    const history = await api.getHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  test("history entry contains method, url, statusCode, timeMs", async ({ api }) => {
    await api.createHistoryEntry({
      method: "POST",
      url: `${MOCK_BASE}/post`,
      curl: `curl -X POST ${MOCK_BASE}/post`,
      statusCode: 200,
      timeMs: 250,
    });

    const history = await api.getHistory();
    const entry = history[0];
    expect(entry).toBeTruthy();
    expect(entry.method).toBe("POST");
    expect(entry.url).toContain("localhost:9444/post");
    expect(entry.statusCode).toBe(200);
    expect(typeof entry.timeMs).toBe("number");
    expect(entry.timeMs).toBeGreaterThan(0);
  });

  test("DELETE /api/history/:id removes single entry", async ({ api }) => {
    await api.createHistoryEntry({
      method: "GET",
      url: `${MOCK_BASE}/get`,
      curl: `curl ${MOCK_BASE}/get`,
      statusCode: 200,
      timeMs: 100,
    });

    const history = await api.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    const entryId = history[0].id;

    await api.deleteHistoryEntry(entryId);
    const afterDelete = await api.getHistory();
    const found = afterDelete.find((e: { id: string }) => e.id === entryId);
    expect(found).toBeFalsy();
  });

  test("DELETE /api/history clears all entries", async ({ api }) => {
    await api.createHistoryEntry({
      method: "GET",
      url: `${MOCK_BASE}/get`,
      curl: `curl ${MOCK_BASE}/get`,
      statusCode: 200,
      timeMs: 100,
    });
    await api.createHistoryEntry({
      method: "POST",
      url: `${MOCK_BASE}/post`,
      curl: `curl -X POST ${MOCK_BASE}/post`,
      statusCode: 200,
      timeMs: 200,
    });

    const before = await api.getHistory();
    expect(before.length).toBeGreaterThanOrEqual(2);

    await api.clearHistory();
    const after = await api.getHistory();
    expect(Array.isArray(after)).toBe(true);
    expect(after.length).toBe(0);
  });

  test("history respects limit parameter", async ({ api }) => {
    await api.createHistoryEntry({
      method: "GET",
      url: `${MOCK_BASE}/get`,
      curl: `curl ${MOCK_BASE}/get`,
      statusCode: 200,
      timeMs: 100,
    });
    await api.createHistoryEntry({
      method: "POST",
      url: `${MOCK_BASE}/post`,
      curl: `curl -X POST ${MOCK_BASE}/post`,
      statusCode: 200,
      timeMs: 200,
    });
    await api.createHistoryEntry({
      method: "PUT",
      url: `${MOCK_BASE}/put`,
      curl: `curl -X PUT ${MOCK_BASE}/put`,
      statusCode: 200,
      timeMs: 300,
    });

    const limited = await api.getHistory(1);
    expect(Array.isArray(limited)).toBe(true);
    expect(limited.length).toBe(1);

    const all = await api.getHistory(50);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  test("history entries are user-scoped", async ({ api, secondApi }) => {
    await api.clearHistory();
    await secondApi.clearHistory();

    await api.createHistoryEntry({
      method: "GET",
      url: `${MOCK_BASE}/get`,
      curl: `curl ${MOCK_BASE}/get`,
      statusCode: 200,
      timeMs: 100,
    });

    const worker0History = await api.getHistory();
    expect(worker0History.length).toBeGreaterThanOrEqual(1);

    // Worker 1's history should not contain worker 0's entries
    const worker1History = await secondApi.getHistory();
    expect(worker1History.length).toBe(0);
  });

  test("history entry stores curl command", async ({ api }) => {
    await api.createHistoryEntry({
      method: "DELETE",
      url: `${MOCK_BASE}/delete`,
      curl: `curl -X DELETE ${MOCK_BASE}/delete`,
      statusCode: 200,
      timeMs: 150,
    });

    const history = await api.getHistory();
    const entry = history[0];
    expect(entry.curl).toContain("localhost:9444/delete");
    expect(entry.method).toBe("DELETE");
  });
});
