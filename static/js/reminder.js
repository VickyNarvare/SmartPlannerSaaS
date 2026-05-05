/**
 * reminder.js
 * Polls the current time every 30 seconds and fires a browser notification
 * (or toast fallback) when a task's start time matches the current time.
 */

// Track which task IDs have already been notified in this session
const notifiedTasks = new Set();

/**
 * Check all tasks and fire reminders for any whose start time
 * matches the current HH:MM and whose date is today.
 */
async function checkReminders() {
    const now   = new Date();
    const today = now.toISOString().split('T')[0];
    const hh    = String(now.getHours()).padStart(2, '0');
    const mm    = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;

    let tasks = [];
    try {
        const res = await fetch(`/get-tasks?date=${today}&status=pending`);
        if (!res.ok) return;
        tasks = await res.json();
    } catch {
        return; // silently ignore network errors in reminder polling
    }

    tasks.forEach(task => {
        // Only notify once per task per session
        if (notifiedTasks.has(task.id)) return;

        // Match HH:MM (ignore seconds)
        const taskTime = task.start_time.slice(0, 5);
        if (taskTime === currentTime) {
            notifiedTasks.add(task.id);
            fireReminder(task);
        }
    });
}

/**
 * Fire a reminder for a task.
 * Tries the Notifications API first; falls back to a toast + alert.
 * @param {Object} task
 */
function fireReminder(task) {
    const msg = `⏰ Time to study: ${task.subject} (${formatTime(task.start_time)} – ${formatTime(task.end_time)})`;

    // Try browser Notification API
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('📚 Study Reminder', { body: msg, icon: '/static/favicon.ico' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                    new Notification('📚 Study Reminder', { body: msg });
                } else {
                    // Fallback: toast + alert
                    showToast(msg, 'warning', 6000);
                    alert(msg);
                }
            });
            return;
        }
    }

    // Fallback: always show a toast
    showToast(msg, 'warning', 6000);
}

/* ------------------------------------------------------------------ */
/*  Request notification permission on page load                        */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
    if ('Notification' in window && Notification.permission === 'default') {
        // Delay the permission request slightly so it doesn't feel intrusive
        setTimeout(() => {
            Notification.requestPermission();
        }, 3000);
    }

    // Run immediately, then every 30 seconds
    checkReminders();
    setInterval(checkReminders, 30_000);
});
