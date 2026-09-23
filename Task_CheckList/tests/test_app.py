import tempfile
import unittest
from pathlib import Path

from app import make_app


class ChecklistTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = make_app({"TESTING": True, "DATABASE": str(Path(self.tmp.name) / "test.sqlite3")})
        self.client = self.app.test_client()
        self.client.get("/")
        with self.client.session_transaction() as sess:
            self.token = sess["csrf"]

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, path, method="post", json=None, csrf=True):
        headers = {"X-CSRF-Token": self.token} if csrf else {}
        return self.client.open(path, method=method.upper(), json=json if json is not None else {}, headers=headers)

    def sample(self):
        return dict(title=" Quiz 1 ", subject_code="CCSB3133", task_type="Quiz",
                    due_at="2026-09-25T23:59", notes="Read slides")

    def test_create_sort_complete_undo_and_delete(self):
        first = self.call("/api/tasks", json=self.sample())
        self.assertEqual(first.status_code, 201)
        first_id = first.json["id"]
        second = self.sample() | {"title": "Earlier", "due_at": "2026-09-24T13:00"}
        second_id = self.call("/api/tasks", json=second).json["id"]
        self.assertEqual([r["id"] for r in self.client.get("/api/tasks").json["tasks"]], [second_id, first_id])
        self.assertEqual(self.call(f"/api/tasks/{first_id}/complete").status_code, 200)
        self.assertEqual(len(self.client.get("/api/tasks").json["tasks"]), 1)
        self.assertEqual(self.call(f"/api/tasks/{first_id}/undo").status_code, 200)
        self.assertEqual(len(self.client.get("/api/tasks").json["tasks"]), 2)
        self.assertEqual(self.call(f"/api/tasks/{first_id}", method="patch", json=self.sample() | {"title": "Edited"}).status_code, 200)
        self.assertEqual(self.call(f"/api/tasks/{first_id}", method="delete").status_code, 200)
        self.assertEqual(len(self.client.get("/api/tasks").json["tasks"]), 1)

    def test_invalid_subject_and_date_rejected(self):
        self.assertEqual(self.call("/api/tasks", json=self.sample() | {"subject_code": "FAKE"}).status_code, 400)
        self.assertEqual(self.call("/api/tasks", json=self.sample() | {"due_at": "2026-02-30T23:59"}).status_code, 400)
        self.assertEqual(len(self.client.get("/api/tasks").json["tasks"]), 0)

    def test_csrf_required(self):
        self.assertEqual(self.call("/api/tasks", json=self.sample(), csrf=False).status_code, 403)

    def test_page_and_headers(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"One thing", res.data)
        self.assertIn("default-src 'self'", res.headers["Content-Security-Policy"])


if __name__ == "__main__":
    unittest.main()
