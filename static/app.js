'use strict';

const API_URL =
  'https://task-checklist-api.muhammadhaziqzack03.workers.dev';

const DEVICE_KEY_STORAGE =
  'mytasks-device-key-v1';

const LEGACY_STORAGE_KEY =
  'mytasks-pending-v1';

const THEME_STORAGE_KEY =
  'mytasks-theme-v1';


const subjects = {
  CCSB3133:
    'Critical Infrastructure Security',

  CCSB4122:
    'Information Security Management',

  CCSB5213:
    'Malware Analysis',

  CCSB5223:
    'Computer Forensics',

  CEG3433:
    'Project 1',

  CSNB4133:
    'Artificial Intelligence',

  CSNB4423:
    'Parallel Computing',

  GENERAL:
    'General / Personal',
};


const reverseSubjects =
  Object.fromEntries(
    Object.entries(
      subjects
    ).map(
      ([code, name]) => [
        name,
        code,
      ]
    )
  );


const types = [
  'Assignment',
  'Quiz',
  'Midterm',
  'Final Exam',
  'Project',
  'Other',
];


const $ =
  id =>
    document.getElementById(
      id
    );


let tasks = [];
let editingId = null;
let toastTimer = null;
let lastCompleted = null;
let deviceKey = '';


const dialog =
  $('task-dialog');

const form =
  $('task-form');


// =====================================================
// SVG
// =====================================================

function svg(name) {

  const icon =
    document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );

  icon.setAttribute(
    'class',
    'icon'
  );

  icon.setAttribute(
    'aria-hidden',
    'true'
  );


  const use =
    document.createElementNS(
      'http://www.w3.org/2000/svg',
      'use'
    );

  use.setAttribute(
    'href',
    `#i-${name}`
  );


  icon.append(
    use
  );

  return icon;
}


// =====================================================
// CREATE ELEMENT
// =====================================================

function make(
  tag,
  className,
  text
) {

  const el =
    document.createElement(
      tag
    );


  if (className) {
    el.className =
      className;
  }


  if (
    text !== undefined
  ) {
    el.textContent =
      text;
  }


  return el;
}


// =====================================================
// DARK MODE
// =====================================================

function getPreferredTheme() {

  const saved =
    localStorage.getItem(
      THEME_STORAGE_KEY
    );


  if (
    saved === 'light' ||
    saved === 'dark'
  ) {
    return saved;
  }


  return window.matchMedia(
    '(prefers-color-scheme: dark)'
  ).matches
    ? 'dark'
    : 'light';
}


function updateThemeButton(
  theme
) {

  const button =
    $('theme-toggle');


  if (!button) {
    return;
  }


  const isDark =
    theme === 'dark';


  button.setAttribute(
    'aria-pressed',
    String(isDark)
  );


  button.setAttribute(
    'aria-label',

    isDark
      ? 'Switch to light mode'
      : 'Switch to dark mode'
  );


  button.title =
    isDark
      ? 'Switch to light mode'
      : 'Switch to dark mode';
}


function updateThemeColor(
  theme
) {

  const meta =
    document.querySelector(
      'meta[name="theme-color"]'
    );


  if (!meta) {
    return;
  }


  meta.setAttribute(
    'content',

    theme === 'dark'
      ? '#11131a'
      : '#f8f9fc'
  );
}


function applyTheme(
  theme,
  persist = true
) {

  const safeTheme =
    theme === 'dark'
      ? 'dark'
      : 'light';


  document.documentElement
    .setAttribute(
      'data-theme',
      safeTheme
    );


  if (persist) {

    localStorage.setItem(
      THEME_STORAGE_KEY,
      safeTheme
    );
  }


  updateThemeButton(
    safeTheme
  );


  updateThemeColor(
    safeTheme
  );
}


function initializeTheme() {

  applyTheme(
    getPreferredTheme(),
    false
  );
}


function toggleTheme() {

  const current =
    document.documentElement
      .getAttribute(
        'data-theme'
      ) || 'light';


  applyTheme(
    current === 'dark'
      ? 'light'
      : 'dark'
  );
}


// =====================================================
// DATE
// =====================================================

function localToday() {

  const now =
    new Date();


  return (
    `${now.getFullYear()}-` +
    `${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-` +
    `${String(
      now.getDate()
    ).padStart(2, '0')}`
  );
}


// =====================================================
// DUE LABEL
// =====================================================

function friendlyDue(
  due
) {

  const when =
    new Date(
      `${due}:00`
    );

  const now =
    new Date();


  const start =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );


  const day =
    new Date(
      when.getFullYear(),
      when.getMonth(),
      when.getDate()
    );


  const dayDiff =
    Math.round(
      (
        day -
        start
      ) /
      86400000
    );


  let label;


  if (
    when < now
  ) {

    label =
      'Overdue';

  } else if (
    dayDiff === 0
  ) {

    label =
      'Today';

  } else if (
    dayDiff === 1
  ) {

    label =
      'Tomorrow';

  } else {

    label =
      when.toLocaleDateString(
        'en-MY',
        {
          day:
            'numeric',

          month:
            'short',

          year:
            when.getFullYear() !==
            now.getFullYear()
              ? 'numeric'
              : undefined,
        }
      );
  }


  if (
    due.slice(
      11,
      16
    ) !== '23:59'
  ) {

    label +=
      ` · ${when.toLocaleTimeString(
        'en-MY',
        {
          hour:
            'numeric',

          minute:
            '2-digit',
        }
      )}`;
  }


  return {

    label,

    tone:
      when < now
        ? 'overdue'
        : dayDiff <= 1
          ? 'soon'
          : '',
  };
}


// =====================================================
// COUNTDOWN
// =====================================================

function timeRemaining(
  dueAt
) {

  const now =
    new Date();


  const due =
    new Date(
      `${dueAt}:00`
    );


  const diff =
    due - now;


  const absDiff =
    Math.abs(
      diff
    );


  const totalMinutes =
    Math.max(
      0,

      Math.floor(
        absDiff /
        60000
      )
    );


  const days =
    Math.floor(
      totalMinutes /
      1440
    );


  const hours =
    Math.floor(
      (
        totalMinutes %
        1440
      ) /
      60
    );


  const minutes =
    totalMinutes %
    60;


  let text = '';


  if (
    days > 0
  ) {

    text =
      `${days}d ${hours}h`;

  } else if (
    hours > 0
  ) {

    text =
      `${hours}h ${minutes}m`;

  } else {

    text =
      `${minutes}m`;
  }


  if (
    diff < 0
  ) {

    return {

      text:
        `${text} overdue`,

      overdue:
        true,

      tone:
        'overdue',
    };
  }


  let tone = '';


  if (
    totalMinutes <= 120
  ) {

    tone =
      'urgent';

  } else if (
    totalMinutes <= 1440
  ) {

    tone =
      'soon';
  }


  return {

    text:
      `${text} left`,

    overdue:
      false,

    tone,
  };
}


// =====================================================
// NORMALIZE TASK
// =====================================================

function normalizeTask(
  row
) {

  const subjectCode =
    Object.hasOwn(
      subjects,
      row.subject
    )
      ? row.subject
      : reverseSubjects[
          row.subject
        ] ||
        'GENERAL';


  return {

    id:
      String(
        row.id
      ),

    title:
      row.task_name,

    subject_code:
      subjectCode,

    task_type:
      row.task_type,

    due_at:
      `${row.due_date}T${
        row.due_time ||
        '23:59'
      }`,

    notes:
      row.notes || '',
  };
}


// =====================================================
// TASK PAYLOAD
// =====================================================

function taskPayload(
  task
) {

  return {

    subject:
      task.subject_code,

    task_name:
      task.title,

    task_type:
      task.task_type,

    due_date:
      task.due_at.slice(
        0,
        10
      ),

    due_time:
      task.due_at.slice(
        11,
        16
      ),

    notes:
      task.notes || '',
  };
}


// =====================================================
// VALIDATE TASK
// =====================================================

function validTask(
  task
) {

  if (
    !task ||
    typeof task !==
      'object' ||
    Array.isArray(
      task
    )
  ) {

    return false;
  }


  if (
    !String(
      task.id || ''
    )
  ) {

    return false;
  }


  if (
    typeof task.title !==
      'string' ||

    !task.title.trim() ||

    task.title.length >
      140
  ) {

    return false;
  }


  if (
    !Object.hasOwn(
      subjects,
      task.subject_code
    ) ||

    !types.includes(
      task.task_type
    )
  ) {

    return false;
  }


  if (
    typeof task.due_at !==
      'string' ||

    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
      .test(
        task.due_at
      )
  ) {

    return false;
  }


  if (
    typeof task.notes !==
      'string' ||

    task.notes.length >
      1500
  ) {

    return false;
  }


  return true;
}


// =====================================================
// API
// =====================================================

async function api(
  path,
  options = {}
) {

  const headers =
    new Headers(
      options.headers ||
      {}
    );


  headers.set(
    'X-Device-Key',
    deviceKey
  );


  if (
    options.body &&
    !headers.has(
      'Content-Type'
    )
  ) {

    headers.set(
      'Content-Type',
      'application/json'
    );
  }


  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        ...options,
        headers,
      }
    );


  const contentType =
    response.headers.get(
      'content-type'
    ) || '';


  const data =
    contentType.includes(
      'application/json'
    )

      ? await response.json()

      : await response.text();


  if (
    !response.ok
  ) {

    const message =
      typeof data ===
        'object' &&
      data?.error

        ? data.error

        : String(
            data ||
            `HTTP ${response.status}`
          );


    const error =
      new Error(
        message
      );


    error.status =
      response.status;


    throw error;
  }


  return data;
}


// =====================================================
// TOAST
// =====================================================

function toast(
  message,
  allowUndo = false
) {

  clearTimeout(
    toastTimer
  );


  $('toast-message')
    .textContent =
      message;


  $('toast-undo')
    .hidden =
      !allowUndo;


  $('toast')
    .hidden =
      false;


  toastTimer =
    setTimeout(
      () => {

        $('toast')
          .hidden =
            true;

        lastCompleted =
          null;

      },
      6500
    );
}


// =====================================================
// RENDER TASKS
// =====================================================

function render() {

  const list =
    $('task-list');


  list.replaceChildren();


  list.setAttribute(
    'aria-busy',
    'false'
  );


  $('pending-count')
    .textContent =
      tasks.length;


  if (
    !tasks.length
  ) {

    const empty =
      make(
        'div',
        'empty-state'
      );


    const visual =
      make(
        'div',
        'empty-icon'
      );


    visual.append(
      svg(
        'spark'
      )
    );


    empty.append(

      visual,

      make(
        'h3',
        '',
        'All caught up.'
      ),

      make(
        'p',
        '',
        'Nothing pending. Enjoy the breathing room.'
      )
    );


    list.append(
      empty
    );


    return;
  }


  const sortedTasks =
    [...tasks].sort(
      (
        a,
        b
      ) =>

        a.due_at.localeCompare(
          b.due_at
        ) ||

        Number(
          a.id
        ) -

        Number(
          b.id
        )
    );


  for (
    const task
    of sortedTasks
  ) {

    const card =
      make(
        'article',
        'task-card'
      );


    card.dataset.id =
      task.id;


    // CHECKBOX
    const check =
      make(
        'button',
        'task-check'
      );


    check.type =
      'button';


    check.setAttribute(
      'aria-label',
      `Complete ${task.title}`
    );


    check.title =
      'Mark as completed';


    check.append(
      svg(
        'check'
      )
    );


    check.addEventListener(
      'click',
      () =>
        completeTask(
          task.id,
          check
        )
    );


    // MAIN
    const main =
      make(
        'div',
        'task-main'
      );


    const heading =
      make(
        'h3',
        'task-title',
        task.title
      );


    const meta =
      make(
        'div',
        'task-meta'
      );


    meta.append(

      make(
        'span',
        'task-type',
        task.task_type
      ),

      make(
        'span',
        'meta-separator'
      ),

      make(
        'span',
        'subject-name',

        subjects[
          task.subject_code
        ] ||

        task.subject_code
      )
    );


    main.append(
      heading,
      meta
    );


    if (
      task.notes
    ) {

      main.append(
        make(
          'p',
          'task-notes',
          task.notes
        )
      );
    }


    // RIGHT SIDE
    const right =
      make(
        'div',
        'card-right'
      );


    const dueInfo =
      friendlyDue(
        task.due_at
      );


    const pill =
      make(
        'span',
        `due-pill ${dueInfo.tone}`,
        dueInfo.label
      );


    pill.title =
      `Due ${task.due_at.replace(
        'T',
        ' '
      )}`;


    // COUNTDOWN
    const remainingInfo =
      timeRemaining(
        task.due_at
      );


    const countdown =
      make(
        'span',
        `countdown ${remainingInfo.tone}`,
        remainingInfo.text
      );


    const dueStack =
      make(
        'div',
        'due-stack'
      );


    dueStack.append(
      pill,
      countdown
    );


    // ACTIONS
    const actions =
      make(
        'div',
        'card-actions'
      );


    const buttons = [

      [
        'pencil',
        'Edit task',
        () =>
          openDialog(
            task
          ),
      ],

      [
        'trash',
        'Delete task',
        () =>
          deleteTask(
            task.id
          ),
      ],
    ];


    for (
      const [
        name,
        title,
        action
      ]
      of buttons
    ) {

      const button =
        make(
          'button',

          'icon-button' +
          (
            name ===
            'trash'
              ? ' danger'
              : ''
          )
        );


      button.type =
        'button';


      button.title =
        title;


      button.setAttribute(
        'aria-label',
        `${title}: ${task.title}`
      );


      button.append(
        svg(
          name
        )
      );


      button.addEventListener(
        'click',
        action
      );


      actions.append(
        button
      );
    }


    right.append(
      dueStack,
      actions
    );


    card.append(
      check,
      main,
      right
    );


    list.append(
      card
    );
  }
}


// =====================================================
// LOAD TASKS
// =====================================================

async function loadTasks() {

  $('task-list')
    .setAttribute(
      'aria-busy',
      'true'
    );


  const data =
    await api(
      '/tasks',
      {
        method:
          'GET',
      }
    );


  tasks =
    (
      data.tasks ||
      []
    )
      .map(
        normalizeTask
      )
      .filter(
        validTask
      );


  render();
}


// =====================================================
// COMPLETE TASK
// =====================================================

async function completeTask(
  id,
  check
) {

  const completed =
    tasks.find(
      task =>
        task.id ===
        id
    );


  if (
    !completed
  ) {
    return;
  }


  check.disabled =
    true;


  check.classList.add(
    'is-checked'
  );


  try {

    await api(
      `/tasks/${encodeURIComponent(
        id
      )}/complete`,
      {
        method:
          'PATCH',
      }
    );


    tasks =
      tasks.filter(
        task =>
          task.id !==
          id
      );


    lastCompleted =
      completed;


    render();


    toast(
      'Task completed. Nicely done!',
      true
    );

  } catch (
    error
  ) {

    check.disabled =
      false;


    check.classList.remove(
      'is-checked'
    );


    toast(
      `Could not complete task: ${error.message}`
    );
  }
}


// =====================================================
// DELETE TASK
// =====================================================

async function deleteTask(
  id
) {

  const current =
    tasks.find(
      task =>
        task.id ===
        id
    );


  if (
    !current ||

    !window.confirm(
      `Delete "${current.title}" permanently?`
    )
  ) {

    return;
  }


  try {

    await api(
      `/tasks/${encodeURIComponent(
        id
      )}`,
      {
        method:
          'DELETE',
      }
    );


    tasks =
      tasks.filter(
        task =>
          task.id !==
          id
      );


    lastCompleted =
      null;


    render();


    toast(
      'Task deleted.'
    );

  } catch (
    error
  ) {

    toast(
      `Could not delete: ${error.message}`
    );
  }
}


// =====================================================
// OPEN ADD / EDIT DIALOG
// =====================================================

function openDialog(
  task = null
) {

  form.reset();


  editingId =
    task
      ? task.id
      : null;


  $('dialog-title')
    .textContent =

      task
        ? 'Edit task'
        : 'Create a task';


  $('save-task')
    .firstChild
    .textContent =

      task
        ? 'Save changes '
        : 'Save task ';


  $('form-error')
    .hidden =
      true;


  if (
    task
  ) {

    $('task-title').value =
      task.title;


    $('task-subject').value =
      task.subject_code;


    $('task-type').value =
      task.task_type;


    $('task-date').value =
      task.due_at.slice(
        0,
        10
      );


    $('task-time').value =

      task.due_at.slice(
        11,
        16
      ) === '23:59'

        ? ''

        : task.due_at.slice(
            11,
            16
          );


    $('task-notes').value =
      task.notes;

  } else {

    $('task-date').value =
      localToday();
  }


  dialog.showModal();


  $('task-title')
    .focus();
}


// =====================================================
// SAVE TASK
// =====================================================

form.addEventListener(
  'submit',

  async event => {

    event.preventDefault();


    const save =
      $('save-task');


    const task = {

      id:
        editingId ||
        'new',

      title:
        $('task-title')
          .value
          .trim(),

      subject_code:
        $('task-subject')
          .value,

      task_type:
        $('task-type')
          .value,

      due_at:
        `${$('task-date').value}T${
          $('task-time').value ||
          '23:59'
        }`,

      notes:
        $('task-notes')
          .value
          .trim(),
    };


    if (
      !validTask(
        task
      )
    ) {

      $('form-error')
        .textContent =
          'Please check the task details.';


      $('form-error')
        .hidden =
          false;


      return;
    }


    save.disabled =
      true;


    $('form-error')
      .hidden =
        true;


    try {

      const updated =
        editingId !==
        null;


      const path =
        updated

          ? `/tasks/${encodeURIComponent(
              editingId
            )}`

          : '/tasks';


      const data =
        await api(
          path,
          {

            method:
              updated
                ? 'PATCH'
                : 'POST',

            body:
              JSON.stringify(
                taskPayload(
                  task
                )
              ),
          }
        );


      const saved =
        normalizeTask(
          data.task
        );


      tasks =
        updated

          ? tasks.map(
              current =>
                current.id ===
                editingId
                  ? saved
                  : current
            )

          : [
              ...tasks,
              saved,
            ];


      editingId =
        null;


      lastCompleted =
        null;


      dialog.close();


      render();


      toast(
        updated
          ? 'Task updated.'
          : 'Task added. You got this!'
      );

    } catch (
      error
    ) {

      $('form-error')
        .textContent =
          `Could not save: ${error.message}`;


      $('form-error')
        .hidden =
          false;

    } finally {

      save.disabled =
        false;
    }
  }
);


// =====================================================
// THEME BUTTON
// =====================================================

$('theme-toggle')
  .addEventListener(
    'click',
    toggleTheme
  );


// =====================================================
// ADD BUTTONS
// =====================================================

$('open-add')
  .addEventListener(
    'click',
    () =>
      openDialog()
  );


$('mobile-add')
  .addEventListener(
    'click',
    () =>
      openDialog()
  );


// =====================================================
// CLOSE DIALOG
// =====================================================

$('close-dialog')
  .addEventListener(
    'click',
    () =>
      dialog.close()
  );


$('cancel-dialog')
  .addEventListener(
    'click',
    () =>
      dialog.close()
  );


dialog.addEventListener(
  'click',

  event => {

    if (
      event.target ===
      dialog
    ) {

      dialog.close();
    }
  }
);


// =====================================================
// TOAST CLOSE
// =====================================================

$('toast-close')
  .addEventListener(
    'click',
    () => {

      clearTimeout(
        toastTimer
      );


      $('toast')
        .hidden =
          true;


      lastCompleted =
        null;
    }
  );


// =====================================================
// UNDO COMPLETE
// =====================================================

$('toast-undo')
  .addEventListener(

    'click',

    async () => {

      if (
        lastCompleted ===
        null
      ) {

        return;
      }


      const restore =
        lastCompleted;


      try {

        const data =
          await api(

            `/tasks/${encodeURIComponent(
              restore.id
            )}/reopen`,

            {
              method:
                'PATCH',
            }
          );


        tasks = [
          ...tasks,

          normalizeTask(
            data.task
          ),
        ];


        lastCompleted =
          null;


        render();


        toast(
          'Task restored.'
        );

      } catch (
        error
      ) {

        toast(
          `Could not restore: ${error.message}`,
          true
        );
      }
    }
  );


// =====================================================
// BACKUP
// =====================================================

$('export-tasks')
  .addEventListener(

    'click',

    () => {

      try {

        const blob =
          new Blob(

            [
              JSON.stringify(
                {
                  format:
                    'mytasks-v2',

                  exported_at:
                    new Date()
                      .toISOString(),

                  tasks,
                },
                null,
                2
              ),
            ],

            {
              type:
                'application/json',
            }
          );


        const url =
          URL.createObjectURL(
            blob
          );


        const link =
          document.createElement(
            'a'
          );


        link.href =
          url;


        link.download =
          `mytasks-backup-${localToday()}.json`;


        document.body.append(
          link
        );


        link.click();


        link.remove();


        setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          5000
        );


        toast(
          'Backup downloaded.'
        );

      } catch (
        error
      ) {

        toast(
          `Backup failed: ${error.message}`
        );
      }
    }
  );


// =====================================================
// RESTORE BUTTON
// =====================================================

$('import-tasks')
  .addEventListener(

    'click',

    () =>
      $('import-file')
        .click()
  );


// =====================================================
// IMPORT BACKUP
// =====================================================

$('import-file')
  .addEventListener(

    'change',

    async event => {

      const file =
        event.target
          .files?.[0];


      event.target.value =
        '';


      if (
        !file
      ) {
        return;
      }


      try {

        if (
          file.size >
          1024 *
          1024
        ) {

          throw new Error(
            'Backup must be smaller than 1 MB.'
          );
        }


        const data =
          JSON.parse(
            await file.text()
          );


        if (
          !Array.isArray(
            data.tasks
          )
        ) {

          throw new Error(
            'Invalid backup.'
          );
        }


        const imported =
          data.tasks.filter(
            validTask
          );


        if (
          !imported.length
        ) {

          throw new Error(
            'No valid tasks found in this backup.'
          );
        }


        if (
          !window.confirm(
            `Import ${imported.length} task(s) into the shared database? Existing tasks will stay.`
          )
        ) {

          return;
        }


        for (
          const task
          of imported
        ) {

          await api(
            '/tasks',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  taskPayload(
                    task
                  )
                ),
            }
          );
        }


        await loadTasks();


        toast(
          'Backup imported.'
        );

      } catch (
        error
      ) {

        toast(
          `Import failed: ${error.message}`
        );
      }
    }
  );


// =====================================================
// LEGACY TASK CHECK
// =====================================================

function getLegacyTaskCount() {

  try {

    const legacy =
      JSON.parse(
        localStorage.getItem(
          LEGACY_STORAGE_KEY
        ) || '[]'
      );


    return Array.isArray(
      legacy
    )
      ? legacy.length
      : 0;

  } catch {

    return 0;
  }
}


// =====================================================
// DEVICE CONNECTION
// =====================================================

async function connectDevice() {

  const stored =
    localStorage.getItem(
      DEVICE_KEY_STORAGE
    );


  if (
    stored
  ) {

    deviceKey =
      stored;

    return;
  }


  const key =
    window.prompt(
      'Connect this device\n\nPaste your private DEVICE_KEY. You only need to do this once on this browser.'
    );


  if (
    !key ||
    !key.trim()
  ) {

    throw new Error(
      'This device is not connected yet.'
    );
  }


  deviceKey =
    key.trim();


  await api(
    '/tasks',
    {
      method:
        'GET',
    }
  );


  localStorage.setItem(
    DEVICE_KEY_STORAGE,
    deviceKey
  );
}


// =====================================================
// INITIALIZE
// =====================================================

async function initialize() {

  $('today-label')
    .textContent =

      new Date()
        .toLocaleDateString(
          'en-MY',
          {
            day:
              'numeric',

            month:
              'long',

            year:
              'numeric',
          }
        );


  try {

    await connectDevice();


    await loadTasks();


    const legacyCount =
      getLegacyTaskCount();


    if (
      legacyCount > 0
    ) {

      toast(
        `${legacyCount} old local task(s) found. Use Backup first if you want to keep them.`
      );
    }

  } catch (
    error
  ) {

    if (
      error.status ===
      401
    ) {

      localStorage.removeItem(
        DEVICE_KEY_STORAGE
      );


      deviceKey =
        '';
    }


    $('task-list')
      .setAttribute(
        'aria-busy',
        'false'
      );


    $('task-list')
      .replaceChildren(

        make(
          'div',
          'error-state',

          `${error.message} Refresh the page to try again.`
        )
      );
  }
}


// =====================================================
// START
// =====================================================

initializeTheme();

initialize();


// Refresh countdown every 1 minute.
// This does NOT call the database.
// It only re-renders existing browser data.

setInterval(
  () => {

    render();

  },
  60000
);