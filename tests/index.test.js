import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// Load the generated HTML content for the test environment
// file moved into the sp-dashboard subdirectory
const html = readFileSync(
	resolve(__dirname, "../sp-dashboard/index.html"),
	"utf8",
);

describe("Date Range Reporter UI", () => {
	beforeEach(() => {
		// Reset the DOM
		document.documentElement.innerHTML = html;

		// In a JSDOM environment, we need to manually execute the script
		// because JSDOM doesn't run script tags automatically by default in Vitest
		const scriptElement = Array.from(document.querySelectorAll("script")).find(
			(s) => !s.src && s.textContent.includes("processData"),
		);

		if (scriptElement) {
			// Execute the plugin logic in the global window context
			const runScript = new Function(scriptElement.textContent);
			runScript.call(window);
		}
	});

	describe("Utility Functions", () => {
		it("should correctly format time in milliseconds to hours and minutes", () => {
			// Testing the formatTime function defined in the script
			expect(window.formatTime(3600000)).toBe("1h 0m");
			expect(window.formatTime(9000000)).toBe("2h 30m");
			expect(window.formatTime(0)).toBe("0h 0m");
		});

		it("should format date strings to short readable format", () => {
			expect(window.formatDateShort("2026-02-22")).toBe("Feb 22, 2026");
		});

		it("should generate an array of dates within a range", () => {
			const range = window.getDatesInRange("2026-02-20", "2026-02-22");
			expect(range).toEqual(["2026-02-20", "2026-02-21", "2026-02-22"]);
		});
	});

	describe("Dashboard State Updates", () => {
		it("should calculate metrics correctly and update stat cards", () => {
			const mockTasks = [
				{
					id: "t1",
					parentId: null,
					title: "Task 1",
					isDone: true,
					doneOn: Date.now(),
					timeSpentOnDay: { [new Date().toLocaleDateString('en-CA')]: 7200000 }, // 2h
				},
				{
					id: "t2",
					parentId: null,
					title: "Task 2",
					isDone: false,
					timeSpentOnDay: { [new Date().toLocaleDateString('en-CA')]: 3600000 }, // 1h
				},
			];
			const mockProjects = [{ id: "p1", title: "Test Project" }];

			// Manually trigger the processing logic
			window.processData(mockTasks, mockProjects);

			// Verify UI elements updated
			expect(document.getElementById("stat-time").innerText).toBe("3h 0m");
			expect(document.getElementById("stat-tasks").innerText).toBe("1");
			expect(document.getElementById("stat-tasks-total").innerText).toContain(
				"2 total",
			);

			// Verify progress bar calculation (50%)
			const progressFill = document.getElementById("stat-tasks-progress");
			expect(progressFill.style.width).toBe("50%");
		});

		it("should honor dueDay provided initially", () => {
			const now = Date.now();
			const dueStr = new Date(now - 86400000).toISOString().split("T")[0];
			const task = {
				id: "t-initial",
				parentId: null,
				title: "Initial Overdue",
				isDone: false,
				dueDay: dueStr,
				timeSpentOnDay: {},
			};
			window.processData([task], []);
			expect(document.getElementById("stat-overdue").innerText).toBe("1");
			// table should include this task despite zero time
			const row = document.querySelector("#details-table-body tr");
			expect(row.textContent).toContain("Initial Overdue");
		});

		it("should pick up overdue when dueDay is added later", () => {
			const now = Date.now();
			const task = {
				id: "t-late",
				parentId: null,
				title: "Late Task",
				isDone: false,
				// start without dueDay
				timeSpentOnDay: {},
			};
			const tasks = [task];

			// initial run: no overdue
			window.processData(tasks, []);
			expect(document.getElementById("stat-overdue").innerText).toBe("0");

			// add dueDay yesterday and trigger again
			task.dueDay = new Date(now - 86400000).toISOString().split("T")[0];
			window.processData(tasks, []);
			expect(document.getElementById("stat-overdue").innerText).toBe("1");
		});

		it("should not mark a task overdue/late if dueDay is added on the same day after completion", () => {
			const now = Date.now();
			const task = {
				id: "t-add-today",
				parentId: null,
				title: "Added Today",
				isDone: true,
				doneOn: now,
				timeSpentOnDay: {},
			};
			const tasks = [task];
			// initial run: no dueDay -> not overdue
			window.processData(tasks, []);
			expect(document.getElementById("stat-overdue").innerText).toBe("0");
			expect(document.getElementById("stat-late").innerText).toBe("0");

			// now add dueDay equal to today
			task.dueDay = new Date(now).toISOString().split("T")[0];
			window.processData(tasks, []);
			expect(document.getElementById("stat-overdue").innerText).toBe("0");
			expect(document.getElementById("stat-late").innerText).toBe("0");
		});

		it("should count a task done after its due day as overdue and late", () => {
			const now = Date.now();
			const due = new Date(now - 86400000); // yesterday
			const task = {
				id: "t-done-late",
				parentId: null,
				title: "Done Late",
				isDone: true,
				doneOn: now,
				dueDay: due.toISOString().split("T")[0],
				timeSpentOnDay: {},
			};
			window.processData([task], []);
			expect(document.getElementById("stat-overdue").innerText).toBe("1");
			expect(document.getElementById("stat-late").innerText).toBe("1");
			// table should include the task despite zero time
			const row = document.querySelector("#details-table-body tr");
			expect(row.textContent).toContain("Done Late");
		});

		// new tests covering dueDay/empy status
		it("should handle a task without dueDay by not marking it overdue", () => {
			const task = {
				id: "t-no-due",
				parentId: null,
				title: "No Due Date",
				isDone: false,
				timeSpentOnDay: {},
			};
			window.processData([task], []);
			expect(document.getElementById("stat-overdue").innerText).toBe("0");
			// task has no time entries so it shouldn't contribute to completed/tasks stats
			expect(document.getElementById("stat-tasks").innerText).toBe("0");
		});

		it("should not mark a task due today as late if completed same day", () => {
			const now = Date.now();
			const todayStr = new Date(now).toISOString().split("T")[0];
			const task = {
				id: "t-due-today",
				parentId: null,
				title: "Due Today",
				isDone: true,
				doneOn: now,
				dueDay: todayStr,
				timeSpentOnDay: {},
			};
			window.processData([task], []);
			expect(document.getElementById("stat-late").innerText).toBe("0");
			// row should appear in detail list despite zero time
			const row = document.querySelector("#details-table-body tr");
			expect(row.textContent).toContain("Due Today");
			// ensure totals include the completed task
			expect(document.getElementById("stat-tasks").innerText).toBe("1");
			expect(document.getElementById("stat-tasks-total").innerText).toContain(
				"1 total",
			);
		});

		it("should count a completed subtask in total tasks", () => {
			const now = Date.now();
			const sub = {
				id: "sub1",
				parentId: "parent",
				title: "subtask done",
				isDone: true,
				doneOn: now,
				dueDay: new Date(now).toISOString().split("T")[0],
				timeSpentOnDay: {},
			};
			window.processData([sub], []);
			expect(document.getElementById("stat-tasks").innerText).toBe("1");
			expect(document.getElementById("stat-tasks-total").innerText).toContain(
				"1 total",
			);
		});

		it("should count tasks due today in totalTasks denominator even with no time logged", () => {
			const todayStr = new Date().toISOString().split("T")[0];
			const taskDueToday = {
				id: "t-due-no-time",
				parentId: null,
				title: "Due Today No Time",
				isDone: false,
				dueDay: todayStr,
				timeSpentOnDay: {},
			};
			window.processData([taskDueToday], []);
			// Task is due today so it should appear in the denominator
			expect(document.getElementById("stat-tasks-total").innerText).toContain(
				"1 total",
			);
			// Not completed, so numerator stays 0
			expect(document.getElementById("stat-tasks").innerText).toBe("0");
		});

		it("should deduplicate tasks that appear in both active and archived lists", () => {
			const now = Date.now();
			const doneTask = {
				id: "task1",
				parentId: null,
				title: "Done Task",
				isDone: true,
				doneOn: now,
				dueDay: new Date(now).toISOString().split("T")[0],
				timeSpentOnDay: {},
			};
			// Simulate what happens when pullDataFromSP combines activeTasks and archivedTasks
			// The same task appears in both lists (which can happen with completed tasks)
			const activeTasks = [doneTask];
			const archivedTasks = [doneTask];

			// Deduplicate using Map (same logic as in pullDataFromSP)
			const taskMap = new Map();
			archivedTasks.forEach((task) => {
				taskMap.set(task.id, task);
			});
			activeTasks.forEach((task) => {
				taskMap.set(task.id, task);
			});
			const deduplicatedTasks = Array.from(taskMap.values());

			// Should have only 1 unique task, not 2
			expect(deduplicatedTasks.length).toBe(1);

			// Process the deduplicated list and verify count is 1, not 2
			window.processData(deduplicatedTasks, []);
			expect(document.getElementById("stat-tasks").innerText).toBe("1");
		});
	});

	describe("Navigation & Interactivity", () => {
		it("should switch between Dashboard and Detailed List tabs", () => {
			const dashView = document.getElementById("view-dashboard");
			const detailsView = document.getElementById("view-details");
			const dashBtn = document.getElementById("tab-btn-dashboard");
			const detailsBtn = document.getElementById("tab-btn-details");

			// Default state: Dashboard should be visible and active
			expect(dashView.classList.contains("hidden")).toBe(false);
			expect(detailsView.classList.contains("hidden")).toBe(true);
			expect(dashBtn.classList.contains("active")).toBe(true);

			// Switch to details
			window.switchTab("details");
			expect(dashView.classList.contains("hidden")).toBe(true);
			expect(detailsView.classList.contains("hidden")).toBe(false);
			expect(detailsBtn.classList.contains("active")).toBe(true);

			// back to dashboard again
			window.switchTab("dashboard");
			expect(dashView.classList.contains("hidden")).toBe(false);
			expect(dashBtn.classList.contains("active")).toBe(true);
		});

		it("should show custom date pickers only when Custom Range is selected", () => {
			const presetSelect = document.getElementById("date-preset");
			const customContainer = document.getElementById("custom-date-container");

			// Set to custom
			presetSelect.value = "custom";
			presetSelect.dispatchEvent(new Event("change"));
			expect(customContainer.classList.contains("hidden")).toBe(false);

			// Set back to week
			presetSelect.value = "week";
			presetSelect.dispatchEvent(new Event("change"));
			expect(customContainer.classList.contains("hidden")).toBe(true);
		});

		it("today preset should produce a single-day date range", () => {
			const presetSelect = document.getElementById("date-preset");
			presetSelect.value = "today";
			presetSelect.dispatchEvent(new Event("change"));

			window.processData([], []);

			// The bar chart should contain exactly one bar column (one day)
			const barContainer = document.getElementById("bar-chart-container");
			expect(barContainer.querySelectorAll(".bar-col").length).toBe(1);
		});

		it("bar and pie charts should render for overdue and late types and details show badges", () => {
			// prepare metrics with one overdue task and one late task
			const now = Date.now();
			const yesterdayStr = new Date(now - 86400000).toISOString().split("T")[0];
			const overdueTask = {
				id: "t1",
				parentId: null,
				title: "Foo",
				isDone: false,
				dueDay: "2026-02-20",
				timeSpentOnDay: { "2026-02-20": 0 },
			};
			const lateTask = {
				id: "t2",
				parentId: null,
				title: "Bar",
				isDone: true,
				doneOn: now,
				dueDay: yesterdayStr,
				timeSpentOnDay: {},
			};
			window.processData([overdueTask, lateTask], []);

			// verify list badges
			const rows = document.querySelectorAll("#details-table-body tr");
			expect(rows.length).toBe(2);
			const text = Array.from(rows)
				.map((r) => r.textContent)
				.join(" ");
			expect(text).toContain("Overdue");
			expect(text).toContain("Late");

			const barSelect = document.getElementById("bar-chart-select");
			const pieSelect = document.getElementById("breakdown-chart-select");
			const barContainer = document.getElementById("bar-chart-container");

			// bar count limits for presets - grouping is always daily by default (no auto-bucketing)
			const preset = document.getElementById("date-preset");
			preset.value = "month";
			preset.dispatchEvent(new Event("change"));
			window.processData([overdueTask, lateTask], []);
			expect(
				barContainer.querySelectorAll(".bar-col").length,
			).toBeLessThanOrEqual(32);
			preset.value = "year";
			preset.dispatchEvent(new Event("change"));
			window.processData([overdueTask, lateTask], []);
			expect(
				barContainer.querySelectorAll(".bar-col").length,
			).toBeLessThanOrEqual(366);

			barSelect.value = "overdue";
			window.updateBarChart();
			expect(barContainer.querySelector(".bar")).not.toBeNull();

			barSelect.value = "late";
			window.updateBarChart();
			expect(barContainer.querySelector(".bar")).not.toBeNull();

			pieSelect.value = "overdue";
			window.updateProjectBreakdown();
			// JSDOM may not retain gradient string, but legend items should appear
			const pieLegend = document.getElementById("breakdown-list");
			expect(pieLegend.querySelector(".breakdown-item")).not.toBeNull();

			pieSelect.value = "late";
			window.updateProjectBreakdown();
			expect(pieLegend.querySelector(".breakdown-item")).not.toBeNull();
		});

		it("today preset is the default and produces a single-day label on the bar axis", () => {
			const preset = document.getElementById("date-preset");
			expect(preset.value).toBe("today");
			const barContainer = document.getElementById("bar-chart-container");
			window.processData([], []);
			// one bar column for a single-day range
			expect(barContainer.querySelectorAll(".bar-col").length).toBe(1);
			// label should be today in MM-DD format (default setting)
			const label = barContainer.querySelector(".x-label");
			const today = new Date().toISOString().split("T")[0];
			expect(label.textContent).toBe(today.substring(5)); // MM-DD
		});

		it("weekly grouping produces fewer bar columns than daily for a month range", () => {
			const preset = document.getElementById("date-preset");
			preset.value = "month";
			preset.dispatchEvent(new Event("change"));
			window.processData([], []);

			const barContainer = document.getElementById("bar-chart-container");
			const dailyCount = barContainer.querySelectorAll(".bar-col").length;
			expect(dailyCount).toBeGreaterThan(4);

			document.getElementById("setting-bar-grouping").value = "weekly";
			document
				.getElementById("setting-bar-grouping")
				.dispatchEvent(new Event("change"));
			const weeklyCount = barContainer.querySelectorAll(".bar-col").length;
			expect(weeklyCount).toBeLessThan(dailyCount);
			expect(weeklyCount).toBeLessThanOrEqual(6);

			// restore
			document.getElementById("setting-bar-grouping").value = "daily";
			document
				.getElementById("setting-bar-grouping")
				.dispatchEvent(new Event("change"));
		});

		it("monthly grouping collapses a year range to at most 12 bar columns", () => {
			const preset = document.getElementById("date-preset");
			preset.value = "year";
			preset.dispatchEvent(new Event("change"));
			window.processData([], []);

			document.getElementById("setting-bar-grouping").value = "monthly";
			document
				.getElementById("setting-bar-grouping")
				.dispatchEvent(new Event("change"));

			const barContainer = document.getElementById("bar-chart-container");
			// a year range spans up to 13 calendar months (e.g. May '25 -> May '26)
			expect(
				barContainer.querySelectorAll(".bar-col").length,
			).toBeLessThanOrEqual(13);

			document.getElementById("setting-bar-grouping").value = "daily";
			document
				.getElementById("setting-bar-grouping")
				.dispatchEvent(new Event("change"));
		});

		it("measure row is hidden when grouping is daily and visible when weekly", () => {
			const aggRow = document.getElementById("setting-bar-agg-row");
			expect(aggRow.style.display).toBe("none");

			document.getElementById("setting-bar-grouping").value = "weekly";
			document
				.getElementById("setting-bar-grouping")
				.dispatchEvent(new Event("change"));
			expect(aggRow.style.display).not.toBe("none");

			document.getElementById("setting-bar-grouping").value = "daily";
			document
				.getElementById("setting-bar-grouping")
				.dispatchEvent(new Event("change"));
			expect(aggRow.style.display).toBe("none");
		});

		it("x-axis labels use .x-label class and are positioned as percentage left", () => {
			const preset = document.getElementById("date-preset");
			preset.value = "week";
			preset.dispatchEvent(new Event("change"));
			window.processData([], []);

			const barContainer = document.getElementById("bar-chart-container");
			const labels = barContainer.querySelectorAll(".x-label");
			expect(labels.length).toBeGreaterThan(0);
			labels.forEach((lbl) => {
				expect(lbl.style.left).toMatch(/%$/);
			});
		});

		it("billable panel is hidden when project breakdown type is not billable", () => {
			const pieSelect = document.getElementById("breakdown-chart-select");
			const billablePanel = document.getElementById("billable-panel");

			// need data so updateProjectBreakdown doesn't exit early
			window.processData([], []);

			pieSelect.value = "completed";
			window.updateProjectBreakdown();
			expect(billablePanel.classList.contains("hidden")).toBe(true);

			pieSelect.value = "time";
			window.updateProjectBreakdown();
			expect(billablePanel.classList.contains("hidden")).toBe(true);

			pieSelect.value = "billable-global";
			window.updateProjectBreakdown();
			expect(billablePanel.classList.contains("hidden")).toBe(false);

			pieSelect.value = "completed";
			window.updateProjectBreakdown();
			expect(billablePanel.classList.contains("hidden")).toBe(true);
		});

		it("detail list columns are sortable when headers are clicked", () => {
			// create two tasks with different dates
			const taskA = {
				id: "a",
				parentId: null,
				title: "A",
				isDone: false,
				dueDay: "2026-01-01",
				timeSpentOnDay: { "2026-01-01": 3600000 },
			};
			const taskB = {
				id: "b",
				parentId: null,
				title: "B",
				isDone: false,
				dueDay: "2026-01-02",
				timeSpentOnDay: { "2026-01-02": 3600000 },
			};
			window.processData([taskA, taskB], []);
			// capture initial order of date cells
			const initial = Array.from(
				document.querySelectorAll("#details-table-body tr td:first-child"),
			).map((td) => td.textContent);
			expect(initial.length).toBe(2);
			// click date header to toggle order and check indicator
			const dateTh = document.querySelector(
				'#view-details th[data-sort="date"]',
			);
			dateTh.click();
			expect(dateTh.classList.contains("sorted-asc")).toBe(true);
			const after = Array.from(
				document.querySelectorAll("#details-table-body tr td:first-child"),
			).map((td) => td.textContent);
			expect(after[0]).toBe(initial[1]);
			expect(after[1]).toBe(initial[0]);
			// clicking again flips direction
			dateTh.click();
			expect(dateTh.classList.contains("sorted-desc")).toBe(true);
		});
	});

	describe("Project Filter", () => {
		const today = new Date().toISOString().split("T")[0];
		const projectA = { id: "pA", title: "Project Alpha" };
		const projectB = { id: "pB", title: "Project Beta" };
		const taskA = {
			id: "tA",
			parentId: null,
			title: "Task Alpha",
			isDone: false,
			projectId: "pA",
			timeSpentOnDay: { [today]: 3600000 },
		};
		const taskB = {
			id: "tB",
			parentId: null,
			title: "Task Beta",
			isDone: false,
			projectId: "pB",
			timeSpentOnDay: { [today]: 7200000 },
		};
		const taskUncat = {
			id: "tU",
			parentId: null,
			title: "Uncat Task",
			isDone: false,
			projectId: null,
			timeSpentOnDay: { [today]: 1800000 },
		};

		// helpers to manipulate the dropdown directly
		const selectOnly = (id) => {
			const dropdown = document.getElementById("project-filter-dropdown");
			const allCb = dropdown.querySelector('input[value="all"]');
			if (allCb) allCb.checked = false;
			dropdown
				.querySelectorAll('input[type=checkbox]:not([value="all"])')
				.forEach((cb) => {
					cb.checked = cb.value === id;
				});
		};

		const selectAll = () => {
			const dropdown = document.getElementById("project-filter-dropdown");
			dropdown.querySelectorAll("input[type=checkbox]").forEach((cb) => {
				cb.checked = cb.value === "all";
			});
		};

		it('should show all tasks when "All Projects" is selected (default)', () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			selectAll();
			window.processData([taskA, taskB], [projectA, projectB]);
			// total time = 1h + 2h
			expect(document.getElementById("stat-time").innerText).toBe("3h 0m");
		});

		it("should filter to only the selected project", () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			selectOnly("pA");
			window.processData([taskA, taskB], [projectA, projectB]);
			expect(document.getElementById("stat-time").innerText).toBe("1h 0m");
		});

		it("should filter to a different single project", () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			selectOnly("pB");
			window.processData([taskA, taskB], [projectA, projectB]);
			expect(document.getElementById("stat-time").innerText).toBe("2h 0m");
		});

		it('should show only uncategorized tasks when "Uncategorized" is selected', () => {
			window.updateProjectFilter(
				[projectA, projectB],
				[taskA, taskB, taskUncat],
			);
			selectOnly("uncategorized");
			window.processData([taskA, taskB, taskUncat], [projectA, projectB]);
			expect(document.getElementById("stat-time").innerText).toBe("0h 30m");
		});

		it('button label shows "All Projects" when all checkbox is checked', () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			selectAll();
			window.updateProjectFilterBtn();
			expect(document.getElementById("project-filter-btn").textContent).toBe(
				"All Projects",
			);
		});

		it("button label shows project name when exactly one project is selected", () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			selectOnly("pA");
			window.updateProjectFilterBtn();
			expect(
				document.getElementById("project-filter-btn").textContent,
			).toContain("Project Alpha");
		});

		it('button label shows "N projects" when multiple projects are selected', () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			const dropdown = document.getElementById("project-filter-dropdown");
			const allCb = dropdown.querySelector('input[value="all"]');
			if (allCb) allCb.checked = false;
			dropdown
				.querySelectorAll('input[type=checkbox]:not([value="all"])')
				.forEach((cb) => {
					cb.checked = true;
				});
			window.updateProjectFilterBtn();
			expect(document.getElementById("project-filter-btn").textContent).toBe(
				"2 projects",
			);
		});

		it("detail table rows have a colored dot for each project", () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			selectAll();
			window.processData([taskA, taskB], [projectA, projectB]);
			window.switchTab("details");
			const dots = document.querySelectorAll(
				'#details-table-body td span[style*="border-radius: 50%"]',
			);
			expect(dots.length).toBeGreaterThanOrEqual(2);
			// each dot should have a background color set
			dots.forEach((dot) => {
				expect(dot.style.background).not.toBe("");
			});
		});

		it("filters the detail table rows to match the selected project", () => {
			window.updateProjectFilter([projectA, projectB], [taskA, taskB]);
			selectOnly("pA");
			window.processData([taskA, taskB], [projectA, projectB]);
			window.switchTab("details");
			const rows = document.querySelectorAll("#details-table-body tr");
			expect(rows.length).toBe(1);
			expect(rows[0].textContent).toContain("Task Alpha");
			expect(rows[0].textContent).not.toContain("Task Beta");
		});
	});
});
