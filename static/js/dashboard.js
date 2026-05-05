/**
 * dashboard.js
 * Handles the dashboard view, task CRUD operations, and the task modal.
 */

/* ------------------------------------------------------------------ */
/*  State                                                               */
/* ------------------------------------------------------------------ */
let allTasks = [];          // cached task list
let editingTaskId = null;   // null = add mode, number = edit mode

/* ------------------------------------------------------------------ */
/*  Bootstrap on page load                                              */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date label
    const label = document.getElementById('today-date-label');
    if (label) label.textContent = formatDate(todayStr());

    // Wire up the task form
    const form = document.getElementById('task-form');
    if (form) form.addEventListener('submit', handleTaskFormSubmit);

    // Initial data load
    loadDashboard();
    loadAllTasks();

    // Close modal on overlay click
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
});

/* ------------------------------------------------------------------ */
/*  Data fetching                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch tasks from the server with optional filters.
 * @param {Object} filters - { date, subject, status }
 * @returns {Promise<Array>}
 */
async function fetchTasks(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date)    params.set('date',    filters.date);
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.status)  params.set('status',  filters.status);

    const res = await fetch(`/get-tasks?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
}

/* ------------------------------------------------------------------ */
/*  Dashboard view                                                      */
/* ------------------------------------------------------------------ */

async function loadDashboard() {
    try {
        allTasks = await fetchTasks();
        updateStats(allTasks);
        renderTodayTasks(allTasks);
        renderUpcomingTasks(allTasks);
    } catch (err) {
        showToast('Could not load tasks.', 'error');
    }
}

/** Update the four stat cards and progress bar. */
function updateStats(tasks) {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.status === 1).length;
    const pending   = total - completed;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    setText('stat-total',     total);
    setText('stat-completed', completed);
    setText('stat-pending',   pending);
    setText('stat-percent',   `${pct}%`);

    // Progress bar
    const bar   = document.getElementById('progress-bar');
    const lbl   = document.getElementById('progress-label');
    const wrap  = document.getElementById('progress-bar-wrap');
    if (bar)  bar.style.width  = `${pct}%`;
    if (lbl)  lbl.textContent  = `${pct}%`;
    if (wrap) wrap.setAttribute('aria-valuenow', pct);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/** Render today's tasks in the dashboard. */
function renderTodayTasks(tasks) {
    const today = todayStr();
    const todayTasks = tasks.filter(t => t.date === today);
    const container  = document.getElementById('today-tasks-list');
    if (!container) return;
    container.innerHTML = '';

    if (todayTasks.length === 0) {
        container.innerHTML = emptyState('No tasks scheduled for today.');
        return;
    }
    todayTasks.forEach(t => container.appendChild(buildTaskItem(t)));
}

/** Render upcoming (future) tasks. */
function renderUpcomingTasks(tasks) {
    const today    = todayStr();
    const upcoming = tasks
        .filter(t => t.date > today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
        .slice(0, 10);

    const container = document.getElementById('upcoming-tasks-list');
    if (!container) return;
    container.innerHTML = '';

    if (upcoming.length === 0) {
        container.innerHTML = emptyState('No upcoming tasks.');
        return;
    }
    upcoming.forEach(t => container.appendChild(buildTaskItem(t)));
}

/* ------------------------------------------------------------------ */
/*  All Tasks view                                                      */
/* ------------------------------------------------------------------ */

async function loadAllTasks(filters = {}) {
    try {
        const tasks = await fetchTasks(filters);
        renderAllTasks(tasks);
    } catch (err) {
        showToast('Could not load tasks.', 'error');
    }
}

function renderAllTasks(tasks) {
    const container = document.getElementById('all-tasks-list');
    if (!container) return;
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = emptyState('No tasks found. Try adjusting your filters.');
        return;
    }

    // Group by date
    const grouped = {};
    tasks.forEach(t => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t);
    });

    Object.keys(grouped).sort().forEach(date => {
        const header = document.createElement('div');
        header.className = 'task-date-header';
        header.innerHTML = `<strong>${formatDate(date)}</strong>`;
        header.style.cssText = 'padding:.5rem 0 .25rem; font-size:.85rem; color:var(--text-secondary); border-bottom:1px solid var(--border); margin-bottom:.4rem;';
        container.appendChild(header);

        grouped[date].forEach(t => container.appendChild(buildTaskItem(t)));
    });
}

/* ------------------------------------------------------------------ */
/*  Task item builder                                                   */
/* ------------------------------------------------------------------ */

function buildTaskItem(task) {
    const item  = document.createElement('div');
    const color = getSubjectColor(task.subject);

    item.className = `task-item${task.status ? ' completed' : ''}`;
    item.dataset.id = task.id;
    // Apply subject color as left border
    item.style.borderLeft = `4px solid ${color}`;

    item.innerHTML = `
        <input
            type="checkbox"
            class="task-checkbox"
            ${task.status ? 'checked' : ''}
            aria-label="Mark ${escHtml(task.subject)} as ${task.status ? 'pending' : 'completed'}"
            onchange="toggleTaskStatus(${task.id}, this.checked)"
        />
        <div class="task-body">
            <div class="task-subject">
                <span class="subject-dot" style="background:${color};"></span>${escHtml(task.subject)}
            </div>
            <div class="task-meta">
                <span>📅 ${formatDate(task.date)}</span>
                <span>🕐 ${formatTime(task.start_time)} – ${formatTime(task.end_time)}</span>
                <span class="badge ${task.status ? 'badge-success' : 'badge-warning'}">
                    ${task.status ? 'Completed' : 'Pending'}
                </span>
            </div>
            ${task.description ? `<div class="task-desc">${escHtml(task.description)}</div>` : ''}
        </div>
        <div class="task-actions">
            <button class="btn-icon" title="Edit task" onclick="openModal('edit', ${task.id})">✏️</button>
            <button class="btn-icon" title="Delete task" onclick="deleteTask(${task.id})">🗑️</button>
        </div>
    `;
    return item;
}

/* ------------------------------------------------------------------ */
/*  Task status toggle                                                  */
/* ------------------------------------------------------------------ */

async function toggleTaskStatus(taskId, isChecked) {
    try {
        const res = await fetch('/update-task', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: taskId, status: isChecked ? 1 : 0 }),
        });
        const data = await res.json();
        if (data.success) {
            showToast(isChecked ? 'Task marked as completed! 🎉' : 'Task marked as pending.', 'success');
            refreshAll();
        } else {
            showToast(data.message || 'Update failed.', 'error');
        }
    } catch {
        showToast('Network error.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Delete task                                                         */
/* ------------------------------------------------------------------ */

async function deleteTask(taskId) {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
        const res = await fetch('/delete-task', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: taskId }),
        });
        const data = await res.json();
        if (data.success) {
            showToast('Task deleted.', 'info');
            refreshAll();
        } else {
            showToast(data.message || 'Delete failed.', 'error');
        }
    } catch {
        showToast('Network error.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Modal                                                               */
/* ------------------------------------------------------------------ */

function openModal(mode, taskId = null) {
    editingTaskId = taskId;
    const overlay   = document.getElementById('modal-overlay');
    const title     = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');

    // Reset form
    document.getElementById('task-form').reset();
    document.getElementById('task-id').value = '';

    if (mode === 'add') {
        title.textContent     = 'Add New Task';
        submitBtn.textContent = 'Add Task';
        document.getElementById('task-date').value = todayStr();
    } else {
        title.textContent     = 'Edit Task';
        submitBtn.textContent = 'Save Changes';

        // Coerce to number — HTML onclick passes strings, JSON returns numbers
        const id   = Number(taskId);
        const task = allTasks.find(t => Number(t.id) === id);

        if (task) {
            document.getElementById('task-id').value      = task.id;
            document.getElementById('task-subject').value = task.subject;
            document.getElementById('task-date').value    = task.date;
            document.getElementById('task-start').value   = task.start_time;
            document.getElementById('task-end').value     = task.end_time;
            document.getElementById('task-desc').value    = task.description || '';
        } else {
            // Task not in cache (e.g. opened from planner) — fetch it directly
            fetchTasks().then(tasks => {
                allTasks = tasks;
                const t = tasks.find(t => Number(t.id) === id);
                if (t) {
                    document.getElementById('task-id').value      = t.id;
                    document.getElementById('task-subject').value = t.subject;
                    document.getElementById('task-date').value    = t.date;
                    document.getElementById('task-start').value   = t.start_time;
                    document.getElementById('task-end').value     = t.end_time;
                    document.getElementById('task-desc').value    = t.description || '';
                    updateModalSubjectDot();
                }
            });
        }
    }

    overlay.classList.add('open');
    document.getElementById('task-subject').focus();
    updateModalSubjectDot();
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
    editingTaskId = null;
}

async function handleTaskFormSubmit(e) {
    e.preventDefault();

    const id      = document.getElementById('task-id').value;
    const subject = document.getElementById('task-subject').value.trim();
    const date    = document.getElementById('task-date').value;
    const start   = document.getElementById('task-start').value;
    const end     = document.getElementById('task-end').value;
    const desc    = document.getElementById('task-desc').value.trim();

    if (!subject || !date || !start || !end) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }
    if (start >= end) {
        showToast('End time must be after start time.', 'warning');
        return;
    }

    const payload = { subject, date, start_time: start, end_time: end, description: desc };
    const isEdit  = Boolean(id);
    if (isEdit) payload.id = parseInt(id, 10);

    const url = isEdit ? '/update-task' : '/add-task';

    try {
        const res  = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.success) {
            showToast(isEdit ? 'Task updated!' : 'Task added!', 'success');
            closeModal();
            refreshAll();
        } else {
            showToast(data.message || 'Operation failed.', 'error');
        }
    } catch {
        showToast('Network error.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Filters (All Tasks view)                                            */
/* ------------------------------------------------------------------ */

function applyFilters() {
    const date    = document.getElementById('filter-date')?.value    || '';
    const subject = document.getElementById('filter-subject')?.value || '';
    const status  = document.getElementById('filter-status')?.value  || '';
    loadAllTasks({ date, subject, status });
}

function clearFilters() {
    const fields = ['filter-date', 'filter-subject', 'filter-status'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    loadAllTasks();
}

/* ------------------------------------------------------------------ */
/*  Refresh helpers                                                     */
/* ------------------------------------------------------------------ */

/** Reload all data-dependent views. */
async function refreshAll() {
    allTasks = await fetchTasks();
    updateStats(allTasks);
    renderTodayTasks(allTasks);
    renderUpcomingTasks(allTasks);
    applyFilters();

    // Refresh planner if it's visible
    if (typeof loadPlannerView === 'function') loadPlannerView();
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function emptyState(msg) {
    return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

/** Update the color dot shown next to the subject input in the modal. */
function updateModalSubjectDot() {
    const input = document.getElementById('task-subject');
    const dot   = document.getElementById('modal-subject-dot');
    if (!input || !dot) return;
    const subject = input.value.trim();
    if (subject) {
        dot.style.background = getSubjectColor(subject);
        dot.style.display    = 'inline-block';
    } else {
        dot.style.display = 'none';
    }
}

/** Escape HTML to prevent XSS. */
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
