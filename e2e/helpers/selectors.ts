/**
 * Central registry of all data-testid selectors used in E2E tests.
 * Every component's data-testid maps to a constant here.
 * Changing a testid in the app requires updating only this file.
 */

function tid(id: string): string {
  return `[data-testid="${id}"]`;
}

export const SEL = {
  // ── Login / Signup ──
  authModeLogin: tid("auth-mode-login"),
  authModeSignup: tid("auth-mode-signup"),
  loginEmail: tid("login-email"),
  loginPassword: tid("login-password"),
  loginSubmit: tid("login-submit"),
  loginError: tid("login-error"),
  signupEmail: tid("signup-email"),
  signupPassword: tid("signup-password"),
  signupConfirmPassword: tid("signup-confirm-password"),
  signupSubmit: tid("signup-submit"),
  signupError: tid("signup-error"),
  passwordStrength: tid("password-strength"),

  // ── Workspace Layout ──
  workspace: tid("workspace-layout"),

  // ── Sidebar ──
  sidebar: tid("sidebar"),
  sidebarUserEmail: tid("sidebar-user-email"),
  sidebarLogout: tid("sidebar-logout"),
  newRequestButton: tid("new-request-button"),
  saveCurrentButton: tid("save-current-button"),
  saveNameInput: tid("save-name-input"),
  saveConfirmButton: tid("save-confirm-button"),
  envVarsButton: tid("env-vars-button"),
  importFileInput: tid("import-file-input"),
  sidebarLoading: tid("sidebar-loading"),

  // Dynamic sidebar items
  requestItem: (id: string) => tid(`request-item-${id}`),
  requestLoad: (id: string) => tid(`request-load-${id}`),
  requestDelete: (id: string) => tid(`request-delete-${id}`),
  requestShare: (id: string) => tid(`request-share-${id}`),

  // ── Tab Bar ──
  tabBar: tid("tab-bar"),
  tab: (id: string) => tid(`tab-${id}`),
  tabClose: (id: string) => tid(`tab-close-${id}`),
  newTabButton: tid("new-tab-button"),
  // Matches tab items but excludes close buttons
  tabItems: '[data-testid="tab-bar"] [data-testid^="tab-"]:not([data-testid^="tab-close-"]):not([data-testid="tab-bar"])',

  // ── Request Builder ──
  requestBuilder: tid("request-builder"),
  methodSelect: tid("method-select"),
  urlInput: tid("url-input"),
  sendButton: tid("send-button"),

  // Builder tabs
  tabParams: tid("tab-params"),
  tabHeaders: tid("tab-headers"),
  tabBody: tid("tab-body"),
  tabAuth: tid("tab-auth"),

  // ── Headers Editor ──
  headersEditor: tid("headers-editor"),
  addHeader: tid("add-header"),
  headerRow: (i: number) => tid(`header-row-${i}`),
  headerKey: (i: number) => tid(`header-key-${i}`),
  headerValue: (i: number) => tid(`header-value-${i}`),
  headerEnabled: (i: number) => tid(`header-enabled-${i}`),
  headerRemove: (i: number) => tid(`header-remove-${i}`),

  // ── Params Editor ──
  paramsEditor: tid("params-editor"),
  addParam: tid("add-param"),
  paramRow: (i: number) => tid(`param-row-${i}`),
  paramKey: (i: number) => tid(`param-key-${i}`),
  paramValue: (i: number) => tid(`param-value-${i}`),
  paramEnabled: (i: number) => tid(`param-enabled-${i}`),
  paramRemove: (i: number) => tid(`param-remove-${i}`),

  // ── Body Editor ──
  bodyEditor: tid("body-editor"),
  bodyTypeNone: tid("body-type-none"),
  bodyTypeJson: tid("body-type-json"),
  bodyTypeText: tid("body-type-text"),
  bodyTypeFormData: tid("body-type-form-data"),
  bodyJsonInput: tid("body-json-input"),
  bodyTextInput: tid("body-text-input"),
  bodyFormatJson: tid("body-format-json"),

  // ── Auth Editor ──
  authTypeNone: tid("auth-type-none"),
  authTypeBasic: tid("auth-type-basic"),
  authTypeBearer: tid("auth-type-bearer"),
  authTypeApikey: tid("auth-type-apikey"),
  authBasicUsername: tid("auth-basic-username"),
  authBasicPassword: tid("auth-basic-password"),
  authBearerToken: tid("auth-bearer-token"),
  authApikeyKey: tid("auth-apikey-key"),
  authApikeyValue: tid("auth-apikey-value"),
  authApikeyAddto: tid("auth-apikey-addto"),

  // ── Curl Panel ──
  curlPanel: tid("curl-panel"),
  curlCopyButton: tid("curl-copy-button"),
  curlEditor: tid("curl-editor"),

  // ── Response Viewer ──
  responseSending: tid("response-sending"),
  responseEmpty: tid("response-empty"),
  responseError: tid("response-error"),
  responseErrorMessage: tid("response-error-message"),
  responseStatus: tid("response-status"),
  responseTime: tid("response-time"),
  responseSize: tid("response-size"),
  responseWarning: tid("response-warning"),
  responseTabBody: tid("response-tab-body"),
  responseTabHeaders: tid("response-tab-headers"),
  responseTabHistory: tid("response-tab-history"),
  responseBody: tid("response-body"),
  responseHeadersTable: tid("response-headers-table"),
  responseViewPretty: tid("response-view-pretty"),
  responseViewRaw: tid("response-view-raw"),
  responseCopy: tid("response-copy"),

  // ── Environment Switcher ──
  envSwitcher: tid("env-switcher"),
  envSwitcherButton: tid("env-switcher-button"),
  envSwitcherDropdown: tid("env-switcher-dropdown"),
  envOption: (id: string) => tid(`env-option-${id}`),
  envOptionNone: tid("env-option-none"),
  envManageButton: tid("env-manage-button"),

  // ── Environment Panel ──
  envPanelBackdrop: tid("env-panel-backdrop"),
  envPanel: tid("env-panel"),
  envPanelClose: tid("env-panel-close"),
  envTab: (id: string) => tid(`env-tab-${id}`),
  envNewButton: tid("env-new-button"),
  envNewName: tid("env-new-name"),
  envNewConfirm: tid("env-new-confirm"),
  envVar: (id: string) => tid(`env-var-${id}`),
  envVarDelete: (id: string) => tid(`env-var-delete-${id}`),
  envVarNewKey: tid("env-var-new-key"),
  envVarNewValue: tid("env-var-new-value"),
  envVarNewSecret: tid("env-var-new-secret"),
  envVarNewAdd: tid("env-var-new-add"),

  // ── Search Overlay ──
  searchOverlayBackdrop: tid("search-overlay-backdrop"),
  searchOverlay: tid("search-overlay"),
  searchInput: tid("search-input"),
  searchResult: (i: number) => tid(`search-result-${i}`),
  searchNoResults: tid("search-no-results"),

  // ── Toast ──
  toastContainer: tid("toast-container"),
  toast: (id: string) => tid(`toast-${id}`),
} as const;
