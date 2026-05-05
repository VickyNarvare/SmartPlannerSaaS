/**
 * utils.js – Shared utility functions used across all pages.
 */

/* ------------------------------------------------------------------ */
/*  Toast notifications                                                 */
/* ------------------------------------------------------------------ */

/**
 * Show a toast notification.
 * @param {string} message  - Text to display.
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - Auto-dismiss delay in ms (default 3000).
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Remove after animation completes
    setTimeout(() => toast.remove(), duration + 400);
}

/* ------------------------------------------------------------------ */
/*  Dark / Light theme toggle                                           */
/* ------------------------------------------------------------------ */

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');

    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}

/** Apply saved theme on page load. */
(function applySavedTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    // Update button icon once DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
    });
})();

/* ------------------------------------------------------------------ */
/*  Sidebar toggle (mobile)                                             */
/* ------------------------------------------------------------------ */

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

/* ------------------------------------------------------------------ */
/*  Date helpers                                                        */
/* ------------------------------------------------------------------ */

/** Return today's date as YYYY-MM-DD string. */
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

/** Format a YYYY-MM-DD string to a human-readable date. */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Format HH:MM to 12-hour time. */
function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

/* ------------------------------------------------------------------ */
/*  View switching                                                       */
/* ------------------------------------------------------------------ */

const VIEW_TITLES = {
    dashboard: 'Dashboard',
    planner:   'Study Planner',
    tasks:     'All Tasks',
    pomodoro:  '⏱️ Pomodoro',
    analytics: '📈 Analytics',
};

function switchView(viewName, linkEl) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show target view
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (linkEl) linkEl.classList.add('active');

    // Update topbar title
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = VIEW_TITLES[viewName] || viewName;

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('open');

    // Trigger view-specific refresh
    if (viewName === 'dashboard' && typeof loadDashboard === 'function') loadDashboard();
    if (viewName === 'planner'   && typeof loadPlannerView === 'function') loadPlannerView();
    if (viewName === 'tasks'     && typeof loadAllTasks === 'function') loadAllTasks();
    if (viewName === 'pomodoro'  && typeof initPomodoro === 'function') initPomodoro();
    if (viewName === 'analytics' && typeof initAnalytics === 'function') initAnalytics();
}

/* ------------------------------------------------------------------ */
/*  Subject Color Coding                                                */
/* ------------------------------------------------------------------ */

/**
 * Predefined palette of 12 distinct colors.
 * Colors are assigned to subjects in order of first appearance
 * and persisted in localStorage under the key 'subject_colors'.
 */
const SUBJECT_COLOR_PALETTE = [
    '#4f6ef7', '#22c55e', '#f59e0b', '#ef4444',
    '#a855f7', '#06b6d4', '#f97316', '#ec4899',
    '#14b8a6', '#8b5cf6', '#84cc16', '#e11d48',
];

/**
 * Return a consistent hex color for a given subject string.
 * Assigns a new palette color on first encounter and saves the mapping.
 * @param {string} subject
 * @returns {string} hex color, e.g. '#4f6ef7'
 */
function getSubjectColor(subject) {
    if (!subject) return SUBJECT_COLOR_PALETTE[0];

    // Load existing map from localStorage
    let map = {};
    try {
        map = JSON.parse(localStorage.getItem('subject_colors') || '{}');
    } catch { map = {}; }

    const key = subject.trim().toLowerCase();

    if (!map[key]) {
        // Assign the next unused palette color (cycle if > 12 subjects)
        const usedCount = Object.keys(map).length;
        map[key] = SUBJECT_COLOR_PALETTE[usedCount % SUBJECT_COLOR_PALETTE.length];
        localStorage.setItem('subject_colors', JSON.stringify(map));
    }

    return map[key];
}

/**
 * Return a CSS rgba() string of the subject color at reduced opacity.
 * Useful for backgrounds.
 * @param {string} subject
 * @param {number} alpha  0–1
 */
function getSubjectColorAlpha(subject, alpha = 0.15) {
    const hex = getSubjectColor(subject).replace('#', '');
    const r   = parseInt(hex.slice(0, 2), 16);
    const g   = parseInt(hex.slice(2, 4), 16);
    const b   = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

/* ------------------------------------------------------------------ */
/*  Close sidebar when clicking outside (mobile)                        */
/* ------------------------------------------------------------------ */
document.addEventListener('click', (e) => {
    const sidebar   = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    if (!sidebar || !hamburger) return;
    if (window.innerWidth > 768) return;
    if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});
