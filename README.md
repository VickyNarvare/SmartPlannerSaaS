# 📚 Smart Study Planner

A full-stack web application to help students manage their study schedules, track tasks, and monitor progress.

## Features

- 🔐 **Authentication** – Register, login, logout with hashed passwords
- 📅 **Study Planner** – Daily and weekly schedule views with overlap prevention
- ✅ **Task Tracker** – Add, edit, delete tasks; mark complete/pending
- 📊 **Progress Dashboard** – Live stats and animated progress bar
- 🔔 **Reminders** – Browser notifications when a task's start time arrives
- 🔍 **Search & Filter** – Filter by date, subject, or completion status
- 🌙 **Dark Mode** – Toggle between light and dark themes

## Tech Stack

| Layer    | Technology                |
|----------|---------------------------|
| Frontend | HTML5, CSS3, Vanilla JS   |
| Backend  | Python 3, Flask           |
| Database | SQLite (via Python stdlib) |
| Auth     | Werkzeug password hashing |

## Project Structure

```
smart-study-planner/
├── api/
│   └── index.py            # Vercel entry point (full app code)
├── app.py                  # Local development entry point
├── vercel.json             # Vercel deployment config
├── requirements.txt
├── .env.example
├── study_planner.db        # SQLite database (auto-created, local only)
├── templates/
│   ├── base.html
│   ├── login.html
│   ├── register.html
│   └── dashboard.html
└── static/
    ├── css/
    │   └── style.css
    └── js/
        ├── utils.js        # Shared helpers (toast, theme, dates)
        ├── dashboard.js    # Task CRUD, stats, filters
        ├── planner.js      # Daily & weekly planner views
        ├── pomodoro.js     # Pomodoro timer
        ├── streak.js       # Study streak tracking
        ├── analytics.js    # Analytics view
        └── reminder.js     # Browser notification reminders
```

## Local Development

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set a strong secret key. Generate one with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Run the app

```bash
python app.py
```

### 4. Open in browser

```
http://127.0.0.1:5000
```

## Deploy to Vercel

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login and deploy

```bash
vercel login
vercel --prod
```

### 3. Set environment variable

In the Vercel dashboard go to **Project → Settings → Environment Variables** and add:

```
SECRET_KEY = your-strong-random-secret-key
```

Or via CLI:

```bash
vercel env add SECRET_KEY
```

> **Note:** Vercel's filesystem is ephemeral — SQLite data resets on each cold start. For persistent storage consider [Supabase](https://supabase.com) (PostgreSQL) or [PlanetScale](https://planetscale.com) (MySQL), both have free tiers.

## API Endpoints

| Method   | Route          | Description                        |
|----------|----------------|------------------------------------|
| GET      | `/`            | Redirect to dashboard or login     |
| GET/POST | `/register`    | User registration                  |
| GET/POST | `/login`       | User login                         |
| GET      | `/logout`      | Clear session and redirect         |
| GET      | `/dashboard`   | Main app page (requires login)     |
| GET      | `/get-tasks`   | Fetch tasks as JSON (with filters) |
| POST     | `/add-task`    | Create a new task                  |
| POST     | `/update-task` | Edit task or toggle status         |
| POST     | `/delete-task` | Remove a task                      |
