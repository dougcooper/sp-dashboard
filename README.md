# Date Range Reporter Plugin for Super Productivity

A lightweight dashboard plugin for [Super Productivity](https://super-productivity.com) that visualizes time tracked, completed tasks, overdue items, and project breakdowns within a user‑defined date range. It ships as a self-contained HTML/JavaScript widget with no external dependencies and is styled to support light/dark themes.

---

## 🚀 Features

- Selectable date ranges: past week, month, year or custom range
- Two views:
  - **Dashboard** with key metrics, bar charts and pie charts
  - **Detailed list** of individual time entries and task status

## 🖼️ Preview

Below is a screenshot of the dashboard rendered outside of the host app (mock data is used when `PluginAPI` is not available):

![Dashboard Screenshot](assets/screenshot.png)

- Native charts rendered with vanilla JS and CSS (no charting libraries)
- Responsive layout and theming consistent with Super Productivity
- Live updates when task data changes in the host app
- Fallback mock data for standalone development and screenshots

---

## 🛠️ Project Structure

```
sp-dashboard/
├── index.html            # Main UI (CSS + JS embedded)
├── manifest.json.template # Template used at build time
└── plugin.js             # Super Productivity integration script

build/sp-dashboard/      # Generated distribution output

tests/
└── index.test.js         # Vitest/JSDOM unit tests

Makefile                 # Build & release helpers
package.json             # Node tooling and dependencies
README.md                # This file
```

> All plugin logic resides in a single HTML file to conform with the host app's plugin sandbox.

---

## 📦 Installation & Setup (for plugin users)

1. Place the generated ZIP (created by `make build`) into Super Productivity's plugin folder:
   ```bash
   # example directory, replace with your OS path
   ~/.config/superProductivity/plugins
   ```
2. Restart Super Productivity or install via the plugin manager UI.
3. Click the **Date Range Reporter** header button to open the dashboard.

---

## 🔧 Development

### Prerequisites

- Node.js (18+) and npm/yarn installed
- `make` available (macOS/Linux)

### Install dependencies

```bash
npm install
```

### Running tests

```bash
npm test          # run once
npm run test:watch # watch mode
npm run test:coverage # generate coverage report
# or simply
make test
```

### Updating the screenshot

The screenshot is stored under `assets/screenshot.png` and tracked with Git LFS.
You can regenerate it with:

```bash
npm run screenshot   # uses puppeteer
# or
make screenshot
```


The tests load `index.html` via JSDOM and manually execute the embedded script. They cover utility functions, metric calculations, and basic UI interactions.

### Building for release

```bash
make build        # compiles plugin into /build/sp-dashboard zip ready for distribution
```

`make release` performs additional steps (tagging, GitHub release) and requires the GitHub CLI.

---

## 📝 Usage Notes

- The plugin listens for Redux `ACTION` hooks from Super Productivity and posts a message to the iframe to refresh whenever the app state changes.
- If the PluginAPI is unavailable (e.g. opening `index.html` directly in a browser), mock data is injected after a short timeout to make development easier.
- Charts are rendered using CSS and DOM elements; they automatically bucket data if the date range contains more than 30 days.

---

## ✅ Testing Guidelines

- Add new unit tests for every new feature or logic change.
- Mock `PluginAPI` where necessary using `vi.stubGlobal` or manual objects.
- Cover edge cases such as empty date ranges, tasks without projects, overdue detection, and date manipulation.

---

## 📬 Reporting Issues & Contributing

Please file issues or pull requests against the [GitHub repository](https://github.com/yourusername/sp-dashboard) with
clear descriptions and, if applicable, screenshots. Contributions are welcome!

---

## 🗂️ License

MIT © 2026 Your Name
