'use strict';

const csrf = document.querySelector('meta[name="csrf-token"]').content;
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
const $ = id => document.getElementById(id);
let tasks = [];
let editingId = null;
let toastTimer = null;
let previousCompletedId = null;
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
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
function toast(message, undoId = null) {
  clearTimeout(toastTimer);
  previousCompletedId = undoId;
  $('toast-message').textContent = message;
  $('toast-undo').hidden = undoId === null;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; previousCompletedId = null; }, 6500);
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
  tasks.sort((a,b) => a.due_at.localeCompare(b.due_at) || a.id - b.id);
  for (const task of tasks) {
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
async function refresh() {
  try {
    const data = await api('/api/tasks');
    tasks = data.tasks;
    render();
  } catch (err) {
    $('task-list').setAttribute('aria-busy', 'false');
    $('task-list').replaceChildren(make('div', 'error-state', err.message));
    toast(err.message);
  }
}
async function completeTask(id, card, check) {
  check.disabled = true;
  try {
    await api(`/api/tasks/${id}/complete`, { method:'POST', body:'{}' });
    check.classList.add('is-checked');
    card.classList.add('is-exiting');
    setTimeout(() => { tasks = tasks.filter(t => t.id !== id); render(); }, 210);
    toast('Task completed. Nicely done!', id);
  } catch (err) { check.disabled = false; toast(err.message); }
}
async function deleteTask(id) {
  const current = tasks.find(t => t.id === id);
  if (!current || !window.confirm(`Delete "${current.title}" permanently?`)) return;
  try {
    await api(`/api/tasks/${id}`, { method:'DELETE', body:'{}' });
    tasks = tasks.filter(t => t.id !== id);
    render();
    toast('Task deleted.');
  } catch (err) { toast(err.message); }
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
form.addEventListener('submit', async event => {
  event.preventDefault();
  const save = $('save-task');
  const payload = {
    title: $('task-title').value.trim(),
    subject_code: $('task-subject').value,
    task_type: $('task-type').value,
    due_at: `${$('task-date').value}T${$('task-time').value || '23:59'}`,
    notes: $('task-notes').value.trim(),
  };
  save.disabled = true;
  try {
    await api(editingId ? `/api/tasks/${editingId}` : '/api/tasks', {
      method: editingId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    const updated = editingId !== null;
    dialog.close();
    await refresh();
    toast(updated ? 'Task updated.' : 'Task added. You got this!');
  } catch (err) {
    $('form-error').textContent = err.message;
    $('form-error').hidden = false;
  } finally { save.disabled = false; }
});
$('open-add').addEventListener('click', () => openDialog());
$('mobile-add').addEventListener('click', () => openDialog());
$('close-dialog').addEventListener('click', () => dialog.close());
$('cancel-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
$('toast-close').addEventListener('click', () => { clearTimeout(toastTimer); $('toast').hidden = true; });
$('toast-undo').addEventListener('click', async () => {
  if (previousCompletedId === null) return;
  const id = previousCompletedId;
  previousCompletedId = null;
  try {
    await api(`/api/tasks/${id}/undo`, { method:'POST', body:'{}' });
    await refresh();
    toast('Task restored.');
  } catch (err) { toast(err.message); }
});
$('today-label').textContent = new Date().toLocaleDateString('en-MY', { day:'numeric', month:'long', year:'numeric' });
refresh();
