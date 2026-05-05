# 📚 Smart Study Planner

A full-stack web application to help students manage their study schedules, track tasks, and monitor progress.

## Features

- 🔐 **Authentication** – Register, login, logout with hashed passwords
- 📅 **Study Planner** – Daily and weekly schedule views with overlap prevention
- ✅ **Task Tracker** – Add, edit, delete tasks; mark complete/pending
- 📊 **Progrerudra projecss Dashboard** – Live stats and animated progress bar
- 🔔 **Reminders** – Browser notifications when a task's start time arrives
- 🔍 **Search & Filter** – Filter by date, subject, or completion status
- 🌙 **Dark Mode** – Toggle between light and dark themes

## Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Frontend | HTML5, CSS3, Vanilla JS      |
| Backend  | Python 3, Flask              |
| Database | SQLite (via Python stdlib)   |
| Auth     | Werkzeug password hashing    |

## Project Structure

```
smart-study-planner/
├── app.py                  # Flask application & API routes
├── requirements.txt
├── study_planner.db        # SQLite database (auto-created)
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
        └── reminder.js     # Browser notification reminders
```

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Run the app

```bash
python app.py
```

### 3. Open in browser

```
http://127.0.0.1:5000
```

Register a new account and start planning your study sessions!

## API Endpoints

| Method | Route          | Description                        |
|--------|----------------|------------------------------------|
| GET    | `/`            | Redirect to dashboard or login     |
| GET/POST | `/register`  | User registration                  |
| GET/POST | `/login`     | User login                         |
| GET    | `/logout`      | Clear session and redirect         |
| GET    | `/dashboard`   | Main app page (requires login)     |
| GET    | `/get-tasks`   | Fetch tasks as JSON (with filters) |
| POST   | `/add-task`    | Create a new task                  |
| POST   | `/update-task` | Edit task or toggle status         |
| POST   | `/delete-task` | Remove a task                      |
