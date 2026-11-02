import { STATUS_LABELS, PRIORITY_LABELS, localDate } from './model.js';
import { icon } from './icons.js';

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

const projectColors = ['violet', 'blue', 'green', 'amber', 'pink'];
export function projectColor(name) {
  return projectColors[Array.from(name).reduce((sum, char) => sum + char.codePointAt(0), 0) % projectColors.length];
}

function dueLabel(value, today) {
  if (!value) return '<span class="date-empty">Без срок</span>';
  const date = new Date(`${value}T12:00:00`);
  const label = value === today ? 'Днес' : new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short' }).format(date);
  return `<time datetime="${escapeHtml(value)}">${escapeHtml(label)}</time>`;
}

export function renderTasks(container, tasks, today = localDate()) {
  container.innerHTML = tasks.map(task => `
    <article class="task-row ${task.status === 'done' ? 'is-done' : ''}" data-task-id="${escapeHtml(task.id)}">
      <div class="task-identity"><button class="task-check ${task.status === 'done' ? 'checked' : ''}" data-action="toggle" aria-label="${escapeHtml(task.status === 'done' ? 'Върни като предстояща: ' : 'Завърши: ')}${escapeHtml(task.title)}" aria-pressed="${task.status === 'done'}">${task.status === 'done' ? icon('check') : ''}</button><div class="task-text"><button class="task-title" data-action="edit">${escapeHtml(task.title)}</button><div class="task-meta"><span class="project-dot ${projectColor(task.project)}"></span><span>${escapeHtml(task.project || 'Без проект')}</span>${task.description ? '<span class="meta-divider">·</span><span class="description-preview">' + escapeHtml(task.description) + '</span>' : ''}</div></div></div>
      <span class="status-pill ${task.status}"><i></i>${STATUS_LABELS[task.status]}</span>
      <span class="priority-label ${task.priority}"><i></i>${PRIORITY_LABELS[task.priority]}</span>
      <span class="task-date ${task.dueDate && task.dueDate < today && task.status !== 'done' ? 'overdue' : ''}">${dueLabel(task.dueDate, today)}</span>
      <div class="task-actions"><button class="icon-button" data-action="edit" aria-label="Редактирай ${escapeHtml(task.title)}">${icon('edit')}</button><button class="icon-button delete-action" data-action="delete" aria-label="Изтрий ${escapeHtml(task.title)}">${icon('trash')}</button></div>
    </article>`).join('');
}

export function renderProjects(container, tasks, selectedProject) {
  const projects = [...new Set(tasks.map(task => task.project).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'bg'));
  container.innerHTML = projects.length ? projects.map(project => `<button class="project-link ${selectedProject === project ? 'active' : ''}" data-project="${escapeHtml(project)}"><span class="project-dot ${projectColor(project)}"></span><span>${escapeHtml(project)}</span><small>${tasks.filter(task => task.project === project).length}</small></button>`).join('') : '<p class="no-projects">Проектите ти ще се появят тук.</p>';
  return projects;
}
