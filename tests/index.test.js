import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load the generated HTML content for the test environment
// file moved into the sp-dashboard subdirectory
const html = readFileSync(resolve(__dirname, '../sp-dashboard/index.html'), 'utf8');

const toLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

describe('Date Range Reporter UI', () => {
  let scriptContent;

  beforeEach(() => {
    // Reset the DOM
    document.documentElement.innerHTML = html;

    // In a JSDOM environment, we need to manually execute the script 
    // because JSDOM doesn't run script tags automatically by default in Vitest
    const scriptElement = Array.from(document.querySelectorAll('script'))
      .find(s => !s.src && s.textContent.includes('processData'));
    
    if (scriptElement) {
      // Execute the plugin logic in the global window context
      const runScript = new Function(scriptElement.textContent);
      runScript.call(window);
    }
  });

  describe('Utility Functions', () => {
    it('should correctly format time in milliseconds to hours and minutes', () => {
      // Testing the formatTime function defined in the script
      expect(window.formatTime(3600000)).toBe('1h 0m');
      expect(window.formatTime(9000000)).toBe('2h 30m');
      expect(window.formatTime(0)).toBe('0h 0m');
    });

    it('should format date strings to short readable format', () => {
      expect(window.formatDateShort('2026-02-22')).toBe('Feb 22, 2026');
    });

    it('should generate an array of dates within a range', () => {
      const range = window.getDatesInRange('2026-02-20', '2026-02-22');
      expect(range).toEqual(['2026-02-20', '2026-02-21', '2026-02-22']);
    });

    it('getDatesInRange should tolerate full ISO timestamps as inputs', () => {
      const range = window.getDatesInRange('2026-02-20T10:00:00Z', '2026-02-22T10:00:00Z');
      expect(range).toEqual(['2026-02-20', '2026-02-21', '2026-02-22']);
    });

    it('getDueBounds dueEnd should be end-of-day (DST-safe calculation)', () => {
      const { dueStart, dueEnd } = window.getDueBounds({ dueDay: '2026-03-28' });
      expect(dueStart).not.toBeNull();
      expect(dueEnd).toBeGreaterThan(dueStart);
      expect(dueEnd - dueStart).toBeGreaterThanOrEqual(82800000); // at least 23h
      expect(dueEnd - dueStart).toBeLessThanOrEqual(90000000);    // at most 25h
    });

    it('getDueBounds should handle a full ISO timestamp in dueDay', () => {
      const { dueStart, dueEnd } = window.getDueBounds({ dueDay: '2026-02-20T10:00:00Z' });
      expect(dueStart).not.toBeNull();
      expect(dueEnd).not.toBeNull();
      // dueStart should parse to 2026-02-20 local midnight
      expect(toLocalDate(new Date(dueStart))).toBe('2026-02-20');
    });

    it('month preset should not roll over when today is the 31st', () => {
      // March 31, 2026 at noon — without the fix, setMonth(Feb) on Mar 31 rolls to Mar 3
      vi.useFakeTimers({ now: new Date('2026-03-31T12:00:00').getTime() });
      const consoleSpy = vi.spyOn(console, 'log');
      const presetSelect = document.getElementById('date-preset');
      presetSelect.value = 'month';
      presetSelect.dispatchEvent(new Event('change'));
      window.processData([], []);
      vi.useRealTimers();
      const rangeLog = consoleSpy.mock.calls.find(args => String(args[0]).includes('computed date range'));
      expect(rangeLog).toBeDefined();
      expect(rangeLog[1]).toBe('2026-02-28'); // should be Feb 28, not Mar 3
      expect(rangeLog[2]).toBe('2026-03-31');
      consoleSpy.mockRestore();
    });
  });

  describe('Dashboard State Updates', () => {
    it('should calculate metrics correctly and update stat cards', () => {
      const mockTasks = [
        {
          id: 't1',
          parentId: null,
          title: 'Task 1',
          isDone: true,
          doneOn: new Date().getTime(),
          timeSpentOnDay: { [toLocalDate(new Date())]: 7200000 } // 2h
        },
        {
          id: 't2',
          parentId: null,
          title: 'Task 2',
          isDone: false,
          timeSpentOnDay: { [toLocalDate(new Date())]: 3600000 } // 1h
        }
      ];
      const mockProjects = [{ id: 'p1', title: 'Test Project' }];

      // Manually trigger the processing logic
      window.processData(mockTasks, mockProjects);

      // Verify UI elements updated
      expect(document.getElementById('stat-time').innerText).toBe('3h 0m');
      expect(document.getElementById('stat-tasks').innerText).toBe('1');
      expect(document.getElementById('stat-tasks-total').innerText).toContain('2 total');
      
      // Verify progress bar calculation (50%)
      const progressFill = document.getElementById('stat-tasks-progress');
      expect(progressFill.style.width).toBe('50%');
    });

    it('should honor dueDay provided initially', () => {
      const now = Date.now();
      const dueStr = toLocalDate(new Date(now - 86400000));
      const task = {
        id: 't-initial',
        parentId: null,
        title: 'Initial Overdue',
        isDone: false,
        dueDay: dueStr,
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      expect(document.getElementById('stat-overdue').innerText).toBe('1');
      // table should include this task despite zero time
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('Initial Overdue');
    });

    it('should pick up overdue when dueDay is added later', () => {
      const now = Date.now();
      const task = {
        id: 't-late',
        parentId: null,
        title: 'Late Task',
        isDone: false,
        // start without dueDay
        timeSpentOnDay: {}
      };
      const tasks = [ task ];

      // initial run: no overdue
      window.processData(tasks, []);
      expect(document.getElementById('stat-overdue').innerText).toBe('0');

      // add dueDay yesterday and trigger again
      task.dueDay = toLocalDate(new Date(now - 86400000));
      window.processData(tasks, []);
      expect(document.getElementById('stat-overdue').innerText).toBe('1');
    });

    it('should not mark a task overdue/late if dueDay is added on the same day after completion', () => {
      const now = Date.now();
      const task = {
        id: 't-add-today',
        parentId: null,
        title: 'Added Today',
        isDone: true,
        doneOn: now,
        timeSpentOnDay: {}
      };
      const tasks = [ task ];
      // initial run: no dueDay -> not overdue
      window.processData(tasks, []);
      expect(document.getElementById('stat-overdue').innerText).toBe('0');
      expect(document.getElementById('stat-late').innerText).toBe('0');

      // now add dueDay equal to today
      task.dueDay = toLocalDate(new Date(now));
      window.processData(tasks, []);
      expect(document.getElementById('stat-overdue').innerText).toBe('0');
      expect(document.getElementById('stat-late').innerText).toBe('0');
    });

    it('should count a task done after its due day as overdue and late', () => {
      const now = Date.now();
      const due = new Date(now - 86400000); // yesterday
      const task = {
        id: 't-done-late',
        parentId: null,
        title: 'Done Late',
        isDone: true,
        doneOn: now,
        dueDay: toLocalDate(due),
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      expect(document.getElementById('stat-overdue').innerText).toBe('1');
      expect(document.getElementById('stat-late').innerText).toBe('1');
      // table should include the task despite zero time
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('Done Late');
    });

    // new tests covering dueDay/empy status
    it('should handle a task without dueDay by not marking it overdue', () => {
      const now = Date.now();
      const task = {
        id: 't-no-due',
        parentId: null,
        title: 'No Due Date',
        isDone: false,
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      expect(document.getElementById('stat-overdue').innerText).toBe('0');
      // task has no time entries so it shouldn't contribute to completed/tasks stats
      expect(document.getElementById('stat-tasks').innerText).toBe('0');
    });

    it('should not mark a task due today as late if completed same day', () => {
      const now = Date.now();
      const todayStr = toLocalDate(new Date(now));
      const task = {
        id: 't-due-today',
        parentId: null,
        title: 'Due Today',
        isDone: true,
        doneOn: now,
        dueDay: todayStr,
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      expect(document.getElementById('stat-late').innerText).toBe('0');
      // row should appear in detail list despite zero time
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('Due Today');
      // ensure totals include the completed task
      expect(document.getElementById('stat-tasks').innerText).toBe('1');
      expect(document.getElementById('stat-tasks-total').innerText).toContain('1 total');
    });

    it('should count a completed subtask in total tasks', () => {
      const now = Date.now();
      const sub = {
        id: 'sub1',
        parentId: 'parent',
        title: 'subtask done',
        isDone: true,
        doneOn: now,
        dueDay: toLocalDate(new Date(now)),
        timeSpentOnDay: {}
      };
      window.processData([sub], []);
      expect(document.getElementById('stat-tasks').innerText).toBe('1');
      expect(document.getElementById('stat-tasks-total').innerText).toContain('1 total');
    });

    it('should count tasks due today in totalTasks denominator even with no time logged', () => {
      const todayStr = toLocalDate(new Date());
      const taskDueToday = {
        id: 't-due-no-time',
        parentId: null,
        title: 'Due Today No Time',
        isDone: false,
        dueDay: todayStr,
        timeSpentOnDay: {}
      };
      window.processData([taskDueToday], []);
      // Task is due today so it should appear in the denominator
      expect(document.getElementById('stat-tasks-total').innerText).toContain('1 total');
      // Not completed, so numerator stays 0
      expect(document.getElementById('stat-tasks').innerText).toBe('0');
    });

    it('should deduplicate tasks that appear in both active and archived lists', () => {
      const now = Date.now();
      const doneTask = {
        id: 'task1',
        parentId: null,
        title: 'Done Task',
        isDone: true,
        doneOn: now,
        dueDay: toLocalDate(new Date(now)),
        timeSpentOnDay: {}
      };
      // Simulate what happens when pullDataFromSP combines activeTasks and archivedTasks
      // The same task appears in both lists (which can happen with completed tasks)
      const activeTasks = [doneTask];
      const archivedTasks = [doneTask];
      
      // Deduplicate using Map (same logic as in pullDataFromSP)
      const taskMap = new Map();
      archivedTasks.forEach(task => taskMap.set(task.id, task));
      activeTasks.forEach(task => taskMap.set(task.id, task));
      const deduplicatedTasks = Array.from(taskMap.values());
      
      // Should have only 1 unique task, not 2
      expect(deduplicatedTasks.length).toBe(1);
      
      // Process the deduplicated list and verify count is 1, not 2
      window.processData(deduplicatedTasks, []);
      expect(document.getElementById('stat-tasks').innerText).toBe('1');
    });
  });

  describe('Navigation & Interactivity', () => {
    it('should switch between Dashboard and Detailed List tabs', () => {
      const dashView = document.getElementById('view-dashboard');
      const detailsView = document.getElementById('view-details');
      const dashBtn = document.getElementById('tab-btn-dashboard');
      const detailsBtn = document.getElementById('tab-btn-details');

      // Default state: Dashboard should be visible and active
      expect(dashView.classList.contains('hidden')).toBe(false);
      expect(detailsView.classList.contains('hidden')).toBe(true);
      expect(dashBtn.classList.contains('active')).toBe(true);

      // Switch to details
      window.switchTab('details');
      expect(dashView.classList.contains('hidden')).toBe(true);
      expect(detailsView.classList.contains('hidden')).toBe(false);
      expect(detailsBtn.classList.contains('active')).toBe(true);

      // back to dashboard again
      window.switchTab('dashboard');
      expect(dashView.classList.contains('hidden')).toBe(false);
      expect(dashBtn.classList.contains('active')).toBe(true);
    });

    it('should show custom date pickers only when Custom Range is selected', () => {
      const presetSelect = document.getElementById('date-preset');
      const customContainer = document.getElementById('custom-date-container');

      // Set to custom
      presetSelect.value = 'custom';
      presetSelect.dispatchEvent(new Event('change'));
      expect(customContainer.classList.contains('hidden')).toBe(false);

      // Set back to week
      presetSelect.value = 'week';
      presetSelect.dispatchEvent(new Event('change'));
      expect(customContainer.classList.contains('hidden')).toBe(true);
    });

    it('today preset should produce a single-day date range', () => {
      const presetSelect = document.getElementById('date-preset');
      presetSelect.value = 'today';
      presetSelect.dispatchEvent(new Event('change'));

      window.processData([], []);

      // The bar chart should contain exactly one bar column (one day)
      const barContainer = document.getElementById('bar-chart-container');
      expect(barContainer.querySelectorAll('.bar-col').length).toBe(1);
    });

    it('this-week preset should include Monday through today and exclude last Sunday', () => {
      const presetSelect = document.getElementById('date-preset');
      presetSelect.value = 'this-week';
      presetSelect.dispatchEvent(new Event('change'));

      // Build a task logged on last Sunday (always before this week's Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const lastSunday = new Date(now);
      lastSunday.setDate(now.getDate() - daysToMonday - 1);
      const lastSundayStr = toLocalDate(lastSunday);
      const todayStr = toLocalDate(now);

      const taskThisWeek = { id: 'tw1', parentId: null, title: 'This Week Task', isDone: true, doneOn: now.getTime(), timeSpentOnDay: { [todayStr]: 3600000 } };
      const taskLastWeek = { id: 'tw2', parentId: null, title: 'Last Week Task', isDone: true, doneOn: lastSunday.getTime(), timeSpentOnDay: { [lastSundayStr]: 3600000 } };

      window.processData([taskThisWeek, taskLastWeek], []);

      // Only this week's task time should be counted
      expect(document.getElementById('stat-time').innerText).toBe('1h 0m');

      // Bar chart should have at most 7 bars (Mon–today)
      const barContainer = document.getElementById('bar-chart-container');
      expect(barContainer.querySelectorAll('.bar-col').length).toBeLessThanOrEqual(7);
      expect(barContainer.querySelectorAll('.bar-col').length).toBeGreaterThanOrEqual(1);
    });

    it('bar and pie charts should render for overdue and late types and details show badges', () => {
      // prepare metrics with one overdue task and one late task
      const now = Date.now();
      const yesterdayStr = toLocalDate(new Date(now - 86400000));
      const overdueTask = { id:'t1', parentId:null, title:'Foo', isDone:false, dueDay:'2026-02-20', timeSpentOnDay:{'2026-02-20':0} };
      const lateTask = { id:'t2', parentId:null, title:'Bar', isDone:true, doneOn: now, dueDay: yesterdayStr, timeSpentOnDay:{} };
      window.processData([overdueTask, lateTask], []);


      // verify list badges
      const rows = document.querySelectorAll('#details-table-body tr');
      expect(rows.length).toBe(2);
      const text = Array.from(rows).map(r => r.textContent).join(' ');
      expect(text).toContain('Overdue');
      expect(text).toContain('Late');

      const barSelect = document.getElementById('bar-chart-select');
      const pieSelect = document.getElementById('pie-chart-select');
      const barContainer = document.getElementById('bar-chart-container');
      const pieContainer = document.getElementById('pie-chart-element');

      // bar count limits for presets
      const preset = document.getElementById('date-preset');
      preset.value = 'month';
      preset.dispatchEvent(new Event('change'));
      window.processData([overdueTask, lateTask], []);
      expect(barContainer.querySelectorAll('.bar-col').length).toBeLessThanOrEqual(12);
      preset.value = 'year';
      preset.dispatchEvent(new Event('change'));
      window.processData([overdueTask, lateTask], []);
      expect(barContainer.querySelectorAll('.bar-col').length).toBeLessThanOrEqual(12);

      barSelect.value = 'overdue';
      window.updateBarChart();
      expect(barContainer.querySelector('.bar')).not.toBeNull();

      barSelect.value = 'late';
      window.updateBarChart();
      expect(barContainer.querySelector('.bar')).not.toBeNull();

      pieSelect.value = 'overdue';
      window.updatePieChart();
      // JSDOM may not retain gradient string, but legend items should appear
      const pieLegend = document.getElementById('pie-legend-container');
      expect(pieLegend.querySelector('.legend-item')).not.toBeNull();

      pieSelect.value = 'late';
      window.updatePieChart();
      expect(pieLegend.querySelector('.legend-item')).not.toBeNull();
    });

    it('detail list columns are sortable when headers are clicked', () => {
      // create two tasks with different dates
      const taskA = { id:'a', parentId:null, title:'A', isDone:false, dueDay:'2026-01-01', timeSpentOnDay:{'2026-01-01':3600000} };
      const taskB = { id:'b', parentId:null, title:'B', isDone:false, dueDay:'2026-01-02', timeSpentOnDay:{'2026-01-02':3600000} };
      window.processData([taskA, taskB], []);
      // capture initial order of date cells
      const initial = Array.from(document.querySelectorAll('#details-table-body tr td:first-child')).map(td => td.textContent);
      expect(initial.length).toBe(2);
      // click date header to toggle order and check indicator
      const dateTh = document.querySelector('#view-details th[data-sort="date"]');
      dateTh.click();
      expect(dateTh.classList.contains('sorted-asc')).toBe(true);
      const after = Array.from(document.querySelectorAll('#details-table-body tr td:first-child')).map(td => td.textContent);
      expect(after[0]).toBe(initial[1]);
      expect(after[1]).toBe(initial[0]);
      // clicking again flips direction
      dateTh.click();
      expect(dateTh.classList.contains('sorted-desc')).toBe(true);
    });
  });
});