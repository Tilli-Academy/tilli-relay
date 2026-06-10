/**
 * Direct API client for test data seeding and teardown.
 * Bypasses the UI for faster, more reliable setup.
 */

import type { APIRequestContext, APIResponse } from "@playwright/test";

export class ApiClient {
  constructor(
    private request: APIRequestContext,
    private baseURL: string,
    private headers: Record<string, string> = {},
  ) {}

  private url(path: string): string {
    return `${this.baseURL}${path}`;
  }

  /** Returns headers with x-team-id for team-scoped operations */
  private teamHeaders(teamId: string): Record<string, string> {
    return { "Content-Type": "application/json", "x-team-id": teamId, ...this.headers };
  }

  // ── Raw HTTP (for IDOR / auth tests) ──

  async rawGet(path: string): Promise<APIResponse> {
    return this.request.get(this.url(path), { headers: this.headers });
  }

  async rawPost(path: string, data: unknown): Promise<APIResponse> {
    return this.request.post(this.url(path), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data,
    });
  }

  async rawPut(path: string, data: unknown): Promise<APIResponse> {
    return this.request.put(this.url(path), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data,
    });
  }

  async rawDelete(path: string): Promise<APIResponse> {
    return this.request.delete(this.url(path), { headers: this.headers });
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

  async getHistory(limit?: number) {
    const query = limit ? `?limit=${limit}` : "";
    const res = await this.request.get(this.url(`/api/history${query}`), {
      headers: this.headers,
    });
    return res.json();
  }

  async deleteHistoryEntry(id: string) {
    await this.request.delete(this.url(`/api/history/${id}`), {
      headers: this.headers,
    });
  }

  /** Create a history entry directly (history is normally written client-side after execution) */
  async createHistoryEntry(data: {
    method: string;
    url: string;
    curl: string;
    statusCode: number;
    timeMs: number;
    responseHeaders?: string;
    responseBody?: string;
  }) {
    const res = await this.request.post(this.url("/api/history"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data,
    });
    return res.json();
  }

  /** Execute a request AND create a history entry (mimics what the UI does) */
  async executeAndRecordHistory(curl: string) {
    const res = await this.request.post(this.url("/api/execute"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { curl },
    });
    const result = await res.json().catch(() => ({}));

    // Mimic what the UI does: POST to /api/history
    const methodMatch = curl.match(/-X\s+(\w+)/);
    const method = methodMatch ? methodMatch[1] : "GET";
    const urlMatch = curl.match(/https?:\/\/\S+/);
    const url = urlMatch ? urlMatch[0] : "";

    await this.request.post(this.url("/api/history"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: {
        method,
        url,
        curl,
        statusCode: result.status || 0,
        timeMs: result.timeMs || 0,
        responseHeaders: JSON.stringify(result.headers || {}),
        responseBody: result.body || "",
      },
    });

    return result;
  }

  // ── Request updates ──

  async updateRequest(id: string, data: { name?: string; curl?: string }) {
    const res = await this.request.put(this.url(`/api/requests/${id}`), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data,
    });
    return res.json();
  }

  // ── Collection updates ──

  async updateCollection(id: string, data: { name?: string; description?: string }) {
    const res = await this.request.put(this.url(`/api/collections/${id}`), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data,
    });
    return res.json();
  }

  async listCollections() {
    const res = await this.request.get(this.url("/api/collections"), {
      headers: this.headers,
    });
    return res.json();
  }

  // ── Environment listing ──

  async listEnvironments() {
    const res = await this.request.get(this.url("/api/environments"), {
      headers: this.headers,
    });
    return res.json();
  }

  // ── Folder listing / updates ──

  async listFolders() {
    const res = await this.request.get(this.url("/api/folders"), {
      headers: this.headers,
    });
    return res.json();
  }

  async updateFolder(id: string, data: { name?: string }) {
    const res = await this.request.put(this.url(`/api/folders/${id}`), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data,
    });
    return res.json();
  }

  // ── Team-scoped operations ──

  async createRequestInTeam(teamId: string, name: string, curl: string) {
    const res = await this.request.post(this.url("/api/requests"), {
      headers: this.teamHeaders(teamId),
      data: { name, curl },
    });
    return res.json();
  }

  async listRequestsInTeam(teamId: string) {
    const res = await this.request.get(this.url("/api/requests"), {
      headers: { "x-team-id": teamId, ...this.headers },
    });
    return res.json();
  }

  async createCollectionInTeam(teamId: string, name: string) {
    const res = await this.request.post(this.url("/api/collections"), {
      headers: this.teamHeaders(teamId),
      data: { name },
    });
    return res.json();
  }

  async listCollectionsInTeam(teamId: string) {
    const res = await this.request.get(this.url("/api/collections"), {
      headers: { "x-team-id": teamId, ...this.headers },
    });
    return res.json();
  }

  async createEnvironmentInTeam(teamId: string, name: string) {
    const res = await this.request.post(this.url("/api/environments"), {
      headers: this.teamHeaders(teamId),
      data: { name },
    });
    return res.json();
  }

  async listEnvironmentsInTeam(teamId: string) {
    const res = await this.request.get(this.url("/api/environments"), {
      headers: { "x-team-id": teamId, ...this.headers },
    });
    return res.json();
  }

  async createFolderInTeam(teamId: string, name: string) {
    const res = await this.request.post(this.url("/api/folders"), {
      headers: this.teamHeaders(teamId),
      data: { name },
    });
    return res.json();
  }

  async listFoldersInTeam(teamId: string) {
    const res = await this.request.get(this.url("/api/folders"), {
      headers: { "x-team-id": teamId, ...this.headers },
    });
    return res.json();
  }

  // ── Execute ──

  async executeRequest(curl: string) {
    const res = await this.request.post(this.url("/api/execute"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { curl },
    });
    return { response: res, ...(await res.json().catch(() => ({}))) };
  }

  async executeRequestRaw(curl: string): Promise<APIResponse> {
    return this.request.post(this.url("/api/execute"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { curl },
    });
  }

  // ── Teams ──

  async createTeam(name: string) {
    const res = await this.request.post(this.url("/api/teams"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data: { name },
    });
    return res.json();
  }

  async listTeams() {
    const res = await this.request.get(this.url("/api/teams"), {
      headers: this.headers,
    });
    return res.json();
  }

  async getTeam(id: string) {
    const res = await this.request.get(this.url(`/api/teams/${id}`), {
      headers: { "x-team-id": id, ...this.headers },
    });
    return res.json();
  }

  async updateTeam(id: string, name: string) {
    const res = await this.request.put(this.url(`/api/teams/${id}`), {
      headers: this.teamHeaders(id),
      data: { name },
    });
    return res;
  }

  async deleteTeam(id: string) {
    return this.request.delete(this.url(`/api/teams/${id}`), {
      headers: { "x-team-id": id, ...this.headers },
    });
  }

  async addTeamMember(teamId: string, email: string, role: "editor" | "viewer") {
    const res = await this.request.post(this.url(`/api/teams/${teamId}/members`), {
      headers: this.teamHeaders(teamId),
      data: { email, role },
    });
    return res;
  }

  async updateTeamMemberRole(teamId: string, memberId: string, role: string) {
    return this.request.put(this.url(`/api/teams/${teamId}/members/${memberId}`), {
      headers: this.teamHeaders(teamId),
      data: { role },
    });
  }

  async removeTeamMember(teamId: string, memberId: string) {
    return this.request.delete(this.url(`/api/teams/${teamId}/members/${memberId}`), {
      headers: { "x-team-id": teamId, ...this.headers },
    });
  }

  async getTeamActivity(teamId: string, limit?: number) {
    const query = limit ? `?limit=${limit}` : "";
    const res = await this.request.get(this.url(`/api/teams/${teamId}/activity${query}`), {
      headers: { "x-team-id": teamId, ...this.headers },
    });
    return res.json();
  }

  // ── Sharing ──

  async createShareLink(requestId: string, expiresInHours?: number) {
    const data: Record<string, unknown> = { requestId };
    if (expiresInHours !== undefined) data.expiresInHours = expiresInHours;
    const res = await this.request.post(this.url("/api/share"), {
      headers: { "Content-Type": "application/json", ...this.headers },
      data,
    });
    return res;
  }

  async listShareLinks(requestId: string) {
    const res = await this.request.get(this.url(`/api/share?requestId=${requestId}`), {
      headers: this.headers,
    });
    return res.json();
  }

  async revokeShareLink(token: string) {
    return this.request.delete(this.url(`/api/share/${token}`), {
      headers: this.headers,
    });
  }

  async resolveShareLink(token: string) {
    // Public endpoint — no auth headers needed
    return this.request.get(this.url(`/api/share/${token}`));
  }

  // ── Upload ──

  async uploadFile(buffer: Buffer, fileName: string) {
    return this.request.post(this.url("/api/upload"), {
      headers: this.headers,
      multipart: {
        file: { name: fileName, mimeType: "application/octet-stream", buffer },
      },
    });
  }
}
