/**
 * analytics.js
 * Study Analytics for Smart Study Planner.
 *
 * Features:
 *  - Bar chart  : subject-wise total study hours (Canvas API)
 *  - Heatmap    : last 7 days task completion intensity (Canvas API)
 *  - Summary    : most studied subject, weekly hours, best day
 *
 * Zero external libraries — pure Canvas 2D API.
 */

/* ------------------------------------------------------------------ */
/*  Entry point — called by switchView('analytics')                    */
/* ------------------------------------------------------------------ */
async function initAnalytics() {
    try {
        const tasks = await fetchAllTasksForAnalytics();
        renderAnalyticsSummary(tasks);
        renderBarChart(tasks);
        renderHeatmap(tasks);
    } catch (err) {
        console.error('Analytics error:', err);
        showToast('Could not load analytics data.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Data fetch                                                          */
/* ------------------------------------------------------------------ */
async function fetchAllTasksForAnalytics() {
    const res = await fetch('/get-tasks');
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
}

/* ------------------------------------------------------------------ */
/*  Summary cards                                                       */
/* ------------------------------------------------------------------ */
function renderAnalyticsSummary(tasks) {
    const completed = tasks.filter(t => t.status === 1);

    /* ── Total study hours this week ── */
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    let weeklyMinutes = 0;
    const dayCount = {};   // date → completed count

    completed.forEach(t => {
        const mins = timeToMinutes(t.end_time) - timeToMinutes(t.start_time);
        if (t.date >= weekAgoStr) {
            weeklyMinutes += Math.max(0, mins);
            dayCount[t.date] = (dayCount[t.date] || 0) + 1;
        }
    });

    const weeklyHours = (weeklyMinutes / 60).toFixed(1);

    /* ── Best day ── */
    let bestDay = '—', bestCount = 0;
    Object.entries(dayCount).forEach(([d, c]) => {
        if (c > bestCount) { bestCount = c; bestDay = formatDate(d); }
    });

    /* ── Most studied subject ── */
    const subjectMins = {};
    completed.forEach(t => {
        const mins = Math.max(0, timeToMinutes(t.end_time) - timeToMinutes(t.start_time));
        subjectMins[t.subject] = (subjectMins[t.subject] || 0) + mins;
    });
    let topSubject = '—';
    let topMins    = 0;
    Object.entries(subjectMins).forEach(([s, m]) => {
        if (m > topMins) { topMins = m; topSubject = s; }
    });

    setText('an-weekly-hours',  `${weeklyHours}h`);
    setText('an-best-day',      bestDay);
    setText('an-top-subject',   topSubject);
}

/* ------------------------------------------------------------------ */
/*  Bar Chart — subject-wise total study hours                          */
/* ------------------------------------------------------------------ */
function renderBarChart(tasks) {
    const canvas = document.getElementById('bar-chart-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    /* Aggregate minutes per subject (completed tasks only) */
    const subjectMins = {};
    tasks.filter(t => t.status === 1).forEach(t => {
        const mins = Math.max(0, timeToMinutes(t.end_time) - timeToMinutes(t.start_time));
        subjectMins[t.subject] = (subjectMins[t.subject] || 0) + mins;
    });

    const entries = Object.entries(subjectMins)
        .map(([s, m]) => ({ subject: s, hours: +(m / 60).toFixed(2) }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8);   // max 8 bars

    if (entries.length === 0) {
        drawEmptyState(ctx, canvas, 'No completed tasks yet.');
        return;
    }

    /* Responsive canvas size */
    const dpr    = window.devicePixelRatio || 1;
    const W      = canvas.offsetWidth  || 600;
    const H      = canvas.offsetHeight || 280;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const PAD_L = 52, PAD_R = 20, PAD_T = 24, PAD_B = 56;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const maxHours = Math.max(...entries.map(e => e.hours));
    const yMax     = Math.ceil(maxHours * 1.15) || 1;

    /* Resolve CSS variables for colours */
    const style    = getComputedStyle(document.documentElement);
    const accent   = style.getPropertyValue('--accent').trim()         || '#4f6ef7';
    const textSec  = style.getPropertyValue('--text-secondary').trim() || '#5a6282';
    const border   = style.getPropertyValue('--border').trim()         || '#e2e8f0';

    /* Clear */
    ctx.clearRect(0, 0, W, H);

    /* Grid lines */
    const gridLines = 4;
    ctx.strokeStyle = border;
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= gridLines; i++) {
        const y = PAD_T + chartH - (i / gridLines) * chartH;
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(PAD_L + chartW, y);
        ctx.stroke();

        /* Y-axis labels */
        ctx.fillStyle  = textSec;
        ctx.font       = `11px Inter, sans-serif`;
        ctx.textAlign  = 'right';
        ctx.fillText(`${((i / gridLines) * yMax).toFixed(1)}h`, PAD_L - 6, y + 4);
    }
    ctx.setLineDash([]);

    /* Bars */
    const barW   = Math.min(48, (chartW / entries.length) * 0.6);
    const gap    = chartW / entries.length;

    entries.forEach((e, i) => {
        const barH  = (e.hours / yMax) * chartH;
        const x     = PAD_L + gap * i + (gap - barW) / 2;
        const y     = PAD_T + chartH - barH;

        /* Bar gradient */
        const grad = ctx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, accent + '88');
        ctx.fillStyle = grad;

        /* Rounded top corners */
        const r = Math.min(6, barW / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, y + barH);
        ctx.lineTo(x, y + barH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();

        /* Value label on top */
        ctx.fillStyle  = accent;
        ctx.font       = `bold 11px Inter, sans-serif`;
        ctx.textAlign  = 'center';
        ctx.fillText(`${e.hours}h`, x + barW / 2, y - 6);

        /* Subject label below */
        ctx.fillStyle  = textSec;
        ctx.font       = `11px Inter, sans-serif`;
        ctx.textAlign  = 'center';
        /* Truncate long names */
        const label = e.subject.length > 9 ? e.subject.slice(0, 8) + '…' : e.subject;
        ctx.fillText(label, x + barW / 2, PAD_T + chartH + 18);
    });

    /* X-axis line */
    ctx.strokeStyle = border;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD_L, PAD_T + chartH);
    ctx.lineTo(PAD_L + chartW, PAD_T + chartH);
    ctx.stroke();
}

/* ------------------------------------------------------------------ */
/*  Heatmap — last 7 days                                               */
/* ------------------------------------------------------------------ */
function renderHeatmap(tasks) {
    const canvas = document.getElementById('heatmap-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    /* Build date → completed count map for last 7 days */
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const countMap = {};
    days.forEach(d => { countMap[d] = 0; });
    tasks.filter(t => t.status === 1 && countMap[t.date] !== undefined)
         .forEach(t => { countMap[t.date]++; });

    const maxCount = Math.max(...Object.values(countMap), 1);

    /* Canvas sizing */
    const dpr  = window.devicePixelRatio || 1;
    const W    = canvas.offsetWidth  || 500;
    const H    = canvas.offsetHeight || 100;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const style   = getComputedStyle(document.documentElement);
    const accent  = style.getPropertyValue('--accent').trim()         || '#4f6ef7';
    const textSec = style.getPropertyValue('--text-secondary').trim() || '#5a6282';
    const border  = style.getPropertyValue('--border').trim()         || '#e2e8f0';

    ctx.clearRect(0, 0, W, H);

    const cellSize = Math.min(Math.floor((W - 16) / 7) - 6, 52);
    const totalW   = days.length * (cellSize + 6) - 6;
    const startX   = (W - totalW) / 2;
    const cellY    = 14;

    days.forEach((date, i) => {
        const count    = countMap[date];
        const intensity = count / maxCount;          // 0 – 1
        const x        = startX + i * (cellSize + 6);

        /* Cell background — interpolate from border to accent */
        ctx.fillStyle = count === 0 ? border : blendColor(accent, intensity);
        roundRect(ctx, x, cellY, cellSize, cellSize, 6);
        ctx.fill();

        /* Count number inside cell */
        if (count > 0) {
            ctx.fillStyle  = '#fff';
            ctx.font       = `bold ${Math.max(11, cellSize * 0.28)}px Inter, sans-serif`;
            ctx.textAlign  = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(count, x + cellSize / 2, cellY + cellSize / 2);
        }

        /* Day label below */
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const d        = new Date(date + 'T00:00:00');
        ctx.fillStyle    = textSec;
        ctx.font         = `11px Inter, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(dayNames[d.getDay()], x + cellSize / 2, cellY + cellSize + 16);
    });
}

/* ------------------------------------------------------------------ */
/*  Canvas helpers                                                      */
/* ------------------------------------------------------------------ */

/** Draw a rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Blend a hex colour toward white based on intensity (0=light, 1=full colour).
 * Used for heatmap cell shading.
 */
function blendColor(hex, intensity) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const minI = 0.25;
    const t    = minI + intensity * (1 - minI);
    const mix  = (c) => Math.round(255 + (c - 255) * t);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/** Draw a centred "no data" message on a canvas. */
function drawEmptyState(ctx, canvas, msg) {
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || 600;
    const H   = canvas.offsetHeight || 280;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const style   = getComputedStyle(document.documentElement);
    const textSec = style.getPropertyValue('--text-secondary').trim() || '#5a6282';
    ctx.fillStyle    = textSec;
    ctx.font         = '14px Inter, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, W / 2, H / 2);
}

/* ------------------------------------------------------------------ */
/*  Utility                                                             */
/* ------------------------------------------------------------------ */

/** "HH:MM" → total minutes since midnight. */
function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* Re-render charts when window resizes (debounced). */
let _analyticsResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(_analyticsResizeTimer);
    _analyticsResizeTimer = setTimeout(() => {
        const view = document.getElementById('view-analytics');
        if (view && view.classList.contains('active')) initAnalytics();
    }, 250);
});
