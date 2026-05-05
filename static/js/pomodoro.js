/**
 * pomodoro.js
 * Pomodoro Timer for Smart Study Planner.
 *
 * Modes   : Focus (25 min) → Short Break (5 min) → every 4th → Long Break (15 min)
 * Storage : pomodoro counts per task saved in localStorage
 * Alarm   : Web Audio API (no external files)
 * Notifs  : reuses browser Notification API from reminder.js
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */
const POMO_DURATIONS = {
    focus:  25 * 60,   // seconds
    short:   5 * 60,
    long:   15 * 60,
};

const POMO_COLORS = {
    focus: 'var(--accent)',       // blue
    short: 'var(--success)',      // green
    long:  '#a855f7',             // purple
};

const POMO_LABELS = {
    focus: 'Focus',
    short: 'Short Break',
    long:  'Long Break',
};

/* SVG circle geometry */
const RADIUS      = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;   // ≈ 565.5

/* ------------------------------------------------------------------ */
/*  State                                                               */
/* ------------------------------------------------------------------ */
let pomoMode        = 'focus';   // 'focus' | 'short' | 'long'
let pomoTimeLeft    = POMO_DURATIONS.focus;
let pomoRunning     = false;
let pomoInterval    = null;
let pomoRound       = 0;         // completed focus rounds in this session
let pomoSelectedTask = null;     // { id, subject } | null

/* ------------------------------------------------------------------ */
/*  Init – called when the Pomodoro view becomes active                 */
/* ------------------------------------------------------------------ */
function initPomodoro() {
    renderTimerFace();
    updateModeUI();
    populateTaskSelector();
    renderTomatoCount();
}

/* ------------------------------------------------------------------ */
/*  Timer controls                                                      */
/* ------------------------------------------------------------------ */

/** Start or resume the timer. */
function pomoStart() {
    if (pomoRunning) return;
    pomoRunning = true;
    updateControlButtons();

    pomoInterval = setInterval(() => {
        if (pomoTimeLeft <= 0) {
            clearInterval(pomoInterval);
            pomoRunning = false;
            onTimerEnd();
            return;
        }
        pomoTimeLeft--;
        renderTimerFace();
    }, 1000);
}

/** Pause the timer. */
function pomoPause() {
    if (!pomoRunning) return;
    pomoRunning = false;
    clearInterval(pomoInterval);
    updateControlButtons();
}

/** Reset to the start of the current mode. */
function pomoReset() {
    pomoPause();
    pomoTimeLeft = POMO_DURATIONS[pomoMode];
    renderTimerFace();
    updateControlButtons();
}

/** Switch to a mode tab (focus / short / long). */
function switchPomodoroMode(mode, btnEl) {
    pomoPause();
    pomoMode     = mode;
    pomoTimeLeft = POMO_DURATIONS[mode];

    // Update tab buttons
    document.querySelectorAll('.pomo-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    updateModeUI();
    renderTimerFace();
    updateControlButtons();
}

/* ------------------------------------------------------------------ */
/*  Timer end handler                                                   */
/* ------------------------------------------------------------------ */
function onTimerEnd() {
    playAlarm();

    if (pomoMode === 'focus') {
        pomoRound++;

        // Save count for selected task
        if (pomoSelectedTask) {
            const key   = `pomo_${pomoSelectedTask.id}`;
            const saved = parseInt(localStorage.getItem(key) || '0', 10);
            localStorage.setItem(key, saved + 1);
            renderTomatoCount();
        }

        const msg = pomoRound % 4 === 0
            ? `🎉 4 Pomodoros done! Time for a long break.`
            : `✅ Focus session done! Take a short break.`;

        showToast(msg, 'success', 5000);
        firePomoNotification(msg);

        // Auto-switch to appropriate break
        const nextMode = (pomoRound % 4 === 0) ? 'long' : 'short';
        autoSwitchMode(nextMode);

    } else {
        // Break ended → back to focus
        const msg = '💪 Break over! Ready to focus?';
        showToast(msg, 'info', 4000);
        firePomoNotification(msg);
        autoSwitchMode('focus');
    }
}

/** Switch mode and auto-start after a short delay. */
function autoSwitchMode(mode) {
    pomoMode     = mode;
    pomoTimeLeft = POMO_DURATIONS[mode];

    // Sync tab button UI
    document.querySelectorAll('.pomo-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    updateModeUI();
    renderTimerFace();
    updateControlButtons();

    // Auto-start the next phase after 1.5 s
    setTimeout(() => pomoStart(), 1500);
}

/* ------------------------------------------------------------------ */
/*  Render helpers                                                      */
/* ------------------------------------------------------------------ */

/** Redraw the SVG ring and the MM:SS text. */
function renderTimerFace() {
    const total    = POMO_DURATIONS[pomoMode];
    const fraction = pomoTimeLeft / total;
    const offset   = CIRCUMFERENCE * (1 - fraction);

    const ring = document.getElementById('pomo-ring');
    const text = document.getElementById('pomo-time-text');
    if (ring) {
        ring.style.strokeDashoffset = offset;
        ring.style.stroke           = POMO_COLORS[pomoMode];
    }
    if (text) text.textContent = formatSeconds(pomoTimeLeft);

    // Update page title so user can see timer in browser tab
    document.title = `${formatSeconds(pomoTimeLeft)} – ${POMO_LABELS[pomoMode]} | Study Planner`;
}

/** Update the mode label and ring colour. */
function updateModeUI() {
    const label = document.getElementById('pomo-mode-label');
    if (label) {
        label.textContent = POMO_LABELS[pomoMode];
        label.style.color = POMO_COLORS[pomoMode];
    }

    // Ring track colour hint
    const track = document.getElementById('pomo-track');
    if (track) track.style.stroke = POMO_COLORS[pomoMode] + '33'; // 20% opacity
}

/** Toggle Start / Pause button visibility. */
function updateControlButtons() {
    const startBtn = document.getElementById('pomo-start-btn');
    const pauseBtn = document.getElementById('pomo-pause-btn');
    if (startBtn) startBtn.style.display = pomoRunning ? 'none' : 'inline-flex';
    if (pauseBtn) pauseBtn.style.display = pomoRunning ? 'inline-flex' : 'none';
}

/** Render 🍅 emojis for the selected task's saved count. */
function renderTomatoCount() {
    const wrap = document.getElementById('pomo-tomatoes');
    if (!wrap) return;

    let count = 0;
    if (pomoSelectedTask) {
        count = parseInt(localStorage.getItem(`pomo_${pomoSelectedTask.id}`) || '0', 10);
    }

    wrap.innerHTML = count === 0
        ? '<span style="color:var(--text-secondary);font-size:.85rem;">No Pomodoros yet for this task.</span>'
        : '🍅'.repeat(count) + `<span class="pomo-count-label">${count} Pomodoro${count > 1 ? 's' : ''}</span>`;
}

/* ------------------------------------------------------------------ */
/*  Task selector                                                       */
/* ------------------------------------------------------------------ */

async function populateTaskSelector() {
    const select = document.getElementById('pomo-task-select');
    if (!select) return;

    select.innerHTML = '<option value="">— No task selected —</option>';

    try {
        const res   = await fetch(`/get-tasks?date=${todayStr()}&status=pending`);
        const tasks = await res.json();

        if (tasks.length === 0) {
            select.innerHTML += '<option disabled>No pending tasks today</option>';
            return;
        }

        tasks.forEach(t => {
            const opt   = document.createElement('option');
            opt.value   = t.id;
            opt.textContent = `${t.subject} (${formatTime(t.start_time)} – ${formatTime(t.end_time)})`;
            select.appendChild(opt);
        });
    } catch {
        // silently fail — task selector is optional
    }
}

function onTaskSelected(selectEl) {
    const id = parseInt(selectEl.value, 10);
    if (!id) {
        pomoSelectedTask = null;
    } else {
        const opt = selectEl.options[selectEl.selectedIndex];
        pomoSelectedTask = { id, subject: opt.textContent };
    }
    renderTomatoCount();
}

/* ------------------------------------------------------------------ */
/*  Web Audio alarm (no external files)                                 */
/* ------------------------------------------------------------------ */
function playAlarm() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.4, 0.8].forEach(delay => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(1, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.3);
        });
    } catch (e) {
        console.warn('Web Audio API not available:', e);
    }
}

/* ------------------------------------------------------------------ */
/*  Browser notification (reuses Notification API)                      */
/* ------------------------------------------------------------------ */
function firePomoNotification(message) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification('📚 Pomodoro Timer', { body: message });
    }
}

/* ------------------------------------------------------------------ */
/*  Utility                                                             */
/* ------------------------------------------------------------------ */

/** Convert total seconds → "MM:SS" string. */
function formatSeconds(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
