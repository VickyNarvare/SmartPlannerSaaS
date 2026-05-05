/**
 * planner.js
 * Handles the daily and weekly planner views.
 */

let currentPlannerTab = 'daily';

/* ------------------------------------------------------------------ */
/*  Init                                                                */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    // Default planner date to today
    const dateInput = document.getElementById('planner-date');
    if (dateInput) dateInput.value = todayStr();
});

/* ------------------------------------------------------------------ */
/*  Tab switching                                                       */
/* ------------------------------------------------------------------ */

function switchPlannerTab(tab, btnEl) {
    currentPlannerTab = tab;

    // Update tab button styles
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    // Show/hide views
    const daily  = document.getElementById('planner-daily');
    const weekly = document.getElementById('planner-weekly');
    if (daily)  daily.style.display  = tab === 'daily'  ? '' : 'none';
    if (weekly) weekly.style.display = tab === 'weekly' ? '' : 'none';

    loadPlannerView();
}

/* ------------------------------------------------------------------ */
/*  Main loader                                                         */
/* ------------------------------------------------------------------ */

async function loadPlannerView() {
    const dateInput = document.getElementById('planner-date');
    const date = dateInput ? dateInput.value : todayStr();

    if (currentPlannerTab === 'daily') {
        await loadDailyView(date);
    } else {
        await loadWeeklyView(date);
    }
}

/* ------------------------------------------------------------------ */
/*  Daily view                                                          */
/* ------------------------------------------------------------------ */

async function loadDailyView(date) {
    const heading  = document.getElementById('daily-heading');
    const timeline = document.getElementById('daily-timeline');
    if (!timeline) return;

    if (heading) heading.textContent = `Schedule for ${formatDate(date)}`;

    try {
        const tasks = await fetchTasksForDate(date);
        timeline.innerHTML = '';

        if (tasks.length === 0) {
            timeline.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>No tasks scheduled for this day.</p></div>`;
            return;
        }

        // Sort by start time
        tasks.sort((a, b) => a.start_time.localeCompare(b.start_time));

        tasks.forEach(task => {
            const color = getSubjectColor(task.subject);
            const bgAlpha = getSubjectColorAlpha(task.subject, task.status ? 0.18 : 0.12);

            const slot = document.createElement('div');
            slot.className = 'timeline-slot';
            slot.innerHTML = `
                <div class="timeline-time">${formatTime(task.start_time)}</div>
                <div class="timeline-bar ${task.status ? 'done' : ''}"
                     onclick="openModal('edit', ${task.id})"
                     title="${escHtml(task.subject)} (${formatTime(task.start_time)} – ${formatTime(task.end_time)})"
                     style="border-left-color:${color}; background:${bgAlpha}; color:${color};">
                    <strong>${escHtml(task.subject)}</strong>
                    <span style="font-size:.78rem; opacity:.8; margin-left:.5rem;">
                        ${formatTime(task.start_time)} – ${formatTime(task.end_time)}
                    </span>
                    ${task.description ? `<div style="font-size:.78rem; opacity:.75; margin-top:.2rem;">${escHtml(task.description)}</div>` : ''}
                </div>
            `;
            timeline.appendChild(slot);
        });
    } catch {
        showToast('Could not load planner.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Weekly view                                                         */
/* ------------------------------------------------------------------ */

async function loadWeeklyView(anchorDate) {
    const grid = document.getElementById('weekly-grid');
    const heading = document.getElementById('weekly-heading');
    if (!grid) return;

    // Compute Monday of the week containing anchorDate
    const anchor = new Date(anchorDate + 'T00:00:00');
    const day    = anchor.getDay(); // 0=Sun
    const diff   = (day === 0) ? -6 : 1 - day;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + diff);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    const startStr = formatDate(weekDates[0]);
    const endStr   = formatDate(weekDates[6]);
    if (heading) heading.textContent = `Week: ${startStr} – ${endStr}`;

    const today = todayStr();
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    grid.innerHTML = '';

    // Fetch tasks for the whole week in parallel
    const tasksByDay = await Promise.all(weekDates.map(d => fetchTasksForDate(d)));

    weekDates.forEach((date, idx) => {
        const col = document.createElement('div');
        col.className = 'weekly-day';

        const header = document.createElement('div');
        header.className = `weekly-day-header${date === today ? ' today' : ''}`;
        header.innerHTML = `${DAY_NAMES[idx]}<br><small>${date.slice(5)}</small>`;

        const tasksDiv = document.createElement('div');
        tasksDiv.className = 'weekly-day-tasks';

        const dayTasks = tasksByDay[idx] || [];
        dayTasks.sort((a, b) => a.start_time.localeCompare(b.start_time));

        if (dayTasks.length === 0) {
            tasksDiv.innerHTML = `<span style="font-size:.72rem; color:var(--text-secondary);">—</span>`;
        } else {
            dayTasks.forEach(task => {
                const chip  = document.createElement('div');
                const color = getSubjectColor(task.subject);
                chip.className   = `weekly-task-chip${task.status ? ' done' : ''}`;
                chip.textContent = task.subject;
                chip.title       = `${task.subject} (${formatTime(task.start_time)} – ${formatTime(task.end_time)})`;
                chip.style.background  = getSubjectColorAlpha(task.subject, task.status ? 0.2 : 0.15);
                chip.style.color       = color;
                chip.style.borderLeft  = `3px solid ${color}`;
                chip.onclick = () => openModal('edit', task.id);
                tasksDiv.appendChild(chip);
            });
        }

        col.appendChild(header);
        col.appendChild(tasksDiv);
        grid.appendChild(col);
    });
}

/* ------------------------------------------------------------------ */
/*  Helper: fetch tasks for a specific date                             */
/* ------------------------------------------------------------------ */

async function fetchTasksForDate(date) {
    const res = await fetch(`/get-tasks?date=${date}`);
    if (!res.ok) return [];
    return res.json();
}
