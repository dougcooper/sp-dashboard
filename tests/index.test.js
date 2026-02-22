import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load the generated HTML content for the test environment
// file moved into the sp-dashboard subdirectory
const html = readFileSync(resolve(__dirname, '../sp-dashboard/index.html'), 'utf8');

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
          timeSpentOnDay: { [new Date().toISOString().split('T')[0]]: 7200000 } // 2h
        },
        {
          id: 't2',
          parentId: null,
          title: 'Task 2',
          isDone: false,
          timeSpentOnDay: { [new Date().toISOString().split('T')[0]]: 3600000 } // 1h
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

    it('should honor dueDay provided initially (no plannedAt)', () => {
      const now = Date.now();
      const dueStr = new Date(now - 86400000).toISOString().split('T')[0];
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

      // add dueDay and trigger again
      task.dueDay = new Date(now - 86400000).toISOString().split('T')[0];
      window.processData(tasks, []);
      expect(document.getElementById('stat-overdue').innerText).toBe('1');
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
        dueDay: due.toISOString().split('T')[0],
        timeSpentOnDay: {}
      };
      window.processData([task], []);
      expect(document.getElementById('stat-overdue').innerText).toBe('1');
      expect(document.getElementById('stat-late').innerText).toBe('1');
      // table should include the task despite zero time
      const row = document.querySelector('#details-table-body tr');
      expect(row.textContent).toContain('Done Late');
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

    it('bar and pie charts should render for overdue and late types and details show badges', () => {
      // prepare metrics with one overdue task and one late task
      const now = Date.now();
      const yesterdayStr = new Date(now - 86400000).toISOString().split('T')[0];
      const overdueTask = { id:'t1', parentId:null, title:'Foo', isDone:false, dueDay:'2026-02-20', timeSpentOnDay:{'2026-02-20':0} };
      const lateTask = { id:'t2', parentId:null, title:'Bar', isDone:true, doneOn: now, dueDay: yesterdayStr, timeSpentOnDay:{} };
      window.processData([overdueTask, lateTask], []);

      // verify list badges
      const rows = document.querySelectorAll('#details-table-body tr');
      expect(rows.length).toBe(2);
      // both badges should appear somewhere in the table
      const text = Array.from(rows).map(r => r.textContent).join(' ');
      expect(text).toContain('Overdue');
      expect(text).toContain('Late');

      const barSelect = document.getElementById('bar-chart-select');
      const pieSelect = document.getElementById('pie-chart-select');
      const barContainer = document.getElementById('bar-chart-container');
      const pieContainer = document.getElementById('pie-chart-element');

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
      // click date header to toggle order
      const dateTh = document.querySelector('#view-details th[data-sort="date"]');
      dateTh.click();
      const after = Array.from(document.querySelectorAll('#details-table-body tr td:first-child')).map(td => td.textContent);
      // the arrays should be reversed
      expect(after[0]).toBe(initial[1]);
      expect(after[1]).toBe(initial[0]);
    });
  });
});