"""A local-first, single-page academic task checklist (no app login)."""
from __future__ import annotations

import os
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request, session

SUBJECTS = {
    "CCSB3133": "Critical Infrastructure Security",
    "CCSB4122": "Information Security Management",
    "CCSB5213": "Malware Analysis",
    "CCSB5223": "Computer Forensics",
    "CEG3433": "Project 1",
    "CSNB4133": "Artificial Intelligence",
    "CSNB4423": "Parallel Computing",
    "GENERAL": "General / Personal",
}
TYPES = ("Assignment", "Quiz", "Midterm", "Final Exam", "Project", "Other")
DUE_PATTERN = re.compile(r"\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\Z")


def make_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    key_file = Path(app.instance_path) / ".session_key"
    if not key_file.exists():
        # Local-only secret for form CSRF protection. Never commit this file.
        key_file.write_text(secrets.token_hex(32), encoding="utf-8")
    app.config.update(
        SECRET_KEY=key_file.read_text(encoding="utf-8").strip(),
        DATABASE=str(Path(app.instance_path) / "tasks.sqlite3"),
        MAX_CONTENT_LENGTH=16 * 1024,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Strict",
    )
    if test_config:
        app.config.update(test_config)

    def db() -> sqlite3.Connection:
        conn = sqlite3.connect(app.config["DATABASE"], timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=10000")
        return conn

    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                subject_code TEXT NOT NULL,
                task_type TEXT NOT NULL,
                due_at TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed')),
                created_at TEXT NOT NULL,
                completed_at TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_at)")

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
        )
        return response

    @app.before_request
    def check_csrf():
        if request.method in ("POST", "PATCH", "PUT", "DELETE"):
            token = session.get("csrf")
            received = request.headers.get("X-CSRF-Token", "")
            if not token or not secrets.compare_digest(token, received):
                return jsonify(error="Invalid request token. Refresh the page."), 403
            if not request.is_json:
                return jsonify(error="Expected JSON request."), 415

    @app.get("/")
    def index():
        if "csrf" not in session:
            session["csrf"] = secrets.token_urlsafe(32)
        return render_template("index.html", subjects=SUBJECTS, types=TYPES, csrf=session["csrf"])

    @app.get("/api/tasks")
    def list_tasks():
        with db() as conn:
            rows = conn.execute("""
                SELECT id, title, subject_code, task_type, due_at, notes
                FROM tasks WHERE status='pending' ORDER BY due_at ASC, id ASC
            """).fetchall()
        return jsonify(tasks=[dict(row) for row in rows])

    def validated_task(payload):
        if not isinstance(payload, dict):
            return None, "Invalid form data."
        title = payload.get("title")
        subject_code = payload.get("subject_code")
        task_type = payload.get("task_type")
        due_at = payload.get("due_at")
        notes = payload.get("notes", "")
        if not isinstance(title, str) or not (1 <= len(title.strip()) <= 140):
            return None, "Task name must be 1–140 characters."
        if not isinstance(subject_code, str) or subject_code not in SUBJECTS:
            return None, "Choose a valid subject."
        if not isinstance(task_type, str) or task_type not in TYPES:
            return None, "Choose a valid task type."
        if not isinstance(due_at, str) or not DUE_PATTERN.fullmatch(due_at):
            return None, "Choose a valid due date and time."
        try:
            datetime.strptime(due_at, "%Y-%m-%dT%H:%M")
        except ValueError:
            return None, "Choose a valid due date and time."
        if not isinstance(notes, str) or len(notes) > 1500:
            return None, "Notes must be at most 1,500 characters."
        return (title.strip(), subject_code, task_type, due_at, notes.strip()), None

    @app.post("/api/tasks")
    def create_task():
        values, error = validated_task(request.get_json(silent=True))
        if error:
            return jsonify(error=error), 400
        with db() as conn:
            cursor = conn.execute("""
                INSERT INTO tasks (title, subject_code, task_type, due_at, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (*values, datetime.now(timezone.utc).isoformat()))
            task_id = cursor.lastrowid
        return jsonify(id=task_id), 201

    @app.patch("/api/tasks/<int:task_id>")
    def update_task(task_id):
        values, error = validated_task(request.get_json(silent=True))
        if error:
            return jsonify(error=error), 400
        with db() as conn:
            cursor = conn.execute("""
                UPDATE tasks SET title=?, subject_code=?, task_type=?, due_at=?, notes=?
                WHERE id=? AND status='pending'
            """, (*values, task_id))
        if not cursor.rowcount:
            return jsonify(error="Task not found."), 404
        return jsonify(ok=True)

    @app.post("/api/tasks/<int:task_id>/complete")
    def complete_task(task_id):
        with db() as conn:
            cursor = conn.execute("""
                UPDATE tasks SET status='completed', completed_at=?
                WHERE id=? AND status='pending'
            """, (datetime.now(timezone.utc).isoformat(), task_id))
        if not cursor.rowcount:
            return jsonify(error="Task not found."), 404
        return jsonify(ok=True)

    @app.post("/api/tasks/<int:task_id>/undo")
    def undo_task(task_id):
        with db() as conn:
            cursor = conn.execute("""
                UPDATE tasks SET status='pending', completed_at=NULL
                WHERE id=? AND status='completed'
            """, (task_id,))
        if not cursor.rowcount:
            return jsonify(error="Task not found."), 404
        return jsonify(ok=True)

    @app.delete("/api/tasks/<int:task_id>")
    def delete_task(task_id):
        with db() as conn:
            cursor = conn.execute("DELETE FROM tasks WHERE id=? AND status='pending'", (task_id,))
        if not cursor.rowcount:
            return jsonify(error="Task not found."), 404
        return jsonify(ok=True)

    return app


app = make_app()

if __name__ == "__main__":
    # Binds to localhost ONLY; do not expose an unauthenticated app publicly.
    from waitress import serve

    print("Task Checklist running at http://127.0.0.1:5000")
    serve(app, host="127.0.0.1", port=int(os.getenv("PORT", "5000")), threads=4)
