/**
 * pomodoro.js  — Smart Study Planner
 *
 * Modes   : Focus 25m | Short Break 5m | Long Break 15m | Custom (any MM:SS)
 * Auto    : after 4 focus rounds → long break
 * Alarm   : Web Audio API triple-beep at 880 Hz
 * Storage : pomodoro count per task in localStorage
 */

/* ------------------------------------------------------------------ */
/*  Config                                                              */
/* ------------------------------------------------------------------ */
const POMO_DURATIONS = {
    focus:  25 * 60,
    short:   5 * 60,
    long:   15 * 60,
    custom: 25 * 60,   // overwritten when user presses Set
};

const POMO_COLORS = {
    focus:  'var(--accent)',   // blue
    short:  'var(--success)',  // green
    long:   '#a855f7',         // purple
    custom: '#f97316',         // orange
};

const POMO_LABELS = {
    focus:  'Focus',
    short:  'Short Break',
    long:   'Long Break',
    custom: 'Custom Timer',
};

const RADIUS       = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;  // ≈ 565.49

/* ------------------------------------------------------------------ */
/*  State                                                               */
/* ------------------------------------------------------------------ */
let pomoMode         = 'focus';
let pomoTimeLeft     = POMO_DURATIONS.focus;
let pomoRunning      = false;
let pomoInterval     = null;
let pomoRound        = 0;
let pomoSelectedTask = null;

/* ------------------------------------------------------------------ */
/*  Init — called by switchView('pomodoro')                            */
/* ------------------------------------------------------------------ */
function initPomodoro() {
    renderTimerFace();
    updateModeUI();
    populateTaskSelector();
    renderTomatoCount();
}

/* ------------------------------------------------------------------ */
/*  Mode switching                                                      */
/* ------------------------------------------------------------------ */
function switchPomodoroMode(mode, btnEl) {
    pomoPause();
    pomoMode     = mode;
    pomoTimeLeft = POMO_DURATIONS[mode];

    // Highlight active tab
    document.querySelectorAll('.pomo-tab').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    // Show custom input panel only in custom mode
    const panel = document.getElementById('custom-timer-inputs');
    if (panel) panel.style.display = (mode === 'custom') ? 'flex' : 'none';

    // Pre-fill inputs when entering custom mode
    if (mode === 'custom') syncCustomInputs(POMO_DURATIONS.custom);

    updateModeUI();
    renderTimerFace();
    updateControlButtons();
}

/* ------------------------------------------------------------------ */
/*  Timer controls                                                      */
/* ------------------------------------------------------------------ */
function pomoStart() {
    if (pomoRunning) return;

    // Custom mode: commit input values before starting
    if (pomoMode === 'custom') {
        const ok = applyCustomTimer();
        if (!ok) return;
    }

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

function pomoPause() {
    if (!pomoRunning) return;
    pomoRunning = false;
    clearInterval(pomoInterval);
    updateControlButtons();
}

function pomoReset() {
    pomoPause();
    pomoTimeLeft = POMO_DURATIONS[pomoMode];
    if (pomoMode === 'custom') syncCustomInputs(POMO_DURATIONS.custom);
    renderTimerFace();
    updateControlButtons();
}

/* ------------------------------------------------------------------ */
/*  Custom timer                                                        */
/* ------------------------------------------------------------------ */

/**
 * Read MM:SS inputs, validate, commit to state.
 * Returns true on success, false on invalid input.
 */
function applyCustomTimer() {
    if (pomoRunning) return false;

    const mEl = document.getElementById('custom-minutes');
    const sEl = document.getElementById('custom-seconds');
    if (!mEl || !sEl) return false;

    const mins  = Math.max(0, Math.min(99, parseInt(mEl.value) || 0));
    const secs  = Math.max(0, Math.min(59, parseInt(sEl.value) || 0));
    const total = mins * 60 + secs;

    if (total <= 0) {
        showToast('Please set a duration greater than 0.', 'warning');
        return false;
    }

    // Clamp displayed values
    mEl.value = mins;
    sEl.value = String(secs).padStart(2, '0');

    POMO_DURATIONS.custom = total;
    pomoTimeLeft          = total;
    renderTimerFace();
    showToast(`Custom timer set to ${formatSeconds(total)} ⏱️`, 'info', 2000);
    return true;
}

/** Live ring preview while user types — does not commit. */
function onCustomInputChange() {
    if (pomoRunning) return;
    const mEl = document.getElementById('custom-minutes');
    const sEl = document.getElementById('custom-seconds');
    if (!mEl || !sEl) return;

    const total = (parseInt(mEl.value) || 0) * 60 + Math.min(59, parseInt(sEl.value) || 0);

    const text = document.getElementById('pomo-time-text');
    if (text) text.textContent = formatSeconds(total);

    // Keep ring full while editing
    const ring = document.getElementById('pomo-ring');
    if (ring) {
        ring.style.strokeDashoffset = 0;
        ring.style.stroke = POMO_COLORS.custom;
    }
}

/** Sync the number inputs to match a given total-seconds value. */
function syncCustomInputs(totalSecs) {
    const mEl = document.getElementById('custom-minutes');
    const sEl = document.getElementById('custom-seconds');
    if (!mEl || !sEl) return;
    mEl.value = Math.floor(totalSecs / 60);
    sEl.value = String(totalSecs % 60).padStart(2, '0');
}

/* ------------------------------------------------------------------ */
/*  Timer end                                                           */
/* ------------------------------------------------------------------ */
function onTimerEnd() {
    playAlarm();

    if (pomoMode === 'focus') {
        pomoRound++;

        if (pomoSelectedTask) {
            const key = `pomo_${pomoSelectedTask.id}`;
            localStorage.setItem(key, (parseInt(localStorage.getItem(key) || '0', 10) + 1));
            renderTomatoCount();
        }

        const msg = pomoRound % 4 === 0
            ? '🎉 4 Pomodoros done! Time for a long break.'
            : '✅ Focus session done! Take a short break.';
        showToast(msg, 'success', 5000);
        firePomoNotification(msg);
        autoSwitchMode(pomoRound % 4 === 0 ? 'long' : 'short');

    } else if (pomoMode === 'custom') {
        const msg = '⏱️ Custom timer finished!';
        showToast(msg, 'success', 4000);
        firePomoNotification(msg);
        // Stay in custom mode, reset to same duration
        pomoTimeLeft = POMO_DURATIONS.custom;
        renderTimerFace();
        updateControlButtons();

    } else {
        // break ended → back to focus
        const msg = '💪 Break over! Ready to focus?';
        showToast(msg, 'info', 4000);
        firePomoNotification(msg);
        autoSwitchMode('focus');
    }
}

function autoSwitchMode(mode) {
    pomoMode     = mode;
    pomoTimeLeft = POMO_DURATIONS[mode];

    document.querySelectorAll('.pomo-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    const panel = document.getElementById('custom-timer-inputs');
    if (panel) panel.style.display = (mode === 'custom') ? 'flex' : 'none';

    updateModeUI();
    renderTimerFace();
    updateControlButtons();
    setTimeout(pomoStart, 1500);
}

/* ------------------------------------------------------------------ */
/*  Render                                                              */
/* ------------------------------------------------------------------ */
function renderTimerFace() {
    const total    = POMO_DURATIONS[pomoMode] || 1;
    const fraction = pomoTimeLeft / total;
    const offset   = CIRCUMFERENCE * (1 - fraction);

    const ring = document.getElementById('pomo-ring');
    const text = document.getElementById('pomo-time-text');

    if (ring) {
        ring.style.strokeDashoffset = offset;
        ring.style.stroke           = POMO_COLORS[pomoMode];
    }
    if (text) text.textContent = formatSeconds(pomoTimeLeft);

    document.title = `${formatSeconds(pomoTimeLeft)} – ${POMO_LABELS[pomoMode]} | Study Planner`;
}

function updateModeUI() {
    const label = document.getElementById('pomo-mode-label');
    if (label) {
        label.textContent = POMO_LABELS[pomoMode];
        label.style.color = POMO_COLORS[pomoMode];
    }
    const track = document.getElementById('pomo-track');
    if (track) track.style.stroke = POMO_COLORS[pomoMode] + '33';
}

function updateControlButtons() {
    const startBtn = document.getElementById('pomo-start-btn');
    const pauseBtn = document.getElementById('pomo-pause-btn');
    if (startBtn) startBtn.style.display = pomoRunning ? 'none'        : 'inline-flex';
    if (pauseBtn) pauseBtn.style.display = pomoRunning ? 'inline-flex' : 'none';
}

function renderTomatoCount() {
    const wrap = document.getElementById('pomo-tomatoes');
    if (!wrap) return;

    const count = pomoSelectedTask
        ? parseInt(localStorage.getItem(`pomo_${pomoSelectedTask.id}`) || '0', 10)
        : 0;

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
        const tasks = await (await fetch(`/get-tasks?date=${todayStr()}&status=pending`)).json();
        if (!tasks.length) {
            select.innerHTML += '<option disabled>No pending tasks today</option>';
            return;
        }
        tasks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.subject} (${formatTime(t.start_time)} – ${formatTime(t.end_time)})`;
            select.appendChild(opt);
        });
    } catch { /* silently ignore */ }
}

function onTaskSelected(selectEl) {
    const id = parseInt(selectEl.value, 10);
    pomoSelectedTask = id
        ? { id, subject: selectEl.options[selectEl.selectedIndex].textContent }
        : null;
    renderTomatoCount();
}

/* ------------------------------------------------------------------ */
/*  Web Audio alarm                                                     */
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
/*  Browser notification                                                */
/* ------------------------------------------------------------------ */
function firePomoNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('📚 Pomodoro Timer', { body: message });
    }
}

/* ------------------------------------------------------------------ */
/*  Utility                                                             */
/* ------------------------------------------------------------------ */
function formatSeconds(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
