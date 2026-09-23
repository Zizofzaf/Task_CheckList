# My Tasks — phone-first GitHub Pages edition

This is a **standalone, static** minimalist checklist. No Flask, Python, database server, accounts, or login. It keeps your **pending** tasks in your browser's `localStorage`. When you mark a task complete, it disappears and is removed from that device's storage (you can briefly Undo). You can add, edit, delete and sort by due date. Seven semester subjects are already configured.

## Deploy to your existing GitHub repository

1. Extract this ZIP. Upload `index.html`, `static/`, `.nojekyll`, and `README.md` **directly to the root** of `Zizofzaf/Task_CheckList` (do not upload the ZIP or an outer folder). If you already added the older Flask project, the older `app.py`, `templates/` and `requirements.txt` are **not used** by GitHub Pages. Remove them when replacing the old project, if convenient.
2. Commit your changes to branch `main`.
3. On GitHub, open **Settings → Pages → Build and deployment**. Set **Source: Deploy from a branch**, then **Branch: main** and folder **/(root)**, and Save.
4. Wait for GitHub Pages to publish. Your expected URL is `https://zizofzaf.github.io/Task_CheckList/` (confirm the actual link using **Settings → Pages → Visit site**).
5. Open the published URL on your phone. On iPhone use Safari → Share → **Add to Home Screen**; on Android use the browser menu → **Add to Home screen** (wording varies).

## Read before using

**This version does NOT synchronize tasks across devices.** A task you add from your phone is saved only in that phone/browser; opening the same URL on your laptop gets a separate task list. The site files are public, but your personal task entries are not uploaded to GitHub. If you clear browser data, use incognito mode, reinstall/change browsers or phones, tasks can disappear.

Use the unobtrusive **Backup** and **Restore** links at the bottom to transfer or protect your pending tasks. Backups contain only pending tasks, and Restore **replaces** the current list on the receiving device. Store the JSON backup file privately (do not commit it to GitHub). Backups do not happen automatically. Previously saved tasks from the Flask/SQLite version do not migrate automatically.

If you later want the **same live task list on phone and laptop**, you need an online database and a deliberate access-control decision. An anonymously writable public database would let anyone modify or delete your tasks; a private GitHub repo by itself does not secure that database.
