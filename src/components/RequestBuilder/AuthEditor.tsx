"use client";

import { AuthState, AuthType } from "@/lib/types";

const INPUT_CLASS =
  "w-full rounded border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-content-primary placeholder-content-dim focus:border-tilli focus:outline-none";

const LABEL_CLASS = "block mb-1.5 text-[11px] font-medium uppercase tracking-wider text-content-tertiary";

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
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <label className={LABEL_CLASS}>Type</label>
        <select
          data-testid="auth-type-select"
          value={auth.type}
          onChange={(e) => setType(e.target.value as AuthType)}
          className="w-full max-w-xs rounded border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-content-primary focus:border-tilli focus:outline-none"
        >
          <option value="none">No Auth</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="apikey">API Key</option>
        </select>
      </div>

      {/* No Auth message */}
      {auth.type === "none" && (
        <p className="py-3 text-xs text-content-dim">
          This request does not use any authorization.
        </p>
      )}

      {/* Basic Auth fields */}
      {auth.type === "basic" && (
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLASS}>Username</label>
            <input
              data-testid="auth-basic-username"
              type="text"
              placeholder="Username"
              value={auth.basic?.username || ""}
              onChange={(e) =>
                onChange({ ...auth, basic: { username: e.target.value, password: auth.basic?.password || "" } })
              }
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Password</label>
            <input
              data-testid="auth-basic-password"
              type="password"
              placeholder="Password"
              value={auth.basic?.password || ""}
              onChange={(e) =>
                onChange({ ...auth, basic: { username: auth.basic?.username || "", password: e.target.value } })
              }
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}

      {/* Bearer Token field */}
      {auth.type === "bearer" && (
        <div>
          <label className={LABEL_CLASS}>Token</label>
          <input
            data-testid="auth-bearer-token"
            type="text"
            placeholder="Token"
            value={auth.bearer?.token || ""}
            onChange={(e) => onChange({ ...auth, bearer: { token: e.target.value } })}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {/* API Key fields */}
      {auth.type === "apikey" && (
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLASS}>Key</label>
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
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Value</label>
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
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Add to</label>
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
              className="w-full max-w-xs rounded border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-content-primary focus:border-tilli focus:outline-none"
            >
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
