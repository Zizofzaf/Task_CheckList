# My Tasks — personal academic checklist

A minimalist, single-page checklist for your current semester. No application login, no external integrations, no cloud dependency. Tasks are stored in your own local SQLite database. Completing a task removes it from the main page (with a short Undo option). Editing and deleting are also supported.

## 1. Run on Windows (PowerShell)

From the project folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000** in your browser. Keep the terminal running while using the app. If PowerShell blocks activating the environment, use `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.\.venv\Scripts\python.exe app.py` directly instead.

To stop, press `Ctrl+C` in the terminal.

## 2. Push the project to your GitHub repo

First change `Task_CheckList` repository visibility to **Private** in GitHub Settings → Danger Zone → Change repository visibility. Then, from this project's folder:

```powershell
git init
git add .
git commit -m "Build minimalist task checklist"
git branch -M main
git remote add origin https://github.com/Zizofzaf/Task_CheckList.git
git push -u origin main
```

If you already cloned the repository, do **not** run `git init` or `git remote add origin`; instead copy these files into the cloned folder, then use `git add .`, `git commit`, `git push`.

The `instance/` directory (task database and server secret), `.venv/`, and `.env` are excluded in `.gitignore`. **Do not commit your SQLite database to GitHub.** GitHub stores the code, not the live task data.

## 3. Access it from your phone, privately, without an app login

The server binds to `127.0.0.1` on purpose. To access it from anywhere while keeping it off the public internet:

1. Install Tailscale on the computer running the app and on your phone. Sign your devices into **your own** tailnet account. You do not log in to the checklist itself.
2. Keep `python app.py` running on the computer. From its terminal, run `tailscale serve --bg 5000` (the Tailscale CLI must be in PATH; configure tailnet HTTPS if prompted).
3. Run `tailscale serve status` to obtain the private `https://...ts.net` URL. Open that URL from your phone with Tailscale connected.
4. If you want to stop sharing: `tailscale serve reset`.

**Never use `tailscale funnel` or publish this Flask app to a public website without adding access control.** Tailscale Serve is accessible only to devices/users allowed by your tailnet's access rules; limit membership to yourself. The host computer must remain on and the Python process must stay running. For 24/7 access, move it to an always-on computer or private VM later.

## 4. Backup

Copy `instance/tasks.sqlite3` while the app is stopped to back up your tasks. If moving computers, copy that file to the new installation's `instance/` folder. Do not delete the `instance/` directory unless you intend to reset the app. Completed tasks are hidden, not permanently erased (so Undo works); Delete is permanent.

## Project layout

```text
Task_CheckList/
├── app.py
├── requirements.txt
├── templates/index.html
├── static/style.css
├── static/app.js
├── tests/test_app.py
├── .gitignore
└── README.md
```

## Tests

```powershell
python -m unittest discover -s tests -v
```

Security note: No application login means anyone who can reach the server can manage tasks. Only use the localhost URL or restricted Tailscale Serve, and do not open port 5000 to the public internet.
