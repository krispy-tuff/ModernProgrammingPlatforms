<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import AppHeader from "./components/AppHeader.vue";
import TaskFilters from "./components/TaskFilters.vue";
import TaskList from "./components/TaskList.vue";
import TaskModal from "./components/TaskModal.vue";
import LoginForm from "./components/LoginForm.vue"; // Импортируем компонент входа
import api from "./api"; // Импортируем обертку API

// --- Auth State ---
const isAuthenticated = ref(false);

// --- Main state ---
const tasks = ref([]);
const showTaskModal = ref(false);
const currentEditingTask = ref(null);

// --- Filters state ---
const searchQuery = ref("");
const statusFilter = ref("all");
const sortBy = ref("createdAt_desc");

// Computed property for filtered and sorted tasks
const filteredAndSortedTasks = computed(() => {
  let result = [...tasks.value];
  if (statusFilter.value !== "all") {
    result = result.filter((task) => task.status === statusFilter.value);
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
    );
  }
  result.sort((a, b) => {
    const [key, order] = sortBy.value.split("_");
    const valA = a[key] || "";
    const valB = b[key] || "";
    if (valA < valB) return order === "asc" ? -1 : 1;
    if (valA > valB) return order === "asc" ? 1 : -1;
    return 0;
  });
  return result;
});

// --- API Logic ---

async function fetchTasks() {
  try {
    const response = await fetch("/api/tasks", { credentials: "include" });
    if (!response.ok) throw new Error("Failed to fetch");
    const data = await response.json();
    tasks.value = data.map((task) => ({ ...task, expanded: false }));
    isAuthenticated.value = true; // Если задачи загрузились, пользователь аутентифицирован
  } catch (error) {
    console.error("Ошибка при загрузке задач:", error);
    if (error.message === "Unauthorized") {
      isAuthenticated.value = false;
    }
  }
}

async function handleAddTask({ task, files }) {
  const formData = new FormData();
  formData.append("title", task.title);
  formData.append("description", task.description);
  formData.append("dueDate", task.dueDate);
  formData.append("status", task.status);
  files.forEach((file) => {
    formData.append("attachments", file);
  });

  try {
    const response = await api.fetch("/api/tasks", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const newlyCreatedTask = await response.json();
    tasks.value.push({ ...newlyCreatedTask, expanded: false });
    closeModal();
  } catch (error) {
    console.error("Ошибка при добавлении задачи:", error);
  }
}

async function handleUpdateTask({ task, files, attachmentsToDelete }) {
  // 1. Delete attachments marked for deletion
  if (attachmentsToDelete && attachmentsToDelete.length > 0) {
    for (const attachmentId of attachmentsToDelete) {
      try {
        await api.fetch(`/api/attachments/${attachmentId}`, {
          method: "DELETE",
        });
        const taskInState = tasks.value.find((t) => t.id === task.id);
        if (taskInState) {
          taskInState.attachments = taskInState.attachments.filter(
            (a) => a.id !== attachmentId
          );
        }
      } catch (error) {
        console.error("Ошибка при удалении вложения:", error);
      }
    }
  }

  // 2. Update text data
  try {
    const response = await api.fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    const updatedTask = await response.json();
    const index = tasks.value.findIndex((t) => t.id === updatedTask.id);
    if (index !== -1) {
      updatedTask.attachments = tasks.value[index].attachments;
      updatedTask.expanded = tasks.value[index].expanded;
      tasks.value[index] = updatedTask;
    }
  } catch (error) {
    console.error("Ошибка при обновлении задачи:", error);
  }

  // 3. Upload new files if any
  if (files.length > 0) {
    const fileData = new FormData();
    files.forEach((file) => {
      fileData.append("attachments", file);
    });
    try {
      const response = await api.fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        body: fileData,
      });
      const newAttachments = await response.json();
      const taskInList = tasks.value.find((t) => t.id === task.id);
      if (taskInList) {
        if (!taskInList.attachments) taskInList.attachments = [];
        taskInList.attachments.push(...newAttachments);
      }
    } catch (error) {
      console.error("Ошибка при добавлении файлов:", error);
    }
  }
  closeModal();
}

async function handleUpdateStatus(updatedTask) {
  try {
    await api.fetch(`/api/tasks/${updatedTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: updatedTask.status }),
    });
    const index = tasks.value.findIndex((t) => t.id === updatedTask.id);
    if (index !== -1) {
      tasks.value[index].status = updatedTask.status;
    }
  } catch (error) {
    console.error("Ошибка при обновлении статуса:", error);
  }
}

async function handleDeleteTask(taskId) {
  if (!confirm("Вы уверены, что хотите удалить эту задачу?")) return;
  try {
    await api.fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    tasks.value = tasks.value.filter((t) => t.id !== taskId);
  } catch (error) {
    console.error("Ошибка при удалении задачи:", error);
  }
}

// --- Modal Control ---
function openAddTaskModal() {
  currentEditingTask.value = null;
  showTaskModal.value = true;
}

function openEditModal(task) {
  currentEditingTask.value = task;
  showTaskModal.value = true;
}

function closeModal() {
  showTaskModal.value = false;
}

async function handleLogout() {
  try {
    await api.fetch("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Ошибка при выходе:", error);
  } finally {
    isAuthenticated.value = false;
    tasks.value = [];
  }
}

// --- Auth Handling ---
function handleLoginSuccess() {
  isAuthenticated.value = true;
  fetchTasks(); // Загружаем задачи после успешного входа
}

function handleUnauthorized() {
  isAuthenticated.value = false;
  tasks.value = []; // Очищаем задачи
}

// --- Lifecycle ---
onMounted(() => {
  window.addEventListener("unauthorized", handleUnauthorized);
  fetchTasks(); // Пробуем загрузить задачи при старте
});

onUnmounted(() => {
  window.removeEventListener("unauthorized", handleUnauthorized);
});
</script>

<template>
  <div id="app">
    <template v-if="isAuthenticated">
      <AppHeader @add-task="openAddTaskModal" @logout="handleLogout" />
      <main class="container">
        <TaskFilters
          v-model:searchQuery="searchQuery"
          v-model:statusFilter="statusFilter"
          v-model:sortBy="sortBy"
        />
        <TaskList
          :tasks="filteredAndSortedTasks"
          @update-task-status="handleUpdateStatus"
          @edit-task="openEditModal"
          @delete-task="handleDeleteTask"
        />
      </main>
      <TaskModal
        :show="showTaskModal"
        :task-to-edit="currentEditingTask"
        @close="closeModal"
        @add-task="handleAddTask"
        @update-task="handleUpdateTask"
      />
    </template>
    <template v-else>
      <LoginForm @success="handleLoginSuccess" />
    </template>
  </div>
</template>
