import { createTask, updateTask, deleteTask, filterTasks, getStats, localDate, ValidationError } from './model.js';
import { loadTasks, saveTasks, clearTasks, STORAGE_KEY } from './storage.js';
import { renderTasks, renderProjects, escapeHtml } from './ui.js';
import { hydrateIcons } from './icons.js';
import { demoTasks } from './demo.js';

const $ = selector => document.querySelector(selector);
// Accessing window.localStorage itself can throw when browser storage is disabled.
const storage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: key => window.localStorage.removeItem(key),
};
let loaded = loadTasks(storage);
let tasks = loaded.tasks;
let editingId = null;
let toastTimer;
let pendingConfirm = null;
const filters = { query: '', status: 'all', priority: 'all', view: 'all', project: '', sort: 'newest' };
const viewLabels = { all: 'Всички задачи', today: 'За днес', done: 'Завършени' };

hydrateIcons();

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error', error);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3800);
}

function render() {
  const today = localDate();
  const stats = getStats(tasks, today);
  const visible = filterTasks(tasks, { ...filters, today });
  renderTasks($('#task-list'), visible, today);
  const projects = renderProjects($('#project-list'), tasks, filters.project);
  $('#project-count').textContent = projects.length;
  $('#project-options').innerHTML = projects.map(project => `<option value="${escapeHtml(project)}"></option>`).join('');
  $('#stat-total').textContent = stats.total;
  $('#stat-progress').textContent = stats.inProgress;
  $('#stat-done').textContent = stats.done;
  $('#stat-percent').innerHTML = `${stats.percent}<small>%</small>`;
  $('#progress-caption').textContent = `${stats.done} от ${stats.total} задачи`;
  $('#progress-bar').style.width = `${stats.percent}%`;
  $('#nav-all').textContent = stats.total;
  $('#nav-today').textContent = stats.today;
  $('#nav-done').textContent = stats.done;
  $('#visible-count').textContent = visible.length;
  $('#tasks-heading-label').textContent = filters.project || viewLabels[filters.view];
  $('#breadcrumb').textContent = filters.project || viewLabels[filters.view];
  $('#result-count').textContent = `Показани ${visible.length} от ${stats.total} задачи`;
  document.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === filters.view && !filters.project;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#active-project').hidden = !filters.project;
  $('#active-project span').textContent = `Проект: ${filters.project}`;
  $('#empty-state').hidden = visible.length > 0;
  $('.table-heading').hidden = visible.length === 0;
  const isFiltered = tasks.length > 0;
  $('#empty-state h3').textContent = isFiltered ? 'Няма задачи по тези критерии.' : 'Всяка добра идея започва оттук.';
  $('#empty-state p').textContent = isFiltered ? 'Опитай с друг филтър или добави нова задача.' : 'Добави първата си задача и направи място за следващата голяма стъпка.';
  $('#empty-add').textContent = isFiltered ? 'Нова задача' : 'Създай първата задача';
  $('#demo-button').hidden = tasks.length > 0;
  $('#storage-warning').hidden = !loaded.error;
  if (loaded.error) {
    $('#storage-warning').innerHTML = `<p>${escapeHtml(loaded.error)}</p><div><button class="button button-secondary" id="backup-raw" ${loaded.raw === null ? 'disabled' : ''}>Изтегли копие</button><button class="button button-secondary" id="reset-storage">Започни отначало</button></div>`;
  }
  for (const id of ['new-task', 'empty-add', 'demo-button']) $(`#${id}`).disabled = !!loaded.error;
}

function commit(nextTasks, message) {
  try {
    if (loaded.error) throw new Error('Първо възстанови локалното съхранение.');
    saveTasks(storage, nextTasks);
    tasks = nextTasks;
    render();
    $('#save-status').textContent = 'Всички промени са запазени';
    toast(message);
    return true;
  } catch (error) { toast(error.message, true); return false; }
}

function clearErrors() {
  for (const id of ['title-error', 'due-error', 'form-error']) $(`#${id}`).textContent = '';
  $('#task-title').removeAttribute('aria-invalid');
  $('#task-due').removeAttribute('aria-invalid');
}

function openEditor(task = null) {
  if (loaded.error) return;
  editingId = task?.id || null;
  $('#task-form').reset();
  clearErrors();
  $('#dialog-title').textContent = task ? 'Редактирай задача' : 'Нова задача';
  $('#submit-label').textContent = task ? 'Запази промените' : 'Създай задача';
  if (task) for (const field of ['title', 'project', 'status', 'priority', 'dueDate', 'description']) $('#task-form').elements.namedItem(field).value = task[field];
  else if (filters.project) $('#task-project').value = filters.project;
  $('#task-dialog').showModal();
  $('#task-title').focus();
}

function confirmAction(title, description, action) {
  $('#confirm-title').textContent = title;
  $('#confirm-description').textContent = description;
  pendingConfirm = action;
  $('#confirm-dialog').returnValue = '';
  $('#confirm-dialog').showModal();
  $('#confirm-dialog button[value="cancel"]').focus();
}

function download(data, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#new-task').addEventListener('click', () => openEditor());
$('#empty-add').addEventListener('click', () => openEditor());
for (const id of ['close-dialog', 'cancel-dialog']) $(`#${id}`).addEventListener('click', () => $('#task-dialog').close());
$('#task-form').addEventListener('submit', event => {
  event.preventDefault(); clearErrors();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const next = editingId ? updateTask(tasks, editingId, input) : [createTask(input), ...tasks];
    if (commit(next, editingId ? 'Промените са запазени.' : 'Новата задача е добавена.')) $('#task-dialog').close();
  } catch (error) {
    if (error instanceof ValidationError) {
      $('#title-error').textContent = error.errors.title || '';
      $('#due-error').textContent = error.errors.dueDate || '';
      if (error.errors.title) { $('#task-title').setAttribute('aria-invalid', 'true'); $('#task-title').focus(); }
      if (error.errors.dueDate) $('#task-due').setAttribute('aria-invalid', 'true');
      $('#form-error').textContent = Object.entries(error.errors).filter(([key]) => !['title', 'dueDate'].includes(key)).map(([, message]) => message).join(' ');
    } else $('#form-error').textContent = error.message;
  }
});
$('#task-list').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const task = tasks.find(item => item.id === button.closest('[data-task-id]').dataset.taskId);
  if (!task) return;
  if (button.dataset.action === 'edit') openEditor(task);
  if (button.dataset.action === 'toggle') commit(updateTask(tasks, task.id, { status: task.status === 'done' ? 'todo' : 'done' }), task.status === 'done' ? 'Задачата е върната като предстояща.' : 'Още една завършена задача!');
  if (button.dataset.action === 'delete') confirmAction('Да изтрием задачата?', `„${task.title}“ ще бъде премахната окончателно.`, () => commit(deleteTask(tasks, task.id), 'Задачата е изтрита.'));
});
$('#confirm-dialog').addEventListener('close', () => {
  const action = pendingConfirm; pendingConfirm = null;
  if ($('#confirm-dialog').returnValue === 'confirm') action?.();
});
$('#search').addEventListener('input', event => { filters.query = event.target.value; render(); });
for (const [id, key] of [['filter-status', 'status'], ['filter-priority', 'priority'], ['sort', 'sort']]) $(`#${id}`).addEventListener('change', event => { filters[key] = event.target.value; render(); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  Object.assign(filters, { view: button.dataset.view, project: '', query: '', status: 'all', priority: 'all' });
  $('#search').value = ''; $('#filter-status').value = 'all'; $('#filter-priority').value = 'all'; render();
}));
$('#project-list').addEventListener('click', event => {
  const button = event.target.closest('[data-project]');
  if (!button) return;
  Object.assign(filters, { project: button.dataset.project, view: 'all', query: '', status: 'all', priority: 'all' });
  $('#search').value = ''; $('#filter-status').value = 'all'; $('#filter-priority').value = 'all'; render();
});
$('#active-project button').addEventListener('click', () => { filters.project = ''; render(); });
$('#demo-button').addEventListener('click', () => { if (!tasks.length) commit(demoTasks(), 'Заредени са 7 примерни задачи. Можеш да ги променяш.'); });
$('#export-button').addEventListener('click', () => {
  download(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2), `devtask-${localDate()}.json`);
  toast('Копието със задачите е изтеглено.');
});
$('#storage-warning').addEventListener('click', event => {
  if (event.target.id === 'backup-raw' && loaded.raw !== null) download(loaded.raw, 'devtask-recovery.txt', 'text/plain');
  if (event.target.id === 'reset-storage') confirmAction('Да изчистим повредения запис?', 'Изтегли копие преди тази стъпка. Текущият локален запис ще бъде премахнат.', () => {
    try { clearTasks(storage); loaded = loadTasks(storage); tasks = loaded.tasks; render(); if (!loaded.error) toast('Можеш да започнеш отначало.'); }
    catch (error) { toast(error.message, true); }
  });
});
// Keep multiple tabs consistent; a submit always uses the most recently loaded state.
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  loaded = loadTasks(storage); tasks = loaded.tasks;
  if ($('#task-dialog').open) $('#task-dialog').close();
  if ($('#confirm-dialog').open) { pendingConfirm = null; $('#confirm-dialog').close(); }
  render(); toast('Задачите са обновени от друг раздел.');
});
render();
