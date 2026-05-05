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
    { id: 'beginner',  icon: '🌱', label: 'Beginner',  desc: 'First task completed',  minStreak: 0,  tasksNeeded: 1  },
    { id: 'on_fire',   icon: '⚡', label: 'On Fire',   desc: '3-day streak',           minStreak: 3,  tasksNeeded: 0  },
    { id: 'champion',  icon: '🏆', label: 'Champion',  desc: '7-day streak',           minStreak: 7,  tasksNeeded: 0  },
    { id: 'legend',    icon: '💎', label: 'Legend',    desc: '30-day streak',          minStreak: 30, tasksNeeded: 0  },
];

/* ------------------------------------------------------------------ */
/*  Streak storage helpers                                              */
/* ------------------------------------------------------------------ */

function loadStreakData() {
    try {
        const raw  = localStorage.getItem('study_streak');
        const data = JSON.parse(raw || 'null') || {};

        /* Migrate / fill missing fields */
        return {
            streak:       data.streak       ?? 0,
            longest:      data.longest      ?? 0,
            lastDate:     data.lastDate     ?? '',
            totalDone:    data.totalDone    ?? 0,
            earnedBadges: data.earnedBadges ?? [],
        };
    } catch {
        return { streak: 0, longest: 0, lastDate: '', totalDone: 0, earnedBadges: [] };
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

        const today     = todayStr();
        const yesterday = offsetDate(today, -1);
        const lastDate  = dates[dates.length - 1];

        /* Streak is dead if the last completed day was before yesterday */
        if (lastDate < yesterday) {
            data.streak   = 0;
            data.lastDate = lastDate;
        } else {
            /*
             * Walk backward from the most recent date, counting
             * consecutive days. Start anchor = lastDate (today or yesterday).
             */
            let streak  = 1;
            let anchor  = lastDate;

            for (let i = dates.length - 2; i >= 0; i--) {
                const expected = offsetDate(anchor, -1);
                if (dates[i] === expected) {
                    streak++;
                    anchor = dates[i];
                } else {
                    break;
                }
            }

            data.streak   = streak;
            data.lastDate = lastDate;
        }

        /* Track longest streak ever */
        if (!data.longest || data.streak > data.longest) {
            data.longest = data.streak;
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
    /* Render cached data instantly (no flicker) */
    renderStreakUI(loadStreakData());

    /* Always fetch fresh — this is the source of truth */
    updateStreak();

    /* Hook into task completion: patch the global toggleTaskStatus */
    const _origToggle = window.toggleTaskStatus;
    if (typeof _origToggle === 'function') {
        window.toggleTaskStatus = async function(taskId, isChecked) {
            await _origToggle(taskId, isChecked);
            /* Recalculate streak whenever a task is checked OR unchecked */
            updateStreak();
        };
    }
});

/* ------------------------------------------------------------------ */
/*  Streak view — full page render                                      */
/* ------------------------------------------------------------------ */

/**
 * Called by switchView('streak').
 * Fetches completed tasks, renders hero, stats, 30-day calendar, badge wall.
 */
async function initStreakView() {
    const data = loadStreakData();

    // Render immediately from cache, then refresh
    renderStreakHero(data);
    renderStreakStats(data);
    renderStreakBadgeWall(data);

    try {
        const res   = await fetch('/get-tasks?status=completed');
        const tasks = await res.json();
        renderStreakCalendar(tasks);
        renderStreakStats({ ...data, activeDays: countActiveDays(tasks) });
    } catch {
        renderStreakCalendar([]);
    }
}

/* ── Hero card ── */
function renderStreakHero(data) {
    const { streak } = data;

    const icon  = document.getElementById('streak-flame-icon');
    const count = document.getElementById('streak-hero-count');
    const label = document.getElementById('streak-hero-label');
    const msg   = document.getElementById('streak-hero-msg');

    if (icon)  icon.textContent  = streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : streak > 0 ? '✨' : '💤';
    if (count) count.textContent = streak;
    if (label) label.textContent = `Day Streak`;

    const messages = [
        [0,  '📚 Complete a task today to start your streak!'],
        [1,  '✨ Great start! Keep going tomorrow.'],
        [3,  '⚡ You\'re on fire! 3 days strong.'],
        [7,  '🏆 One week! You\'re a champion.'],
        [14, '🚀 Two weeks! Unstoppable.'],
        [30, '💎 30 days! Absolute legend.'],
    ];
    let text = messages[0][1];
    for (const [min, m] of messages) { if (streak >= min) text = m; }
    if (msg) msg.textContent = text;
}

/* ── Stats row ── */
function renderStreakStats(data) {
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('sk-current',     data.streak      || 0);
    setText('sk-longest',     data.longest     || data.streak || 0);
    setText('sk-total',       data.totalDone   || 0);
    setText('sk-active-days', data.activeDays  || 0);
}

/* ── 30-day calendar heatmap ── */
function renderStreakCalendar(tasks) {
    const container = document.getElementById('streak-calendar');
    const monthLbl  = document.getElementById('sk-month-label');
    if (!container) return;

    // Build date → count map for last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const countMap = {};
    days.forEach(d => { countMap[d] = 0; });
    tasks.forEach(t => { if (countMap[t.date] !== undefined) countMap[t.date]++; });

    const maxCount = Math.max(...Object.values(countMap), 1);
    const today    = todayStr();

    if (monthLbl) {
        const start = formatDate(days[0]);
        const end   = formatDate(days[days.length - 1]);
        monthLbl.textContent = `${start} – ${end}`;
    }

    container.innerHTML = '';

    days.forEach(date => {
        const count     = countMap[date];
        const intensity = count / maxCount;
        const isToday   = date === today;

        const cell = document.createElement('div');
        cell.className = 'sk-cal-cell';
        cell.title     = `${formatDate(date)}: ${count} task${count !== 1 ? 's' : ''} completed`;

        // Colour: empty = border, filled = orange gradient
        if (count === 0) {
            cell.style.background = 'var(--border)';
        } else {
            const alpha = 0.3 + intensity * 0.7;
            cell.style.background = `rgba(249,115,22,${alpha.toFixed(2)})`;
        }

        if (isToday) cell.classList.add('sk-cal-today');
        if (count > 0) {
            cell.innerHTML = `<span class="sk-cal-count">${count}</span>`;
        }

        container.appendChild(cell);
    });
}

/* ── Badge wall ── */
function renderStreakBadgeWall(data) {
    const wall     = document.getElementById('streak-badge-wall');
    const countLbl = document.getElementById('sk-badge-count');
    if (!wall) return;

    const earned = data.earnedBadges || [];
    if (countLbl) countLbl.textContent = `${earned.length} / ${BADGES.length}`;

    wall.innerHTML = '';
    BADGES.forEach(badge => {
        const isEarned = earned.includes(badge.id);
        const card     = document.createElement('div');
        card.className = `sk-badge-card${isEarned ? ' earned' : ' locked'}`;
        card.innerHTML = `
            <div class="sk-badge-icon">${badge.icon}</div>
            <div class="sk-badge-name">${badge.label}</div>
            <div class="sk-badge-desc">${badge.desc}</div>
            ${isEarned
                ? '<div class="sk-badge-status earned-label">✅ Earned</div>'
                : '<div class="sk-badge-status locked-label">🔒 Locked</div>'}
        `;
        wall.appendChild(card);
    });
}

/* ── Helpers ── */
function countActiveDays(tasks) {
    return new Set(tasks.map(t => t.date)).size;
}
