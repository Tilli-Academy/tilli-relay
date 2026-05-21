"use client";

import { useState, useCallback } from "react";
import { RequestState, HttpMethod, Header, AuthState } from "@/lib/types";

const defaultState: RequestState = {
  method: "GET",
  url: "",
  headers: [{ key: "", value: "", enabled: true }],
  params: [{ key: "", value: "", enabled: true }],
  body: "",
  bodyType: "none",
  formData: [],
  auth: { type: "none" },
};

export function useRequestState(initial?: Partial<RequestState>) {
  const [state, setState] = useState<RequestState>({ ...defaultState, ...initial });

  const setMethod = useCallback((method: HttpMethod) => {
    setState((s) => ({ ...s, method }));
  }, []);

  const setUrl = useCallback((url: string) => {
    setState((s) => ({ ...s, url }));
  }, []);

  const setHeaders = useCallback((headers: Header[]) => {
    setState((s) => ({ ...s, headers }));
  }, []);

  const setParams = useCallback((params: Header[]) => {
    setState((s) => ({ ...s, params }));
  }, []);

  const setBody = useCallback((body: string) => {
    setState((s) => ({ ...s, body }));
  }, []);

  const setAuth = useCallback((auth: AuthState) => {
    setState((s) => ({ ...s, auth }));
  }, []);

  const reset = useCallback(() => {
    setState({ ...defaultState });
  }, []);

  return {
    state,
    setState,
    setMethod,
    setUrl,
    setHeaders,
    setParams,
    setBody,
    setAuth,
    reset,
  };
}
