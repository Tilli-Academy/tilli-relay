/**
 * Shared validation rules for auth forms.
 * Used on both client (login page) and server (API routes).
 */

export interface ValidationError {
  field: "email" | "password";
  message: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== "string") return "Email is required";
  const trimmed = email.trim();
  if (trimmed.length === 0) return "Email is required";
  if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address";
  if (trimmed.length > 254) return "Email is too long";
  return null;
}

export const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, message: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), message: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), message: "One lowercase letter" },
  { test: (p: string) => /[0-9]/.test(p), message: "One number" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), message: "One symbol (!@#$%...)" },
] as const;

export function validatePassword(password: string): string | null {
  if (!password || typeof password !== "string") return "Password is required";
  const failed = PASSWORD_RULES.filter((r) => !r.test(password));
  if (failed.length > 0) {
    return `Password must contain: ${failed.map((r) => r.message.toLowerCase()).join(", ")}`;
  }
  if (password.length > 128) return "Password is too long";
  return null;
}
