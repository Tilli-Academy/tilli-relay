export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export type AuthType = "none" | "basic" | "bearer" | "apikey";

export interface AuthState {
  type: AuthType;
  basic?: { username: string; password: string };
  bearer?: { token: string };
  apikey?: { key: string; value: string; addTo: "header" | "query" };
}

export type BodyType = "none" | "json" | "text" | "form-data";

export interface FormDataField {
  key: string;
  value: string;
  type: "text" | "file";
  enabled: boolean;
  fileName?: string;
  fileId?: string;
}

export interface RequestState {
  method: HttpMethod;
  url: string;
  headers: Header[];
  params: Header[];
  body: string;
  bodyType: BodyType;
  formData: FormDataField[];
  auth: AuthState;
}

export interface ExecutionResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  error?: string;
  warning?: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizeResult {
  valid: boolean;
  error?: string;
  sanitizedArgs: string[];
}
