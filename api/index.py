"""
Vercel entry point — imports the Flask app from the root app.py.
The database is initialised on first request since Vercel's filesystem
is ephemeral (data resets on each cold start / deployment).
"""

import sys
import os

# Make sure the project root is on the path so app.py can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, init_db

# Initialise DB tables (safe to call multiple times — uses CREATE IF NOT EXISTS)
init_db()

# Vercel looks for a variable named `app` in this file
app = app
