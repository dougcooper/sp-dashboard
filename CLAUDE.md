# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # Run tests once (Vitest + JSDOM)
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate v8 coverage report
npm run check:syntax      # Validate JS syntax via Acorn (extracts <script> from index.html)
npm run build:min         # Minify HTML/CSS/JS into build/sp-dashboard/
npm run screenshot        # Regenerate assets/ screenshots via Puppeteer
make build                # Full plugin build → sp-dashboard.zip
make release-check        # Verify prerequisites before releasing (clean state, tag, gh CLI)
make release              # Tag, push, create GitHub release (requires clean git state + gh CLI)
make clean                # Remove generated files
```

To run a single test: `npx vitest run --reporter=verbose tests/index.test.js -t "test name pattern"`

## Architecture

This is a **Super Productivity plugin** — a sandboxed iframe widget. All UI logic must live in `sp-dashboard/index.html` as a self-contained file (embedded CSS + JS, no external runtime dependencies).

### Two-file plugin model

- **`sp-dashboard/plugin.js`** — runs in the host app context. Registers an ACTION Redux hook with `PluginAPI.addEventListener`, then fires a `postMessage` to the iframe on every state change. This is the only bridge between the host app and the UI.
- **`sp-dashboard/index.html`** — runs in an isolated iframe. Receives `SP_STATE_CHANGED` messages and pulls fresh data via `PluginAPI.getTasks()` / `getArchivedTasks()` / `getAllProjects()`. All rendering, state, and logic lives here.

Available PluginAPI methods (beyond data fetching): `showSnack({ msg, ico })` for toast notifications, `getStorage()` / `setStorage(data)` for persistence (declared in manifest but currently unused).

### Data flow inside index.html

```
postMessage → loadData() → PluginAPI calls → cachedTasks / cachedProjects
  → processData(tasks, projects, dateRange) → metrics object
    → updateDashboardUI()   (stat cards)
    → updateBarChart()      (weekly time, CSS flex bars)
    → updatePieChart()      (project breakdown, CSS conic-gradient)
    → renderTable()         (detailed entries, sortable)
```

`processData()` is the core aggregation function. It deduplicates active + archived tasks (Map by ID, active takes precedence), filters by date range, and computes: time spent, completion counts, overdue/late flags, per-day breakdowns, and per-project summaries.

### Mock data fallback

If `PluginAPI` is unavailable (standalone file:// development), a 500ms timeout injects mock data so the full UI renders without the host app.

### Charts

No charting library. Bar chart uses CSS flexbox with `height` set as a percentage of max value; it automatically buckets data when the date range exceeds 30 days. Pie/donut chart uses a single `<div>` with `conic-gradient` computed from cumulative percentages.

### Theming

All colors are CSS custom properties (`--bg`, `--text-color`, `--c-primary`, etc.). Dark mode is toggled by `.dark-theme` on `<body>` — mirroring the host app's class injection.

### Build pipeline

`make build` runs: template substitution on `manifest.json.template` (injects VERSION/DESCRIPTION) → `scripts/minify.sh` (html-minifier-terser) → zip packaging. Version is the single source of truth in `package.json`.

## Testing

Tests live in `tests/index.test.js` and use Vitest with a JSDOM environment. The test harness sets `document.documentElement.innerHTML = html`, then executes the `<script>` block via `new Function()` — this means **any function you want to test must be explicitly assigned to `window`** inside the script (e.g. `window.processData = processData`). Mock `PluginAPI` is injected via `global.PluginAPI` before each test.

## Key constraints

- Keep `index.html` self-contained — no `import` statements, no external CDN links, no `require()`.
- All user-visible strings in the UI must be sanitized before insertion into the DOM (use `textContent`, not `innerHTML`, for any data-derived content).
- Plugin permissions are declared in `manifest.json.template`; `persistDataSynced` / `loadSyncedData` are declared but currently unused.
