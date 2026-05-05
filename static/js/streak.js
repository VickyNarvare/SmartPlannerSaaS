/**
 * streak.js
 * Study Streak & Gamification for Smart Study Planner.
 *
 * - Tracks consecutive days with ≥1 completed task
 * - Stores streak data in localStorage (key: study_streak)
 * - Shows 🔥 streak count in sidebar
 * - Badge system: Beginner / On Fire / Champion / Legend
 * - Motivational message on dashboard
 * - Badge popup animation on unlock
 */

/* ------------------------------------------------------------------ */
/*  Badge definitions                                                   */
/* ------------------------------------------------------------------ */
const BADGES = [
    { id: 'beginner',  icon: '🌱', label: 'Beginner',  desc: 'First task completed',    minStreak: 0, tasksNeeded: 1 },
    { id: 'on_fire',   icon: '⚡', label: 'On Fire',   desc: '3-day streak',             minStreak: 3, tasksNeeded: 0 },
    { id: 'champion',  icon: '🏆', label: 'Champion',  desc: '7-day streak',             minStreak: 7, tasksNeeded: 0 },
    { id: 'legend',    icon: '💎', label: 'Legend',    desc: '30-day streak',            minStreak: 30, tasksNeeded: 0 },
];

/* ------------------------------------------------------------------ */
/*  Streak storage helpers                                              */
/* ------------------------------------------------------------------ */

function loadStreakData() {
    try {
        return JSON.parse(localStorage.getItem('study_streak') || 'null') || {
            streak:      0,
            lastDate:    '',
            totalDone:   0,
            earnedBadges: [],
        };
    } catch {
        return { streak: 0, lastDate: '', totalDone: 0, earnedBadges: [] };
    }
}

function saveStreakData(data) {
    localStorage.setItem('study_streak', JSON.stringify(data));
}

/* ------------------------------------------------------------------ */
/*  Core streak update — called after any task is completed            */
/* ------------------------------------------------------------------ */

/**
 * Recalculate streak from the server's completed task list.
 * Fetches all completed tasks, builds a sorted unique-date list,
 * then counts consecutive days ending today.
 */
async function updateStreak() {
    try {
        const res   = await fetch('/get-tasks?status=completed');
        const tasks = await res.json();

        /* Unique completed dates, sorted ascending */
        const dates = [...new Set(tasks.map(t => t.date))].sort();

        const data = loadStreakData();
        data.totalDone = tasks.length;

        if (dates.length === 0) {
            data.streak   = 0;
            data.lastDate = '';
            saveStreakData(data);
            renderStreakUI(data);
            return;
        }

        /* Count consecutive days ending at the most recent date */
        const today     = todayStr();
        const yesterday = offsetDate(today, -1);
        const lastDate  = dates[dates.length - 1];

        /* Streak is only "live" if last completed date is today or yesterday */
        if (lastDate < yesterday) {
            data.streak   = 0;
            data.lastDate = lastDate;
        } else {
            let streak = 1;
            for (let i = dates.length - 2; i >= 0; i--) {
                if (dates[i] === offsetDate(dates[i + 1], -1)) {
                    streak++;
                } else {
                    break;
                }
            }
            data.streak   = streak;
            data.lastDate = lastDate;
        }

        /* Check for newly unlocked badges */
        const newBadges = checkBadges(data);
        saveStreakData(data);
        renderStreakUI(data);

        /* Show popup for each newly unlocked badge */
        newBadges.forEach(b => showBadgePopup(b));

    } catch (err) {
        console.warn('Streak update failed:', err);
    }
}

/* ------------------------------------------------------------------ */
/*  Badge checking                                                      */
/* ------------------------------------------------------------------ */

function checkBadges(data) {
    const newlyEarned = [];
    BADGES.forEach(badge => {
        if (data.earnedBadges.includes(badge.id)) return;

        const streakOk = data.streak >= badge.minStreak;
        const tasksOk  = badge.tasksNeeded === 0 || data.totalDone >= badge.tasksNeeded;

        if (streakOk && tasksOk) {
            data.earnedBadges.push(badge.id);
            newlyEarned.push(badge);
        }
    });
    return newlyEarned;
}

/* ------------------------------------------------------------------ */
/*  UI rendering                                                        */
/* ------------------------------------------------------------------ */

function renderStreakUI(data) {
    renderSidebarStreak(data);
    renderMotivationalMessage(data);
    renderBadgeRow(data);
}

/** Show 🔥 N in the sidebar below the user avatar. */
function renderSidebarStreak(data) {
    const el = document.getElementById('sidebar-streak');
    if (!el) return;
    if (data.streak > 0) {
        el.textContent = `🔥 ${data.streak} day${data.streak > 1 ? 's' : ''}`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

/** Motivational message on the dashboard. */
function renderMotivationalMessage(data) {
    const el = document.getElementById('motivational-msg');
    if (!el) return;

    const { streak, totalDone } = data;
    let msg = '';

    if (totalDone === 0) {
        msg = '👋 Welcome! Add your first task and start studying.';
    } else if (streak === 0) {
        msg = '📚 Complete a task today to start your streak!';
    } else if (streak < 3) {
        msg = `✨ Great start! ${streak} day${streak > 1 ? 's' : ''} in a row. Keep it up!`;
    } else if (streak < 7) {
        msg = `🔥 ${streak} days strong! You're on fire!`;
    } else if (streak < 30) {
        msg = `🏆 ${streak}-day streak! You're a champion!`;
    } else {
        msg = `💎 ${streak} days! Absolute legend. Nothing can stop you!`;
    }

    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

/** Render earned badge chips in the dashboard badge row. */
function renderBadgeRow(data) {
    const container = document.getElementById('badge-row');
    if (!container) return;
    container.innerHTML = '';

    if (data.earnedBadges.length === 0) {
        container.innerHTML = '<span class="badge-empty">Complete tasks to earn badges!</span>';
        return;
    }

    BADGES.forEach(badge => {
        const earned = data.earnedBadges.includes(badge.id);
        const chip   = document.createElement('div');
        chip.className = `badge-chip${earned ? ' earned' : ' locked'}`;
        chip.title     = badge.desc;
        chip.innerHTML = `
            <span class="badge-chip-icon">${badge.icon}</span>
            <span class="badge-chip-label">${badge.label}</span>
            ${!earned ? '<span class="badge-chip-lock">🔒</span>' : ''}
        `;
        container.appendChild(chip);
    });
}

/* ------------------------------------------------------------------ */
/*  Badge popup animation                                               */
/* ------------------------------------------------------------------ */

function showBadgePopup(badge) {
    const popup = document.createElement('div');
    popup.className = 'badge-popup';
    popup.innerHTML = `
        <div class="badge-popup-inner">
            <div class="badge-popup-icon">${badge.icon}</div>
            <div class="badge-popup-text">
                <strong>Badge Unlocked!</strong>
                <span>${badge.label}</span>
                <small>${badge.desc}</small>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    /* Trigger entrance animation */
    requestAnimationFrame(() => popup.classList.add('show'));

    /* Auto-remove after 4 s */
    setTimeout(() => {
        popup.classList.remove('show');
        popup.classList.add('hide');
        setTimeout(() => popup.remove(), 500);
    }, 4000);
}

/* ------------------------------------------------------------------ */
/*  Utility                                                             */
/* ------------------------------------------------------------------ */

/** Return a YYYY-MM-DD string offset by `days` from a given date string. */
function offsetDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                           */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    /* Initial render from cached data (instant, no network) */
    renderStreakUI(loadStreakData());

    /* Then fetch fresh data */
    updateStreak();

    /* Hook into task completion: patch the global toggleTaskStatus */
    const _origToggle = window.toggleTaskStatus;
    if (typeof _origToggle === 'function') {
        window.toggleTaskStatus = async function(taskId, isChecked) {
            await _origToggle(taskId, isChecked);
            if (isChecked) updateStreak();
        };
    }
});
