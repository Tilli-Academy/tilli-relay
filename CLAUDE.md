# Claude.md — Relay (Postman-Compatible API Development Tool)

## Role & Expectations
You are acting as a **senior staff-level software architect and backend engineer**.
Your job is to design and implement a **curl-first API Development Tool** (Postman-like),built from scratch, production-ready, secure, and enterprise-grade.
This is a **paid internal product** intended to **replace Postman** for company use,
while remaining **compatible with Postman collections**.

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.x |
| UI Library | React | 19.x |
| Language | TypeScript | 6.x |
| Runtime | Node.js | — |
| Database | PostgreSQL | 16 (Alpine) |
| ORM | Drizzle ORM + drizzle-kit | 0.45.x |
| Session Store | Redis (via ioredis) | 7 (Alpine) |
| Styling | Tailwind CSS | 4.x |
| Code Editor | Monaco Editor (@monaco-editor/react) | 4.x |
| Auth | bcryptjs (password hashing), custom cookie sessions | — |
| ID Generation | @paralleldrive/cuid2 | — |
| Unit Tests | Vitest | 4.x |
| E2E Tests | Playwright | 1.60.x |
| Containerization | Docker Compose (PostgreSQL + Redis) | — |

## Core Non-Negotiable Principles

### 1. curl is the Source of Truth (MANDATORY)
- Every API request **must be represented as a valid curl command**
- UI state, database records, execution logic **derive from curl**
- Never execute requests from UI fields or DB objects directly
- Execution always runs **the curl command itself**

If curl is correct → everything is correct.

### 2. UI is Secondary
- UI exists **only to construct, visualize, and edit curl**
- Any change in UI must immediately update the generated curl
- Editing curl updates UI fields (bidirectional sync)

### 3. No Postman Integration
- Do **NOT** import, embed, or depend on Postman libraries
- Support **Postman Collection JSON as an import format only**
- Convert Postman requests → curl → internal model

## Execution Model (CRITICAL)

### Request Execution
- Execution happens **server-side only**
- The server **runs the curl command directly** via `child_process.execFile`
- No shell involved — `execFile("curl", args)` directly
- Apply:
  - execution timeout (30s default)
  - command sanitization (whitelist flags, block shell operators)
  - protocol restrictions (http/https only)

If user clicks Send:
- the backend executes curl
- not UI logic
- not DB logic

## Database Design Rules

### Core Rule
The database **stores curl**, not abstract request objects.

### Schema (Drizzle ORM — src/lib/schema.ts)

Core tables:

- **users** — id, email, passwordHash
- **teams** — id, name, slug
- **teamMembers** — teamId, userId, role (pgEnum: owner/editor/viewer)
- **requests** — id, name, curl (TEXT), userId, teamId
- **collections** — id, name, description, folderId, userId, teamId
- **collectionRequests** — collectionId, requestId, sortOrder
- **folders** — id, name, userId, teamId
- **environments** — id, name, userId, teamId, isActive
- **environmentVariables** — id, key, value (encrypted), environmentId, userId
- **historyEntries** — id, userId, method, url, curl, statusCode, timeMs, response
- **sharedRequests** — id, requestId, sharedByUserId, token, expiresAt
- **activityLogs** — id, teamId, userId, action, resourceType, resourceId

Method, URL, headers, auth, body are **derivable** from curl — not stored separately.

## Operations

### Starting the application
1. `docker compose up -d` — start PostgreSQL and Redis
2. `PORT=3033 RELAY_E2E_ALLOW_LOCAL=true npx next start --port 3033` — start the server

### Building
```bash
PORT=3033 npx next build
```
PORT must be set at build time (affects assetPrefix in proxy environments).

### Stopping the application
1. Stop the Next.js server process
2. `docker compose down` — stop PostgreSQL and Redis

Always start Docker before the application and stop Docker after stopping the application.

### Database migrations
```bash
npm run db:generate   # Generate migration SQL from schema changes
npm run db:migrate    # Apply migrations to PostgreSQL
```

### Running tests
```bash
npm test                    # Unit tests (Vitest)
npm run test:e2e            # E2E tests (Playwright)
npm run test:e2e:headed     # E2E tests with browser visible
npm run test:e2e:ui         # Playwright UI mode
```

E2E tests require the server to be running. Set `PORT` and `PLAYWRIGHT_BASE_URL`:
```bash
PORT=3033 PLAYWRIGHT_BASE_URL=http://localhost:3033 npx playwright test
```

---

## Architecture

### Folder Structure

```
Reqify/
├── drizzle/                          # Drizzle migration SQL files
├── e2e/                              # Playwright E2E tests
│   ├── fixtures/auth.fixture.ts      # Auth fixture (per-worker test users)
│   ├── helpers/                      # Selectors, API client, test data
│   ├── page-objects/                 # LoginPage, WorkspacePage
│   ├── specs/                        # Test specs by feature
│   ├── global-setup.ts              # Creates test users, starts mock server
│   └── mock-server.ts               # Local HTTP mock (port 9444)
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout (server component)
│   │   ├── page.tsx                 # Main workspace (client component)
│   │   ├── login/page.tsx           # Login/signup page
│   │   ├── globals.css              # CSS variables (dark/light themes), Tailwind @theme
│   │   └── api/                     # Next.js API routes
│   │       ├── auth/                # login, signup, logout, me
│   │       ├── requests/            # CRUD for saved requests
│   │       ├── collections/         # CRUD + export for collections
│   │       ├── folders/             # CRUD for folders
│   │       ├── environments/        # CRUD for environments
│   │       ├── variables/           # CRUD for environment variables
│   │       ├── execute/             # POST — runs curl server-side
│   │       ├── history/             # CRUD for execution history
│   │       ├── teams/               # CRUD + members + activity
│   │       ├── share/               # Create/resolve shared request links
│   │       ├── upload/              # File upload for form-data
│   │       └── import/postman/      # Postman Collection JSON import
│   ├── components/
│   │   ├── RequestBuilder/          # MethodUrlBar, HeadersEditor, BodyEditor, AuthEditor, ParamsEditor, FormDataEditor
│   │   ├── CurlPanel/              # Monaco editor for curl display/editing
│   │   ├── ResponseViewer/          # Response body (JSON tree + raw), headers, history
│   │   ├── Sidebar/                 # Collection/folder/request tree, theme toggle
│   │   ├── Layout/                  # WorkspaceLayout (3-panel)
│   │   ├── TabBar/                  # Multi-tab request management
│   │   ├── EnvironmentPanel/        # Environment CRUD + variable editor
│   │   ├── EnvironmentSwitcher/     # Active environment dropdown
│   │   ├── TeamPanel/               # Team CRUD, members, RBAC
│   │   ├── WorkspaceSwitcher/       # Personal/team workspace toggle
│   │   ├── ShareDialog/             # Share link management
│   │   ├── SearchOverlay/           # Ctrl+K search across requests/collections
│   │   ├── ActivityLog/             # Team activity timeline
│   │   ├── ErrorBoundary/           # React error boundary
│   │   └── Toast/                   # Toast notification system
│   ├── hooks/
│   │   ├── useTabManager.ts         # Multi-tab state management
│   │   ├── useWorkspace.ts          # Workspace data fetching & state
│   │   ├── useWorkspaceData.ts      # Workspace data types
│   │   ├── useRequestActions.ts     # Request send/save/delete/import actions
│   │   ├── useKeyboardShortcuts.ts  # Global keyboard shortcuts
│   │   └── useTheme.ts             # Light/dark/system theme (localStorage + system media query)
│   └── lib/
│       ├── curl/
│       │   ├── builder.ts           # UI state → curl string
│       │   ├── parser.ts            # curl string → UI state
│       │   ├── sanitizer.ts         # Whitelist validation, security gate
│       │   └── executor.ts          # child_process.execFile, timeout, parse output
│       ├── postman/importer.ts      # Postman Collection v2.1 JSON → curl
│       ├── variables/substitutor.ts # {{variable}} substitution in curl
│       ├── db.ts                    # Drizzle client + PostgreSQL connection
│       ├── redis.ts                 # Redis client (ioredis)
│       ├── schema.ts               # Drizzle schema definitions
│       ├── auth.ts                  # Session management, password hashing
│       ├── auth.edge.ts             # Edge-compatible auth helpers
│       ├── withAuth.ts              # Auth middleware wrapper for API routes
│       ├── teamAuth.ts             # Team RBAC authorization
│       ├── crypto.ts               # Encryption for secret variables
│       ├── rateLimit.ts            # Redis-based rate limiting
│       ├── upload.ts               # File upload handling
│       ├── shareToken.ts           # Share link token generation
│       ├── validation.ts           # Input validation
│       ├── errors.ts               # Structured error responses
│       ├── types.ts                # Shared TypeScript interfaces
│       └── apiBase.ts              # API base URL helper (proxy-aware)
├── docker-compose.yml               # PostgreSQL + Redis containers
├── playwright.config.ts             # Playwright test config
├── vitest.config.ts                 # Vitest unit test config
└── package.json
```

### Data Flow

```
UI Fields ──► builder.ts ──► curl string (canonical state) ──► CurlPanel (Monaco)
CurlPanel ──► parser.ts  ──► UI Fields (reverse sync, 300ms debounce)

[Save]  → POST /api/requests        → stores { name, curl } in PostgreSQL via Drizzle
[Send]  → POST /api/execute          → sanitizer validates → executor runs curl via execFile → returns { status, headers, body, timeMs }
[Import]→ POST /api/import/postman   → parses Postman JSON → converts each request to curl → creates Collection + Request records via Drizzle
```

### Core Library Contracts

#### `lib/curl/builder.ts`
- Input: `RequestState` (method, url, headers[], body, auth)
- Output: valid curl command string
- Must produce a command that is copy-pasteable into any terminal

#### `lib/curl/parser.ts`
- Input: curl command string
- Output: `RequestState`
- Handles: `-X`, `-H`, `-d`/`--data`, `-u`, `-H "Authorization: ..."`, URL extraction
- URL detection: prefers `http://`/`https://` tokens over bare tokens (position-independent)

#### `lib/curl/sanitizer.ts`
- Whitelist of allowed flags: `-X`, `-H`, `-d`, `--data`, `--data-raw`, `--data-binary`, `-u`, `-A`, `-b`, `-L`, `-k`, `-s`, `-S`, `-w`, `-o /dev/null`, `--connect-timeout`, `--max-time`
- Blocks: `;`, `|`, `&&`, `||`, backticks, `$()`, `>`, `<`, newlines
- Enforces: URL must start with `http://` or `https://`
- Returns: `{ valid: boolean, error?: string, sanitizedArgs: string[] }`

#### `lib/curl/executor.ts`
- Uses `child_process.execFile("curl", args)` — NOT `exec` (no shell involved)
- Appends `-s -S` (silent + show errors)
- Appends `-w "\n%{http_code}\n%{time_total}"` for metadata extraction
- Configurable timeout (default: 30s)
- Returns: `{ status: number, headers: Record<string, string>, body: string, timeMs: number }`

### Theming

Three modes: **Dark** (default), **Light**, **System** (follows OS preference).

- CSS variables defined in `:root` (dark) and `.light` class overrides in `globals.css`
- All components use semantic Tailwind classes (`bg-surface-base`, `text-content-primary`, etc.)
- Theme-aware syntax highlighting: `text-syntax-key`, `text-syntax-string`, `text-syntax-number`, `text-syntax-boolean`, `text-syntax-punctuation`, `text-syntax-null`
- Theme-aware method colors: `text-method-get`, `text-method-post`, `text-method-put`, `text-method-delete`, `text-method-patch`
- `useTheme()` hook provides `{ theme, resolved, setTheme, toggle }`
- Persisted to `localStorage` key `relay-theme`
- Monaco editor switches between `light` and `vs-dark` themes

### Implemented Features

- **Request Builder**: Method, URL, headers, params, body (JSON/text/form-data), auth (None/Basic/Bearer/API Key)
- **Curl Panel**: Monaco editor, bidirectional sync, copy-to-clipboard
- **Response Viewer**: Body (JSON tree + raw + syntax highlighting), headers table, history tab, copy, pretty/raw toggle
- **Sidebar**: Folders, collections, requests tree, drag-and-drop, context menus
- **Tabs**: Multi-tab request editing
- **Environments**: Create/manage environments, {{variable}} substitution, secret variable encryption
- **History**: Per-request execution history, replay, clear
- **Teams**: Create/manage teams, invite members, RBAC (owner/editor/viewer), activity log
- **Workspace Switching**: Personal vs team workspace isolation
- **Sharing**: Generate expiring share links for requests
- **Search**: Ctrl+K overlay search across requests, collections, folders
- **Keyboard Shortcuts**: Ctrl+Enter (send), Ctrl+S (save), Ctrl+K (search), Ctrl+Shift+E (environments), Ctrl+N (new tab), Ctrl+\ (toggle sidebar)
- **Postman Import**: Collection v2.1 JSON import with nested folder support
- **File Upload**: Form-data file attachment support
- **Theming**: Dark/light/system theme with full CSS variable system
- **Security**: curl sanitizer, SSRF protection, IDOR protection, rate limiting, encrypted secrets

### Security Constraints (MANDATORY)

- Never execute raw shell input without validation
- Whitelist curl flags
- Restrict protocols (http/https only)
- Apply strict execution timeout
- Disallow shell chaining (`;`, `|`, `&&`, `||`, backticks, `$()`, `>`, `<`)
- SSRF protection for internal network requests
- IDOR protection — all resources scoped to authenticated user/team
- Rate limiting on auth endpoints
- Encrypted storage for secret environment variables

## What NOT to Build (Explicitly Forbidden)

- No Express or Fastify — Next.js API routes only
- No Postman SDK usage
- No "UI-first execution" — curl is always the source of truth
- No client-side API execution
- No DB-driven execution logic
- No Prisma — use Drizzle ORM exclusively

## Mental Model

> This product is **not a Postman UI clone**.
> It is a **curl execution platform with a UI wrapper**, compatible with Postman collections.

If curl is always correct and executable, the product is successful.
