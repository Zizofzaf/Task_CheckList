'use strict';

// GitHub Pages is static hosting. Pending tasks are kept ONLY in this browser.
const STORAGE_KEY = 'mytasks-pending-v1';
const subjects = {
  CCSB3133: 'Critical Infrastructure Security',
  CCSB4122: 'Information Security Management',
  CCSB5213: 'Malware Analysis',
  CCSB5223: 'Computer Forensics',
  CEG3433: 'Project 1',
  CSNB4133: 'Artificial Intelligence',
  CSNB4423: 'Parallel Computing',
  GENERAL: 'General / Personal',
};
const types = ['Assignment', 'Quiz', 'Midterm', 'Final Exam', 'Project', 'Other'];
const $ = id => document.getElementById(id);
let tasks = [];
let editingId = null;
let toastTimer = null;
let lastCompleted = null;
const dialog = $('task-dialog');
const form = $('task-form');

function svg(name) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'icon');
  icon.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  icon.append(use);
  return icon;
}
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
function friendlyDue(due) {
  const when = new Date(due);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const dayDiff = Math.round((day - start) / 86400000);
  let label;
  if (when < now) label = 'Overdue';
  else if (dayDiff === 0) label = 'Today';
  else if (dayDiff === 1) label = 'Tomorrow';
  else label = when.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: when.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  if (due.slice(11,16) !== '23:59') {
    label += ` · ${when.toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return { label, tone: when < now ? 'overdue' : dayDiff <= 1 ? 'soon' : '' };
}
function validTask(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
  if (typeof t.id !== 'string' || t.id.length > 100 || !t.id) return false;
  if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 140) return false;
  if (!Object.hasOwn(subjects, t.subject_code) || !types.includes(t.task_type)) return false;
  if (typeof t.due_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t.due_at)) return false;
  const [date, time] = t.due_at.split('T');
  if (new Date(`${date}T${time}:00`).toString() === 'Invalid Date') return false;
  if (typeof t.notes !== 'string' || t.notes.length > 1500) return false;
  return true;
}
function loadTasks() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  const data = JSON.parse(stored);
  if (!Array.isArray(data) || !data.every(validTask)) throw new Error('Saved tasks cannot be read. Please restore a valid backup.');
  return data;
}
function persist(next) {
  // Write first, so a storage failure does not make a task appear saved.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  tasks = next;
  render();
}
function toast(message, allowUndo = false) {
  clearTimeout(toastTimer);
  $('toast-message').textContent = message;
  $('toast-undo').hidden = !allowUndo;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => {
    $('toast').hidden = true;
    lastCompleted = null;
  }, 6500);
}
function render() {
  const list = $('task-list');
  list.replaceChildren();
  list.setAttribute('aria-busy', 'false');
  $('pending-count').textContent = tasks.length;
  if (!tasks.length) {
    const empty = make('div', 'empty-state');
    const visual = make('div', 'empty-icon');
    visual.append(svg('spark'));
    empty.append(visual, make('h3', '', 'All caught up.'), make('p', '', 'Nothing pending. Enjoy the breathing room.'));
    list.append(empty);
    return;
  }
  for (const task of [...tasks].sort((a,b) => a.due_at.localeCompare(b.due_at) || a.id.localeCompare(b.id))) {
    const card = make('article', 'task-card');
    card.dataset.id = task.id;
    const check = make('button', 'task-check');
    check.type = 'button';
    check.setAttribute('aria-label', `Complete ${task.title}`);
    check.title = 'Mark as completed';
    check.append(svg('check'));
    check.addEventListener('click', () => completeTask(task.id, card, check));
    const main = make('div', 'task-main');
    const heading = make('h3', 'task-title', task.title);
    const meta = make('div', 'task-meta');
    meta.append(make('span', 'task-type', task.task_type), make('span', 'meta-separator'), make('span', 'subject-name', subjects[task.subject_code] || task.subject_code));
    main.append(heading, meta);
    if (task.notes) main.append(make('p', 'task-notes', task.notes));
    const right = make('div', 'card-right');
    const dueInfo = friendlyDue(task.due_at);
    const pill = make('span', `due-pill ${dueInfo.tone}`, dueInfo.label);
    pill.title = `Due ${task.due_at.replace('T', ' ')}`;
    const actions = make('div', 'card-actions');
    for (const [name, title, action] of [['pencil','Edit task',()=>openDialog(task)],['trash','Delete task',()=>deleteTask(task.id)]]) {
      const button = make('button', 'icon-button' + (name === 'trash' ? ' danger' : ''));
      button.type = 'button';
      button.title = title;
      button.setAttribute('aria-label', `${title}: ${task.title}`);
      button.append(svg(name));
      button.addEventListener('click', action);
      actions.append(button);
    }
    right.append(pill, actions);
    card.append(check, main, right);
    list.append(card);
  }
}
function completeTask(id, card, check) {
  const completed = tasks.find(t => t.id === id);
  if (!completed) return;
  check.disabled = true;
  try {
    persist(tasks.filter(t => t.id !== id));
    lastCompleted = completed;
    toast('Task completed. Nicely done!', true);
  } catch (err) { check.disabled = false; toast(`Could not save: ${err.message}`); }
}
function deleteTask(id) {
  const current = tasks.find(t => t.id === id);
  if (!current || !window.confirm(`Delete "${current.title}" permanently?`)) return;
  try {
    persist(tasks.filter(t => t.id !== id));
    lastCompleted = null;
    toast('Task deleted.');
  } catch (err) { toast(`Could not delete: ${err.message}`); }
}
function openDialog(task = null) {
  form.reset();
  editingId = task ? task.id : null;
  $('dialog-title').textContent = task ? 'Edit task' : 'Create a task';
  $('save-task').firstChild.textContent = task ? 'Save changes ' : 'Save task ';
  $('form-error').hidden = true;
  if (task) {
    $('task-title').value = task.title;
    $('task-subject').value = task.subject_code;
    $('task-type').value = task.task_type;
    $('task-date').value = task.due_at.slice(0,10);
    $('task-time').value = task.due_at.slice(11,16) === '23:59' ? '' : task.due_at.slice(11,16);
    $('task-notes').value = task.notes;
  } else {
    $('task-date').value = localToday();
  }
  dialog.showModal();
  $('task-title').focus();
}
form.addEventListener('submit', event => {
  event.preventDefault();
  const save = $('save-task');
  const payload = {
    title: $('task-title').value.trim(),
    subject_code: $('task-subject').value,
    task_type: $('task-type').value,
    due_at: `${$('task-date').value}T${$('task-time').value || '23:59'}`,
    notes: $('task-notes').value.trim(),
  };
  if (!payload.title || !Object.hasOwn(subjects,payload.subject_code) || !types.includes(payload.task_type)) return;
  save.disabled = true;
  try {
    const updated = editingId !== null;
    const task = { id: updated ? editingId : `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...payload };
    if (!validTask(task)) throw new Error('Check your task details.');
    persist(updated ? tasks.map(t => t.id === editingId ? task : t) : [...tasks, task]);
    lastCompleted = null;
    dialog.close();
    toast(updated ? 'Task updated.' : 'Task added. You got this!');
  } catch (err) {
    $('form-error').textContent = `Could not save: ${err.message}`;
    $('form-error').hidden = false;
  } finally { save.disabled = false; }
});
$('open-add').addEventListener('click', () => openDialog());
$('mobile-add').addEventListener('click', () => openDialog());
$('close-dialog').addEventListener('click', () => dialog.close());
$('cancel-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
$('toast-close').addEventListener('click', () => { clearTimeout(toastTimer); $('toast').hidden = true; lastCompleted = null; });
$('toast-undo').addEventListener('click', () => {
  if (lastCompleted === null) return;
  try {
    persist([...tasks, lastCompleted]);
    lastCompleted = null;
    toast('Task restored.');
  } catch (err) { toast(`Could not restore: ${err.message}`, true); }
});
$('export-tasks').addEventListener('click', () => {
  try {
    const blob = new Blob([JSON.stringify({ format:'mytasks-v1', exported_at: new Date().toISOString(), tasks }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mytasks-backup-${localToday()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Backup downloaded.');
  } catch (err) { toast(`Backup failed: ${err.message}`); }
});
$('import-tasks').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('Backup must be smaller than 1 MB.');
    const data = JSON.parse(await file.text());
    if (data?.format !== 'mytasks-v1' || !Array.isArray(data.tasks) || !data.tasks.every(validTask)) {
      throw new Error('This is not a valid My Tasks backup.');
    }
    if (new Set(data.tasks.map(t => t.id)).size !== data.tasks.length) throw new Error('Backup contains duplicate task IDs.');
    if (!window.confirm('Restore this backup? Your current pending tasks on this device will be replaced.')) return;
    persist(data.tasks);
    lastCompleted = null;
    toast('Tasks restored from backup.');
  } catch (err) { toast(`Restore failed: ${err.message}`); }
});
$('today-label').textContent = new Date().toLocaleDateString('en-MY', { day:'numeric', month:'long', year:'numeric' });
try { tasks = loadTasks(); render(); }
catch (err) {
  $('task-list').setAttribute('aria-busy','false');
  $('task-list').replaceChildren(make('div','error-state',err.message));
  toast(`Storage error: ${err.message}`);
}
