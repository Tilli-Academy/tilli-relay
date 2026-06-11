"use client";

import { useState, forwardRef } from "react";
import { RequestState, HttpMethod, Header, AuthState, BodyType, FormDataField } from "@/lib/types";
import MethodUrlBar from "./MethodUrlBar";
import HeadersEditor from "./HeadersEditor";
import ParamsEditor from "./ParamsEditor";
import BodyEditor from "./BodyEditor";
import AuthEditor from "./AuthEditor";

type Tab = "params" | "headers" | "body" | "auth";

const RequestBuilder = forwardRef<
  HTMLInputElement,
  {
    state: RequestState;
    onMethodChange: (m: HttpMethod) => void;
    onUrlChange: (url: string) => void;
    onHeadersChange: (h: Header[]) => void;
    onParamsChange: (p: Header[]) => void;
    onBodyChange: (b: string) => void;
    onBodyTypeChange: (t: BodyType) => void;
    onFormDataChange: (f: FormDataField[]) => void;
    onAuthChange: (a: AuthState) => void;
    onSend: () => void;
    sending: boolean;
  }
>(function RequestBuilder({
  state,
  onMethodChange,
  onUrlChange,
  onHeadersChange,
  onParamsChange,
  onBodyChange,
  onBodyTypeChange,
  onFormDataChange,
  onAuthChange,
  onSend,
  sending,
}, ref) {
  const [tab, setTab] = useState<Tab>("params");

  const activeParams = state.params.filter((p) => p.enabled && p.key).length;
  const activeHeaders = state.headers.filter((h) => h.enabled && h.key).length;
  const hasBody = state.method !== "GET" && (
    state.body.length > 0 ||
    (state.bodyType === "form-data" && state.formData.some((f) => f.enabled && f.key))
  );
  const hasAuth = state.auth.type !== "none";

  return (
    <div data-testid="request-builder" className="flex h-full flex-col">
      {/* Method + URL + Send */}
      <MethodUrlBar
        ref={ref}
        method={state.method}
        url={state.url}
        params={state.params}
        sending={sending}
        onMethodChange={onMethodChange}
        onUrlChange={onUrlChange}
        onSend={onSend}
      />

      {/* Tabs — Postman-style underline tabs */}
      <div className="mt-3 flex border-b border-border-secondary">
        <TabButton
          label="Params"
          testId="tab-params"
          active={tab === "params"}
          badge={activeParams || undefined}
          onClick={() => setTab("params")}
        />
        <TabButton
          label="Headers"
          testId="tab-headers"
          active={tab === "headers"}
          badge={activeHeaders || undefined}
          onClick={() => setTab("headers")}
        />
        {state.method !== "GET" && (
          <TabButton
            label="Body"
            testId="tab-body"
            active={tab === "body"}
            dot={hasBody}
            onClick={() => setTab("body")}
          />
        )}
        <TabButton
          label="Auth"
          testId="tab-auth"
          active={tab === "auth"}
          dot={hasAuth}
          onClick={() => setTab("auth")}
        />
      </div>

      {/* Tab content — smooth transition */}
      <div className="flex-1 overflow-y-auto pt-3">
        <div className="animate-in fade-in duration-150">
          {tab === "params" && (
            <ParamsEditor params={state.params} onChange={onParamsChange} />
          )}
          {tab === "headers" && (
            <HeadersEditor headers={state.headers} onChange={onHeadersChange} />
          )}
          {tab === "body" && state.method !== "GET" && (
            <BodyEditor
              body={state.body}
              bodyType={state.bodyType}
              formData={state.formData}
              onChange={onBodyChange}
              onBodyTypeChange={onBodyTypeChange}
              onFormDataChange={onFormDataChange}
            />
          )}
          {tab === "auth" && (
            <AuthEditor auth={state.auth} onChange={onAuthChange} />
          )}
        </div>
      </div>
    </div>
  );
});

export default RequestBuilder;

function TabButton({
  label,
  testId,
  active,
  badge,
  dot,
  onClick,
}: {
  label: string;
  testId?: string;
  active: boolean;
  badge?: number;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`relative px-4 py-2 text-xs font-medium transition-all ${
        active
          ? "text-tilli-light"
          : "text-content-muted hover:text-content-secondary"
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
          active ? "bg-tilli/20 text-tilli-light" : "bg-surface-secondary text-content-secondary"
        }`}>
          {badge}
        </span>
      )}
      {dot && !badge && (
        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-tilli" />
      )}
      {/* Active indicator bar */}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-tilli" />
      )}
    </button>
  );
}
