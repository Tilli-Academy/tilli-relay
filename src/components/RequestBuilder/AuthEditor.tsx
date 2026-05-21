"use client";

import { AuthState, AuthType } from "@/lib/types";

export default function AuthEditor({
  auth,
  onChange,
}: {
  auth: AuthState;
  onChange: (a: AuthState) => void;
}) {
  const setType = (type: AuthType) => {
    const base: AuthState = { type };
    if (type === "basic") base.basic = { username: "", password: "" };
    if (type === "bearer") base.bearer = { token: "" };
    if (type === "apikey") base.apikey = { key: "", value: "", addTo: "header" };
    onChange(base);
  };

  return (
    <div className="space-y-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
        Authorization
      </span>
      <div className="flex gap-1">
        {(["none", "basic", "bearer", "apikey"] as AuthType[]).map((t) => (
          <button
            key={t}
            data-testid={`auth-type-${t}`}
            onClick={() => setType(t)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              auth.type === t
                ? "bg-tilli text-white"
                : "bg-surface-secondary text-content-tertiary hover:bg-surface-secondary hover:text-content-primary"
            }`}
          >
            {t === "none" ? "None" : t === "basic" ? "Basic" : t === "bearer" ? "Bearer" : "API Key"}
          </button>
        ))}
      </div>

      {auth.type === "basic" && (
        <div className="flex gap-2">
          <input
            data-testid="auth-basic-username"
            type="text"
            placeholder="Username"
            value={auth.basic?.username || ""}
            onChange={(e) =>
              onChange({ ...auth, basic: { username: e.target.value, password: auth.basic?.password || "" } })
            }
            className="flex-1 rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
          />
          <input
            data-testid="auth-basic-password"
            type="password"
            placeholder="Password"
            value={auth.basic?.password || ""}
            onChange={(e) =>
              onChange({ ...auth, basic: { username: auth.basic?.username || "", password: e.target.value } })
            }
            className="flex-1 rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
          />
        </div>
      )}

      {auth.type === "bearer" && (
        <input
          data-testid="auth-bearer-token"
          type="text"
          placeholder="Token"
          value={auth.bearer?.token || ""}
          onChange={(e) => onChange({ ...auth, bearer: { token: e.target.value } })}
          className="w-full rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
        />
      )}

      {auth.type === "apikey" && (
        <div className="flex gap-2">
          <input
            data-testid="auth-apikey-key"
            type="text"
            placeholder="Key name"
            value={auth.apikey?.key || ""}
            onChange={(e) =>
              onChange({
                ...auth,
                apikey: { key: e.target.value, value: auth.apikey?.value || "", addTo: auth.apikey?.addTo || "header" },
              })
            }
            className="w-36 rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
          />
          <input
            data-testid="auth-apikey-value"
            type="text"
            placeholder="Value"
            value={auth.apikey?.value || ""}
            onChange={(e) =>
              onChange({
                ...auth,
                apikey: { key: auth.apikey?.key || "", value: e.target.value, addTo: auth.apikey?.addTo || "header" },
              })
            }
            className="flex-1 rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none"
          />
          <select
            data-testid="auth-apikey-addto"
            value={auth.apikey?.addTo || "header"}
            onChange={(e) =>
              onChange({
                ...auth,
                apikey: {
                  key: auth.apikey?.key || "",
                  value: auth.apikey?.value || "",
                  addTo: e.target.value as "header" | "query",
                },
              })
            }
            className="rounded border border-border-primary bg-surface-secondary px-2.5 py-1.5 text-sm text-content-primary focus:border-tilli focus:outline-none"
          >
            <option value="header">Header</option>
            <option value="query">Query</option>
          </select>
        </div>
      )}
    </div>
  );
}
