/**
 * Poison - Enterprise SaaS Multi-Screen ToDo & Reminder Engine (Neon DB + FCM Connected)
 */

import { initThreeBackground, updateThreeTheme } from './three-bg.js';
import { initFirebaseMessaging, requestFcmToken } from './firebase-init.js';

const API_BASE = '/api/todos';

// Application State
let todos = [];
let currentFilter = 'all';
let searchQuery = '';
let timerInterval = null;
let activeScreen = 'tasks';

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initThreeBackground();
  initFCM();
  loadTodos();
  setupEventListeners();
  setupScreenNavigation();
  startDeadlineTimer();
  checkNotificationStatus();
});

// Initialize Firebase Cloud Messaging (FCM)
function initFCM() {
  initFirebaseMessaging((payload) => {
    // Foreground message handler
    const title = payload.notification ? payload.notification.title : (payload.data ? payload.data.title : 'Poison Alert');
    const body = payload.notification ? payload.notification.body : (payload.data ? payload.data.body : 'Deadline Reached!');
    
    playChime();
    showToast(`${title}: ${body}`);
  });

  const swText = document.getElementById('swStatusText');
  if (swText) swText.textContent = 'Active (FCM & sw.js Registered)';
}

// Multi-Screen Router
function setupScreenNavigation() {
  document.querySelectorAll('[data-screen]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget.dataset.screen;
      if (target) switchScreen(target);
    });
  });

  const fab = document.getElementById('mobileFabBtn');
  if (fab) {
    fab.addEventListener('click', () => switchScreen('create'));
  }
}

function switchScreen(screenName) {
  activeScreen = screenName;

  document.querySelectorAll('.view-screen').forEach(screen => {
    screen.classList.remove('active');
  });

  const activeEl = document.getElementById(`screen-${screenName}`);
  if (activeEl) activeEl.classList.add('active');

  document.querySelectorAll('.nav-tab-btn').forEach(tab => {
    if (tab.dataset.screen === screenName) tab.classList.add('active');
    else tab.classList.remove('active');
  });

  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    if (item.dataset.screen === screenName) item.classList.add('active');
    else item.classList.remove('active');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('poison_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', nextTheme);
  localStorage.setItem('poison_theme', nextTheme);
  
  updateThemeIcon(nextTheme);
  updateThreeTheme(nextTheme);
  showToast(`Switched to ${nextTheme.toUpperCase()} theme`);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  btn.innerHTML = theme === 'dark' 
    ? `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
    : `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
}

// Neon Database API Methods
async function loadTodos() {
  try {
    const res = await fetch(API_BASE);
    if (res.ok) {
      todos = await res.json();
      updateDbStatus(true);
    } else {
      throw new Error('Server returned non-200');
    }
  } catch (err) {
    updateDbStatus(false);
    const saved = localStorage.getItem('poison_todos');
    todos = saved ? JSON.parse(saved) : [];
  }
  render();
}

function updateDbStatus(connected) {
  const pill = document.getElementById('dbStatusPill');
  if (!pill) return;
  if (connected) {
    pill.classList.add('active');
    pill.querySelector('.status-text').textContent = 'Neon DB Connected';
  } else {
    pill.classList.remove('active');
    pill.querySelector('.status-text').textContent = 'Local Cache Mode';
  }
}

// Add Single Task to Neon DB
async function handleAddTodo(e) {
  e.preventDefault();
  const title = document.getElementById('todoTitle').value.trim();
  const category = document.getElementById('todoCategory').value;
  const priority = document.getElementById('todoPriority').value;
  const deadline = document.getElementById('todoDeadline').value;
  const notes = document.getElementById('todoNotes').value.trim();

  if (!title || !deadline) return;

  const newTodo = {
    id: 'task_' + Date.now(),
    title,
    category,
    priority,
    deadlineIso: deadline,
    notes,
    completed: false,
    notified: false
  };

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTodo)
    });
    if (res.ok) {
      const savedTask = await res.json();
      todos.unshift(savedTask);
      showToast('Task saved to Neon Postgres!');
    } else {
      throw new Error('API Error');
    }
  } catch (err) {
    todos.unshift(newTodo);
    localStorage.setItem('poison_todos', JSON.stringify(todos));
    showToast('Saved to local storage');
  }

  render();
  document.getElementById('todoForm').reset();
  switchScreen('tasks');
}

// Bulk CSV / JSON Parser
function handleBulkFileUpload(e) {
  if (e.target.files.length) {
    processFile(e.target.files[0]);
  }
}

function processFile(file) {
  const reader = new FileReader();
  const filename = file.name.toLowerCase();

  reader.onload = async (e) => {
    const text = e.target.result;
    let itemsToUpload = [];

    if (filename.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        itemsToUpload = list.map(normalizeTodo);
      } catch (err) {
        showToast('Invalid JSON file format', true);
        return;
      }
    } else if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
      const lines = text.split(/\r?\n/);
      if (lines.length > 0) {
        const rawHeaders = parseCsvLine(lines[0]);
        const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/[\r\n"']/g, ''));
        
        const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('task') || h.includes('name') || h.includes('todo'));
        const categoryIdx = headers.findIndex(h => h.includes('cat'));
        const priorityIdx = headers.findIndex(h => h.includes('prio'));
        const deadlineIdx = headers.findIndex(h => h.includes('dead') || h.includes('time') || h.includes('date'));
        const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('desc'));

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = parseCsvLine(line);
          
          let titleVal = titleIdx !== -1 && cols[titleIdx] ? cols[titleIdx].trim() : '';
          if (!titleVal && titleIdx === -1 && cols[0]) {
            titleVal = cols[0].trim();
          }

          if (titleVal) {
            const catVal = categoryIdx !== -1 && cols[categoryIdx] ? cols[categoryIdx].trim() : (cols[1] || 'General');
            const prioVal = priorityIdx !== -1 && cols[priorityIdx] ? cols[priorityIdx].trim() : (cols[2] || 'Medium');
            const deadVal = deadlineIdx !== -1 && cols[deadlineIdx] ? cols[deadlineIdx].trim() : cols[3];
            const notesVal = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx].trim() : (cols[4] || '');

            itemsToUpload.push({
              id: 'task_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 3),
              title: titleVal,
              category: catVal || 'General',
              priority: normalizePriority(prioVal),
              deadlineIso: formatDeadline(deadVal),
              notes: notesVal
            });
          }
        }
      }
    }

    if (itemsToUpload.length > 0) {
      try {
        const res = await fetch(`${API_BASE}/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToUpload })
        });
        if (res.ok) {
          showToast(`Imported ${itemsToUpload.length} tasks to Neon Postgres!`);
          await loadTodos();
          switchScreen('tasks');
          return;
        }
      } catch (err) {}

      itemsToUpload.forEach(item => todos.unshift(item));
      localStorage.setItem('poison_todos', JSON.stringify(todos));
      render();
      switchScreen('tasks');
      showToast(`Imported ${itemsToUpload.length} tasks locally`);
    } else {
      showToast('No valid records found in CSV/JSON file', true);
    }
  };

  reader.readAsText(file);
}

function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim().replace(/^["']|["']$/g, ''));
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim().replace(/^["']|["']$/g, ''));
  return result;
}

function normalizePriority(val) {
  if (!val) return 'Medium';
  const v = val.toString().toLowerCase();
  if (v.includes('high') || v.includes('1') || v.includes('urgent')) return 'High';
  if (v.includes('low') || v.includes('3')) return 'Low';
  return 'Medium';
}

function formatDeadline(val) {
  if (!val) return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16) : d.toISOString().slice(0, 16);
}

function normalizeTodo(item) {
  return {
    id: item.id || ('task_' + Date.now()),
    title: item.title || item.Title || 'Untitled Task',
    category: item.category || item.Category || 'General',
    priority: normalizePriority(item.priority || item.Priority),
    deadlineIso: item.deadlineIso || item.deadline || formatDeadline(item.Deadline),
    notes: item.notes || item.Notes || '',
    completed: !!item.completed,
    notified: !!item.notified
  };
}

// Push Notification & FCM Helper
function checkNotificationStatus() {
  const btns = document.querySelectorAll('#btnNotify');
  if ('Notification' in window && Notification.permission === 'granted') {
    btns.forEach(b => {
      b.textContent = 'FCM Notifications Active';
      b.style.opacity = '0.7';
    });
  }
}

async function handleNotificationButton() {
  if (!('Notification' in window)) {
    showToast('Notifications are not supported by your browser', true);
    return;
  }

  const token = await requestFcmToken();
  if (token) {
    checkNotificationStatus();
    showToast('FCM Cloud Push Notifications Active!');
  } else {
    showToast('FCM Token generation failed or blocked', true);
  }
}

// Timer & Notifications
function startDeadlineTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = new Date();

    todos.forEach(t => {
      if (!t.completed && !t.notified) {
        const d = new Date(t.deadlineIso);
        if (now >= d) {
          t.notified = true;
          triggerAlert(t);
        }
      }
    });

    updateCountdowns();
  }, 1000);
}

function triggerAlert(t) {
  playChime();
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`Task Deadline Reached: ${t.title}`, {
      body: t.notes || `Category: ${t.category} | Priority: ${t.priority}`,
      icon: 'https://cdn-icons-png.flaticon.com/512/3602/3602145.png'
    });
  }
  showToast(`Deadline Reached: ${t.title}`, true);
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {}
}

// Setup Listeners
function setupEventListeners() {
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
  document.getElementById('todoForm').addEventListener('submit', handleAddTodo);

  document.querySelectorAll('#btnNotify').forEach(b => {
    b.addEventListener('click', handleNotificationButton);
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    render();
  });

  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      render();
    });
  });

  const fileInput = document.getElementById('bulkFileInput');
  const dropZone = document.getElementById('dropZoneBox');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleBulkFileUpload);

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--border-color)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--border-color)';
    if (e.dataTransfer.files.length) {
      processFile(e.dataTransfer.files[0]);
    }
  });
}

// Rendering Logic
function render() {
  const listEl = document.getElementById('taskList');
  const now = new Date();

  const filtered = todos.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery) && !t.notes.toLowerCase().includes(searchQuery)) {
      return false;
    }
    const d = new Date(t.deadlineIso);
    const isOverdue = !t.completed && now > d;

    if (currentFilter === 'today') return d.toDateString() === now.toDateString();
    if (currentFilter === 'upcoming') return !t.completed && d > now;
    if (currentFilter === 'overdue') return isOverdue;
    if (currentFilter === 'completed') return t.completed;
    return true;
  });

  // Calculate Metrics
  document.getElementById('countTotal').textContent = todos.length;
  document.getElementById('countPending').textContent = todos.filter(t => !t.completed).length;
  document.getElementById('countOverdue').textContent = todos.filter(t => !t.completed && new Date(t.deadlineIso) < now).length;
  document.getElementById('countCompleted').textContent = todos.filter(t => t.completed).length;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-box" style="text-align: center; padding: 40px 20px; background: var(--bg-input); border-radius: 14px; border: 1px dashed var(--border-color);">
        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">No tasks found</div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Switch to Create tab to add your first deadline.</p>
        <button class="btn btn-primary" data-action="goto-create">Create New Task</button>
      </div>
    `;
    listEl.querySelectorAll('[data-action="goto-create"]').forEach(b => {
      b.addEventListener('click', () => switchScreen('create'));
    });
    return;
  }

  listEl.innerHTML = filtered.map(t => {
    const d = new Date(t.deadlineIso);
    const isOverdue = !t.completed && now > d;
    const tagClass = t.priority === 'High' ? 'tag-high' : (t.priority === 'Medium' ? 'tag-med' : 'tag-low');

    return `
      <div class="task-item p-${t.priority} ${isOverdue ? 'overdue' : ''} ${t.completed ? 'completed' : ''}" data-id="${t.id}">
        <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''} data-action="toggle" data-id="${t.id}">
        <div class="task-body">
          <div class="task-top-line">
            <div class="task-title">${escapeHtml(t.title)}</div>
            <div class="badge-row">
              <span class="tag-badge tag-category">${escapeHtml(t.category)}</span>
              <span class="tag-badge ${tagClass}">${t.priority}</span>
            </div>
          </div>
          ${t.notes ? `<div class="task-notes">${escapeHtml(t.notes)}</div>` : ''}
          <div class="task-meta-bar">
            <div>
              ${formatDate(d)}
              <span class="time-badge" data-deadline="${t.deadlineIso}">${getCountdownText(d, t.completed)}</span>
            </div>
            <button class="btn btn-danger-ghost" data-action="delete" data-id="${t.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Event handlers
  listEl.querySelectorAll('[data-action="toggle"]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const task = todos.find(item => item.id === id);
      if (task) {
        task.completed = e.target.checked;
        try {
          await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: task.completed })
          });
        } catch (err) {
          localStorage.setItem('poison_todos', JSON.stringify(todos));
        }
        render();
      }
    });
  });

  listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      todos = todos.filter(t => t.id !== id);
      try {
        await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        showToast('Task deleted from Neon DB');
      } catch (err) {
        localStorage.setItem('poison_todos', JSON.stringify(todos));
        showToast('Task deleted');
      }
      render();
    });
  });
}

function updateCountdowns() {
  document.querySelectorAll('.time-badge').forEach(el => {
    const iso = el.dataset.deadline;
    if (iso) {
      const d = new Date(iso);
      const parent = el.closest('.task-item');
      const isCompleted = parent && parent.classList.contains('completed');
      el.textContent = getCountdownText(d, isCompleted);
    }
  });
}

function getCountdownText(deadline, isCompleted) {
  if (isCompleted) return 'Completed';
  const now = new Date();
  const diffMs = deadline - now;
  if (diffMs <= 0) return 'OVERDUE';
  const mins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) return `In ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `In ${hrs}h ${mins % 60}m`;
  return `In ${mins}m ${Math.floor((diffMs / 1000) % 60)}s`;
}

function formatDate(d) {
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, isError = false) {
  let toast = document.getElementById('toast-notice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.style.background = isError ? 'var(--accent-high)' : 'var(--primary)';
  toast.style.color = '#FFFFFF';
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3500);
}
