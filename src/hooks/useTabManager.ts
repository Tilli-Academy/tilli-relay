"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { RequestState, ExecutionResult, HttpMethod, Header, AuthState, BodyType, FormDataField } from "@/lib/types";
import { buildCurl } from "@/lib/curl/builder";
import { parseCurl } from "@/lib/curl/parser";

const DEFAULT_STATE: RequestState = {
  method: "GET",
  url: "",
  headers: [{ key: "", value: "", enabled: true }],
  params: [{ key: "", value: "", enabled: true }],
  body: "",
  bodyType: "none",
  formData: [],
  auth: { type: "none" },
};

export interface Tab {
  id: string;
  name: string;
  state: RequestState;
  curlString: string;
  result: ExecutionResult | null;
  savedRequestId: string | null;
}

interface TabManagerState {
  tabs: Tab[];
  activeTabId: string;
}

let tabCounter = 0;

function makeTab(name?: string, state?: RequestState, savedRequestId?: string | null): Tab {
  const s = state || {
    ...DEFAULT_STATE,
    headers: [{ key: "", value: "", enabled: true }],
    params: [{ key: "", value: "", enabled: true }],
  };
  return {
    id: `tab-${++tabCounter}`,
    name: name || "New Request",
    state: s,
    curlString: buildCurl(s),
    result: null,
    savedRequestId: savedRequestId || null,
  };
}

const LS_KEY_PREFIX = "reqify-tabs";

function lsKey(userId?: string | null): string {
  return userId ? `${LS_KEY_PREFIX}-${userId}` : LS_KEY_PREFIX;
}

function loadFromStorage(userId?: string | null): TabManagerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lsKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Array.isArray(data.tabs) && data.tabs.length > 0 && data.activeTabId) {
      for (const t of data.tabs) {
        const num = parseInt(t.id.replace("tab-", ""), 10);
        if (!isNaN(num) && num > tabCounter) tabCounter = num;
      }
      const tabs: Tab[] = data.tabs.map((t: Tab) => ({
        ...t,
        curlString: buildCurl(t.state),
        result: null,
      }));
      const activeTabId = tabs.some(t => t.id === data.activeTabId)
        ? data.activeTabId
        : tabs[0].id;
      return { tabs, activeTabId };
    }
  } catch {}
  return null;
}

function saveToStorage(state: TabManagerState, userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const slim = {
      tabs: state.tabs.map(t => ({
        id: t.id,
        name: t.name,
        state: t.state,
        curlString: t.curlString,
        result: null,
        savedRequestId: t.savedRequestId,
      })),
      activeTabId: state.activeTabId,
    };
    localStorage.setItem(lsKey(userId), JSON.stringify(slim));
  } catch {}
}

/** Remove legacy and orphaned tab storage from old sessions / old user IDs */
function clearLegacyStorage(currentUserId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    // Remove the non-user-scoped key
    localStorage.removeItem(LS_KEY_PREFIX);
    // Remove tab keys for old user IDs (e.g., from the previous SQLite database)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${LS_KEY_PREFIX}-`) && key !== lsKey(currentUserId)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export function useTabManager(userId?: string | null) {
  const [tabState, setTabState] = useState<TabManagerState>(() => {
    const first = makeTab();
    return { tabs: [first], activeTabId: first.id };
  });

  // Restore from user-scoped localStorage after mount or when userId changes
  useEffect(() => {
    clearLegacyStorage(userId);
    if (!userId) return; // Wait until userId is known
    const loaded = loadFromStorage(userId);
    if (loaded) {
      setTabState(loaded);
    } else {
      // Fresh user — reset to a single new tab
      const first = makeTab();
      setTabState({ tabs: [first], activeTabId: first.id });
    }
  }, [userId]);

  // Persist to user-scoped localStorage on changes
  useEffect(() => {
    if (!userId) return;
    saveToStorage(tabState, userId);
  }, [tabState, userId]);

  const { tabs, activeTabId } = tabState;
  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const createTab = useCallback((name?: string, state?: RequestState, savedRequestId?: string | null) => {
    const tab = makeTab(name, state, savedRequestId);
    setTabState(prev => ({
      tabs: [...prev.tabs, tab],
      activeTabId: tab.id,
    }));
    return tab.id;
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabState(prev => {
      const idx = prev.tabs.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const remaining = prev.tabs.filter(t => t.id !== id);
      if (remaining.length === 0) {
        const newTab = makeTab();
        return { tabs: [newTab], activeTabId: newTab.id };
      }
      let newActiveId = prev.activeTabId;
      if (prev.activeTabId === id) {
        const newIdx = Math.min(idx, remaining.length - 1);
        newActiveId = remaining[newIdx].id;
      }
      return { tabs: remaining, activeTabId: newActiveId };
    });
  }, []);

  const switchTab = useCallback((id: string) => {
    setTabState(prev => ({ ...prev, activeTabId: id }));
  }, []);

  const updateActiveState = useCallback((partial: Partial<RequestState>) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => {
        if (t.id !== prev.activeTabId) return t;
        const newState = { ...t.state, ...partial };
        return { ...t, state: newState, curlString: buildCurl(newState) };
      }),
    }));
  }, []);

  const setActiveState = useCallback((newState: RequestState) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => {
        if (t.id !== prev.activeTabId) return t;
        return { ...t, state: newState, curlString: buildCurl(newState) };
      }),
    }));
  }, []);

  const updateFromCurl = useCallback((curl: string) => {
    const parsed = parseCurl(curl);
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => {
        if (t.id !== prev.activeTabId) return t;
        return { ...t, state: parsed, curlString: curl };
      }),
    }));
  }, []);

  const setTabResult = useCallback((tabId: string, result: ExecutionResult | null) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => t.id === tabId ? { ...t, result } : t),
    }));
  }, []);

  const setActiveResult = useCallback((result: ExecutionResult | null) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => {
        if (t.id !== prev.activeTabId) return t;
        return { ...t, result };
      }),
    }));
  }, []);

  const setActiveTabName = useCallback((name: string) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => {
        if (t.id !== prev.activeTabId) return t;
        return { ...t, name };
      }),
    }));
  }, []);

  const setActiveSavedRequestId = useCallback((savedRequestId: string | null) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t => {
        if (t.id !== prev.activeTabId) return t;
        return { ...t, savedRequestId };
      }),
    }));
  }, []);

  const setMethod = useCallback((method: HttpMethod) => updateActiveState({ method }), [updateActiveState]);
  const setUrl = useCallback((url: string) => updateActiveState({ url }), [updateActiveState]);
  const setHeaders = useCallback((headers: Header[]) => updateActiveState({ headers }), [updateActiveState]);
  const setParams = useCallback((params: Header[]) => updateActiveState({ params }), [updateActiveState]);
  const setBody = useCallback((body: string) => updateActiveState({ body }), [updateActiveState]);
  const setBodyType = useCallback((bodyType: BodyType) => updateActiveState({ bodyType }), [updateActiveState]);
  const setFormData = useCallback((formData: FormDataField[]) => updateActiveState({ formData }), [updateActiveState]);
  const setAuth = useCallback((auth: AuthState) => updateActiveState({ auth }), [updateActiveState]);

  return {
    tabs,
    activeTabId,
    activeTab,
    createTab,
    closeTab,
    switchTab,
    setMethod,
    setUrl,
    setHeaders,
    setParams,
    setBody,
    setBodyType,
    setFormData,
    setAuth,
    setActiveState,
    updateActiveState,
    updateFromCurl,
    setActiveResult,
    setTabResult,
    setActiveTabName,
    setActiveSavedRequestId,
  };
}
