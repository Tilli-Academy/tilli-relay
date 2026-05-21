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
    <div data-testid="request-builder" className="flex h-full flex-col gap-3">
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-secondary">
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

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
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
      className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-b-2 border-tilli text-tilli-light"
          : "text-content-muted hover:text-content-secondary"
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1.5 rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] text-content-secondary">
          {badge}
        </span>
      )}
      {dot && !badge && (
        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-tilli" />
      )}
    </button>
  );
}
