const STORAGE_KEYS = {
  tasks: "calcmate_tasks_v1",
  notes: "calcmate_notes_v1",
  sessions: "calcmate_sessions_v1"
};
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const notesInput = document.getElementById("notesInput");
const saveNotesButton = document.getElementById("saveNotesButton");
const saveStatus = document.getElementById("saveStatus");
const toast = document.getElementById("toast");

let tasks = readStorage(STORAGE_KEYS.tasks, []);
let sessions = readStorage(STORAGE_KEYS.sessions, 0);
let currentFilter = "all";
let selectedMinutes = 25;
let remainingSeconds = selectedMinutes * 60;
let timerInterval = null;
let timerRunning = false;
let toastTimeout = null;

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn(`Could not read ${key} from localStorage.`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast("Browser storage is unavailable. Your change may not persist.");
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
}

function updateDateLabel() {
  const now = new Date();
  document.getElementById("todayLabel").textContent = now.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric"
  });
}

function saveTasks() {
  writeStorage(STORAGE_KEYS.tasks, tasks);
  renderTasks();
}

function renderTasks() {
  taskList.replaceChildren();
  const visibleTasks = tasks.filter(task => {
    if (currentFilter === "active") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  visibleTasks.forEach(task => {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark "${task.text}" as ${task.completed ? "not completed" : "completed"}`);
    checkbox.addEventListener("change", () => {
      tasks = tasks.map(entry => entry.id === task.id ? { ...entry, completed: checkbox.checked } : entry);
      saveTasks();
    });

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const tag = document.createElement("span");
    tag.className = "task-tag";
    tag.textContent = task.completed ? "Completed" : "To do";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-task";
    remove.textContent = "×";
    remove.title = `Delete task: ${task.text}`;
    remove.setAttribute("aria-label", `Delete task: ${task.text}`);
    remove.addEventListener("click", () => {
      tasks = tasks.filter(entry => entry.id !== task.id);
      saveTasks();
      showToast("Task deleted.");
    });

    item.append(checkbox, text, tag, remove);
    taskList.append(item);
  });

  emptyState.hidden = visibleTasks.length > 0;
  document.getElementById("totalTasks").textContent = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  document.getElementById("completedTasks").textContent = completed;
  document.getElementById("taskCountPill").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;
  const percentage = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  document.getElementById("progressText").textContent = `${percentage}%`;
  document.getElementById("progressBar").style.width = `${percentage}%`;
  document.getElementById("completionCaption").textContent = tasks.length
    ? `${completed} of ${tasks.length} completed`
    : "Every task counts";
}

taskForm.addEventListener("submit", event => {
  event.preventDefault();
  const text = taskInput.value.trim();
  if (!text) {
    showToast("Please enter a task first.");
    taskInput.focus();
    return;
  }
  tasks.unshift({ id: makeId(), text, completed: false, createdAt: new Date().toISOString() });
  taskInput.value = "";
  currentFilter = "all";
  document.querySelectorAll(".filter-button").forEach(button => {
    button.classList.toggle("selected", button.dataset.filter === "all");
  });
  saveTasks();
  showToast("Study task added!");
  taskInput.focus();
});

document.querySelectorAll(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach(other => {
      other.classList.toggle("selected", other === button);
    });
    renderTasks();
  });
});

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Focus timer
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function renderTimer() {
  document.getElementById("timerDisplay").textContent = formatTime(remainingSeconds);
  const totalSeconds = selectedMinutes * 60;
  const elapsed = totalSeconds - remainingSeconds;
  const degrees = totalSeconds ? (elapsed / totalSeconds) * 360 : 0;
  document.getElementById("timerRing").style.background =
    `conic-gradient(var(--blue) ${degrees}deg, #e9edfb ${degrees}deg)`;
  document.getElementById("timerStatus").textContent = timerRunning ? "Stay focused" :
    remainingSeconds === 0 ? "Session complete!" : "Ready to focus";
  document.getElementById("startPauseButton").textContent = timerRunning ? "Ⅱ Pause" : "▶ Start focus";
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    renderTimer();
    return;
  }
  if (remainingSeconds <= 0) remainingSeconds = selectedMinutes * 60;
  timerRunning = true;
  renderTimer();
  timerInterval = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      stopTimer();
      sessions += 1;
      writeStorage(STORAGE_KEYS.sessions, sessions);
      updateSessionsCount();
      renderTimer();
      showToast("Focus session complete — take a short break!");
      // Browser alert is avoided so it won't interrupt the page.
      return;
    }
    renderTimer();
  }, 1000);
}

function resetTimer() {
  stopTimer();
  remainingSeconds = selectedMinutes * 60;
  renderTimer();
}

function updateSessionsCount() {
  document.getElementById("sessionsCount").textContent = sessions;
}

document.getElementById("startPauseButton").addEventListener("click", startTimer);
document.getElementById("resetTimerButton").addEventListener("click", resetTimer);
document.querySelectorAll(".preset-button").forEach(button => {
  button.addEventListener("click", () => {
    stopTimer();
    selectedMinutes = Number(button.dataset.minutes);
    remainingSeconds = selectedMinutes * 60;
    document.querySelectorAll(".preset-button").forEach(other => other.classList.toggle("active", other === button));
    renderTimer();
  });
});

// Quick notes
function loadNotes() {
  const savedNotes = readStorage(STORAGE_KEYS.notes, "");
  notesInput.value = typeof savedNotes === "string" ? savedNotes : "";
}

saveNotesButton.addEventListener("click", () => {
  const saved = writeStorage(STORAGE_KEYS.notes, notesInput.value);
  if (saved) {
    saveStatus.textContent = "Saved just now ✓";
    showToast("Your notes have been saved.");
  }
});

notesInput.addEventListener("input", () => {
  saveStatus.textContent = "Unsaved changes";
});

notesInput.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    saveNotesButton.click();
  }
});

// Navigation highlights the section currently selected.
document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(other => other.classList.toggle("active", other === link));
  });
});

updateDateLabel();
renderTasks();
updateSessionsCount();
loadNotes();
renderTimer();
