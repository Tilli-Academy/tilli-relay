/**
 * Direct API client for test data seeding and teardown.
 * Bypasses the UI for faster, more reliable setup.
 */

import type { APIRequestContext } from "@playwright/test";

export class ApiClient {
  constructor(
    private request: APIRequestContext,
    private baseURL: string,
    private headers: Record<string, string> = {},
  ) {}

  private url(path: string): string {
    return `${this.baseURL}${path}`;
  }

  // ── Requests ──

  async createRequest(name: string, curl: string) {
    const res = await this.request.post(this.url("/api/requests"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { name, curl },
    });
    return res.json();
  }

  async deleteRequest(id: string) {
    await this.request.delete(this.url(`/api/requests/${id}`), {
      headers: this.headers,
    });
  }

  async listRequests() {
    const res = await this.request.get(this.url("/api/requests"), {
      headers: this.headers,
    });
    return res.json();
  }

  // ── Collections ──

  async createCollection(name: string) {
    const res = await this.request.post(this.url("/api/collections"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { name },
    });
    return res.json();
  }

  async deleteCollection(id: string) {
    await this.request.delete(this.url(`/api/collections/${id}`), {
      headers: this.headers,
    });
  }

  async addRequestToCollection(
    collectionId: string,
    name: string,
    curl: string,
  ) {
    const res = await this.request.post(
      this.url(`/api/collections/${collectionId}/requests`),
      {
        headers: { "Content-Type": "application/json", ...this.headers },
        data: { name, curl },
      },
    );
    return res.json();
  }

  // ── Folders ──

  async createFolder(name: string, parentId?: string) {
    const res = await this.request.post(this.url("/api/folders"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { name, parentId },
    });
    return res.json();
  }

  async deleteFolder(id: string) {
    await this.request.delete(this.url(`/api/folders/${id}`), {
      headers: this.headers,
    });
  }

  // ── Environments ──

  async createEnvironment(name: string) {
    const res = await this.request.post(this.url("/api/environments"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { name },
    });
    return res.json();
  }

  async deleteEnvironment(id: string) {
    await this.request.delete(this.url(`/api/environments/${id}`), {
      headers: this.headers,
    });
  }

  async activateEnvironment(id: string) {
    await this.request.put(this.url(`/api/environments/${id}`), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { isActive: true },
    });
  }

  // ── Variables ──

  async createVariable(
    key: string,
    value: string,
    environmentId: string,
    isSecret = false,
  ) {
    const res = await this.request.post(this.url("/api/variables"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { key, value, environmentId, isSecret },
    });
    return res.json();
  }

  async deleteVariable(id: string) {
    await this.request.delete(this.url(`/api/variables/${id}`), {
      headers: this.headers,
    });
  }

  // ── History ──

  async clearHistory() {
    await this.request.delete(this.url("/api/history"), {
      headers: this.headers,
    });
  }
}
