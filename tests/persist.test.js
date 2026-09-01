import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(
	resolve(__dirname, "../sp-dashboard/index.html"),
	"utf8",
);

const boot = () => {
	document.documentElement.innerHTML = html;
	const scriptElement = Array.from(document.querySelectorAll("script")).find(
		(s) => !s.src && s.textContent.includes("processData"),
	);
	const runScript = new Function(scriptElement.textContent);
	runScript.call(window);
};

describe("Synced persistence via PluginAPI", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		try { window.localStorage.clear(); } catch (e) {}
	});

	it("persists settings through PluginAPI.persistDataSynced when language changes", async () => {
		let stored = null;
		window.PluginAPI = {
			persistDataSynced: vi.fn((raw) => { stored = raw; }),
			loadSyncedData: vi.fn(async () => stored),
			getTasks: async () => [],
			getArchivedTasks: async () => [],
			getAllProjects: async () => [],
		};
		boot();
		await vi.advanceTimersByTimeAsync(600); // bootstrap timeout

		// user switches language to French
		const lang = document.getElementById("setting-language");
		lang.value = "fr";
		lang.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.advanceTimersByTimeAsync(400); // debounce of schedulePersistSynced

		expect(window.PluginAPI.persistDataSynced).toHaveBeenCalled();
		const payload = JSON.parse(stored);
		expect(payload.settings.lang).toBe("fr");
		expect(payload.session).toBeTruthy();

		// simulate leaving and coming back: fresh boot, empty localStorage,
		// only the synced data survives
		try { window.localStorage.clear(); } catch (e) {}
		const persisted = stored;
		window.PluginAPI = {
			persistDataSynced: vi.fn(),
			loadSyncedData: vi.fn(async () => persisted),
			getTasks: async () => [],
			getArchivedTasks: async () => [],
			getAllProjects: async () => [],
		};
		boot();
		await vi.advanceTimersByTimeAsync(600);

		expect(window.PluginAPI.loadSyncedData).toHaveBeenCalled();
		expect(document.getElementById("setting-language").value).toBe("fr");
		// a translated label proves applyTranslations ran with fr
		expect(document.querySelector('[data-i18n="header.title"]').textContent).toBe("Tableau de bord");
	});

	it("restores view state (pie type, date preset) from synced data", async () => {
		const persisted = JSON.stringify({
			settings: { lang: "fr", billableHpd: "7", lastEditedBillable: "hpd" },
			session: { datePreset: "week", pieChartType: "billable-global", barChartType: "time", projectAll: true, projectIds: [] },
		});
		window.PluginAPI = {
			persistDataSynced: vi.fn(),
			loadSyncedData: vi.fn(async () => persisted),
			getTasks: async () => [],
			getArchivedTasks: async () => [],
			getAllProjects: async () => [],
		};
		boot();
		await vi.advanceTimersByTimeAsync(600);

		expect(document.getElementById("date-preset").value).toBe("week");
		expect(document.getElementById("breakdown-chart-select").value).toBe("billable-global");
		expect(document.getElementById("bar-chart-select").value).toBe("time");
		expect(document.getElementById("billable-hpd").value).toBe("7");
	});

	it("still boots normally when loadSyncedData returns nothing", async () => {
		window.PluginAPI = {
			persistDataSynced: vi.fn(),
			loadSyncedData: vi.fn(async () => null),
			getTasks: async () => [],
			getArchivedTasks: async () => [],
			getAllProjects: async () => [],
		};
		boot();
		await vi.advanceTimersByTimeAsync(600);
		expect(document.getElementById("setting-language").value).toBe("en");
	});
});
