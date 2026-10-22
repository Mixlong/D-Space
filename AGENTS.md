# AGENTS.md

Operational guide for coding agents working in this repository.

## 1) Repository Snapshot

- Stack: Vue 3 + Vite + Element Plus + Pinia + Vue Router + Electron.
- Package manager reality: both `pnpm-lock.yaml` and `package-lock.json` exist.
- Primary scripts and source of truth are in `package.json`.
- Backend is external; frontend calls API via `VITE_APP_BASE_API`.
- Two embedded external platforms are loaded through iframe pages:
  - `src/views/cloud/DiTaiCloud/index.vue`
  - `src/views/cloud/DocumentProcess/index.vue`

## 2) Command Reference (Verified)

Run from repo root: `/Volumes/项目管理/project/DigiSmart`.

### Install

- `npm install`
- `pnpm install` (possible because `pnpm-lock.yaml` exists)

### Dev / Build

- `npm run dev` - Vite web dev server.
- `npm run build:prod` - Vite production build.
- `npm run build:stage` - Vite staging build.
- `npm run preview` - Vite preview server.
- `npm run electron:build` - Web build + Electron packaging.
- `npm run build:win`
- `npm run build:mac`
- `npm run build:mac-win`
- `npm run build:linux`

### Release / Upload

- `npm run upload:oss`
- `npm run release:patch`
- `npm run release:minor`
- `npm run release:major`
- `npm run release:patch:win`
- `npm run release:patch:mac`
- `npm run release:patch:mac-win`
- `npm run release:patch:linux`

### Lint / Test Status

- No `lint` script in `package.json`.
- No `test` script in `package.json`.
- The formal release workflow is under `.github/workflows/release-stable.yml`;
  it requires the Yunxiao webhook secret documented in
  `docs/github-auto-update.md`.
- No established unit/e2e test framework config discovered.
- Single-test command: **not currently defined** in this repo.

### Important Script Drift Note

- Multiple markdown docs mention scripts like `electron:dev` and `electron:build:win`.
- These script names are not present in current `package.json`.
- If docs and scripts disagree, trust `package.json` first.

## 3) Cursor / Copilot Rule Files

- `.cursorrules`: not found.
- `.cursor/rules/`: not found.
- `.github/copilot-instructions.md`: not found.
- Therefore, follow conventions inferred from code and this document.

## 4) Code Style Conventions

These are repository conventions observed in current files.

### JavaScript / Vue Baseline

- Language is JavaScript (not TypeScript).
- Use Vue SFCs, often with `<script setup>`.
- Some SFCs keep an additional classic `<script>` only for component `name`.
- Prefer single quotes in JS imports and strings.
- Semicolons are generally omitted in frontend source files.
- Use `@` alias for `src` imports.

### Import Organization

- Order is usually: framework libs -> third-party libs -> `@/` internal imports.
- Keep relative imports for same-feature local files when clear.
- Keep import groups visually separated by blank lines when file is large.

### Naming

- Components and stores use PascalCase export names where applicable.
- Variables/functions use camelCase.
- Constants use UPPER_SNAKE_CASE only when truly constant/global.
- API wrapper methods use verb+noun style (`listUser`, `getUser`, `updateUser`).

### Vue Patterns

- Prefer `ref`/`reactive` for state in `<script setup>`.
- Use `watch` for reactive side effects tied to route/token changes.
- Use lifecycle hooks explicitly (`onMounted`, `onActivated`, `onDeactivated`).
- In forms/tables, follow existing Element Plus idioms.

### Routing / Caching Behavior

- Router mode switches by runtime:
  - Electron -> hash history
  - Web -> HTML5 history
- Platform iframe pages manually handle load/retry/refresh logic.
- For cache-sensitive iframe behavior, follow existing `loadUrl` + `forceRefresh` pattern.

### API / Request Layer

- API calls are centralized in `src/api/**` using `src/utils/request.js`.
- Request wrapper handles token, dedupe submission checks, and response normalization.
- Prefer adding new backend calls in `src/api/*` modules, not inline in views.

### Error Handling

- Existing pattern: log with context (`console.error('[Tag] ...', err)`).
- Avoid silent failures unless existing file already does that for compatibility.
- For user-facing failures, use Element Plus feedback (`ElMessage` / `ElNotification`).
- When adding retries/timeouts, keep retry count and timeout constants explicit.

### Type Safety Guidance in JS Repo

- No TypeScript checks are currently enforced.
- Still avoid pseudo-type shortcuts and unclear implicit coercions.
- Validate nullable values around token, route query, iframe refs, and Electron APIs.

### Formatting

- No Prettier config detected.
- No ESLint project-level config detected (some file-level disable comments exist).
- Keep formatting consistent with touched file instead of imposing new style globally.
- Do not mass-reformat unrelated files.

## 5) File/Module Placement Guide

- `src/views/` for page-level views.
- `src/components/` for reusable UI components.
- `src/store/modules/` for Pinia stores.
- `src/api/` for backend API wrappers.
- `src/utils/` for utilities and integration helpers.
- `electron/` for Electron main/preload process code.
- `scripts/` for release/deployment scripts.

## 6) Agent Execution Rules

- Make focused, minimal edits; avoid broad refactors during bugfixes.
- Preserve existing user-visible Chinese copy unless change is requested.
- Do not rename public route paths without checking router usage.
- Validate command availability against `package.json` before suggesting execution.
- If adding tests in future, also add matching `package.json` scripts.

## 7) Security / Safety Notes

- `scripts/upload-to-oss.cjs` contains sensitive OSS credentials in plaintext.
- Do not print, copy, or rotate these credentials unless explicitly requested.
- Avoid committing newly introduced secrets in code or docs.

## 8) Known Tooling Caveats

- TypeScript LSP is not installed in this environment (`typescript-language-server` missing).
- Prefer direct file inspection and targeted grep/AST searches for analysis.

## 9) When Unsure

- Follow local file conventions first.
- Use `package.json` as command truth source.
- Prefer compatibility with existing runtime behavior over stylistic cleanup.
