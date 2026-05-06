"""
Smart Study Planner - Vercel Entry Point
All application code lives here so Vercel can find it without any
cross-directory import tricks.
"""

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import sqlite3
import os
import re
from functools import wraps

# Load .env (useful for local dev; on Vercel env vars are set in the dashboard)
load_dotenv()

# Point templates and static folders to the project root (one level up from api/)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(
    __name__,
    template_folder=os.path.join(ROOT, 'templates'),
    static_folder=os.path.join(ROOT, 'static'),
)

_secret_key = os.environ.get('SECRET_KEY')
if not _secret_key:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Set it in the Vercel dashboard under Project → Settings → Environment Variables."
    )
app.secret_key = _secret_key

# On Vercel only /tmp is writable; fall back to local path for development
DATABASE = '/tmp/study_planner.db' if os.environ.get('VERCEL') else os.path.join(ROOT, 'study_planner.db')


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT    NOT NULL UNIQUE,
                email    TEXT    NOT NULL UNIQUE,
                password TEXT    NOT NULL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL,
                subject     TEXT    NOT NULL,
                date        TEXT    NOT NULL,
                start_time  TEXT    NOT NULL,
                end_time    TEXT    NOT NULL,
                description TEXT,
                status      INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        conn.commit()


init_db()


# ---------------------------------------------------------------------------
# Auth decorator
# ---------------------------------------------------------------------------

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email    = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()

        if not username or not email or not password:
            return render_template('register.html', error='All fields are required.')

        if len(password) < 6:
            return render_template('register.html', error='Password must be at least 6 characters.')
        if not re.search(r'[a-zA-Z]', password):
            return render_template('register.html', error='Password must contain at least one letter.')
        if not re.search(r'[0-9]', password):
            return render_template('register.html', error='Password must contain at least one number.')

        hashed = generate_password_hash(password)
        try:
            with get_db() as conn:
                conn.execute(
                    'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                    (username, email, hashed)
                )
                conn.commit()
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            return render_template('register.html', error='Username or email already exists.')

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        with get_db() as conn:
            user = conn.execute(
                'SELECT * FROM users WHERE username = ?', (username,)
            ).fetchone()

        if user and check_password_hash(user['password'], password):
            session['user_id']  = user['id']
            session['username'] = user['username']
            return redirect(url_for('dashboard'))

        return render_template('login.html', error='Invalid username or password.')

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', username=session['username'])


# ---------------------------------------------------------------------------
# Task API routes (JSON)
# ---------------------------------------------------------------------------

@app.route('/get-tasks')
@login_required
def get_tasks():
    user_id    = session['user_id']
    date       = request.args.get('date', '')
    subject    = request.args.get('subject', '').strip()
    status_arg = request.args.get('status', '')

    query  = 'SELECT * FROM tasks WHERE user_id = ?'
    params = [user_id]

    if date:
        query += ' AND date = ?'
        params.append(date)
    if subject:
        query += ' AND LOWER(subject) LIKE ?'
        params.append(f'%{subject.lower()}%')
    if status_arg == 'completed':
        query += ' AND status = 1'
    elif status_arg == 'pending':
        query += ' AND status = 0'

    query += ' ORDER BY date, start_time'

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return jsonify([dict(row) for row in rows])


@app.route('/add-task', methods=['POST'])
@login_required
def add_task():
    data        = request.get_json()
    user_id     = session['user_id']
    subject     = data.get('subject', '').strip()
    date        = data.get('date', '').strip()
    start_time  = data.get('start_time', '').strip()
    end_time    = data.get('end_time', '').strip()
    description = data.get('description', '').strip()

    if not subject or not date or not start_time or not end_time:
        return jsonify({'success': False, 'message': 'All required fields must be filled.'}), 400

    if start_time >= end_time:
        return jsonify({'success': False, 'message': 'End time must be after start time.'}), 400

    with get_db() as conn:
        overlapping = conn.execute('''
            SELECT id FROM tasks
            WHERE user_id = ? AND date = ?
              AND status != -1
              AND start_time < ? AND end_time > ?
        ''', (user_id, date, end_time, start_time)).fetchone()

        if overlapping:
            return jsonify({'success': False, 'message': 'This time slot overlaps with an existing task.'}), 409

        conn.execute('''
            INSERT INTO tasks (user_id, subject, date, start_time, end_time, description, status)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        ''', (user_id, subject, date, start_time, end_time, description))
        conn.commit()

    return jsonify({'success': True, 'message': 'Task added successfully.'})


@app.route('/update-task', methods=['POST'])
@login_required
def update_task():
    data    = request.get_json()
    task_id = data.get('id')
    user_id = session['user_id']

    if 'status' in data and len(data) == 2:
        with get_db() as conn:
            conn.execute(
                'UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?',
                (int(data['status']), task_id, user_id)
            )
            conn.commit()
        return jsonify({'success': True, 'message': 'Status updated.'})

    subject     = data.get('subject', '').strip()
    date        = data.get('date', '').strip()
    start_time  = data.get('start_time', '').strip()
    end_time    = data.get('end_time', '').strip()
    description = data.get('description', '').strip()

    if not subject or not date or not start_time or not end_time:
        return jsonify({'success': False, 'message': 'All required fields must be filled.'}), 400

    if start_time >= end_time:
        return jsonify({'success': False, 'message': 'End time must be after start time.'}), 400

    with get_db() as conn:
        overlapping = conn.execute('''
            SELECT id FROM tasks
            WHERE user_id = ? AND date = ? AND id != ?
              AND start_time < ? AND end_time > ?
        ''', (user_id, date, task_id, end_time, start_time)).fetchone()

        if overlapping:
            return jsonify({'success': False, 'message': 'This time slot overlaps with another task.'}), 409

        conn.execute('''
            UPDATE tasks
            SET subject = ?, date = ?, start_time = ?, end_time = ?, description = ?
            WHERE id = ? AND user_id = ?
        ''', (subject, date, start_time, end_time, description, task_id, user_id))
        conn.commit()

    return jsonify({'success': True, 'message': 'Task updated successfully.'})


@app.route('/delete-task', methods=['POST'])
@login_required
def delete_task():
    data    = request.get_json()
    task_id = data.get('id')
    user_id = session['user_id']

    with get_db() as conn:
        conn.execute(
            'DELETE FROM tasks WHERE id = ? AND user_id = ?',
            (task_id, user_id)
        )
        conn.commit()

    return jsonify({'success': True, 'message': 'Task deleted.'})
