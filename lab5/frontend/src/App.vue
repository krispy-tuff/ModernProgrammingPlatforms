<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import AppHeader from './components/AppHeader.vue';
import TaskFilters from './components/TaskFilters.vue';
import TaskList from './components/TaskList.vue';
import TaskModal from './components/TaskModal.vue';
import LoginForm from './components/LoginForm.vue'; // Импортируем компонент входа
import api from './api'; // Импортируем обертку API

// --- Auth State ---
const isAuthenticated = ref(false);

// --- Main state ---
const tasks = ref([]);
const showTaskModal = ref(false);
const currentEditingTask = ref(null);

// --- Filters state ---
const searchQuery = ref('');
const statusFilter = ref('all');
const sortBy = ref('createdAt_desc');

// Computed property for filtered and sorted tasks
const filteredAndSortedTasks = computed(() => {
  let result = [...tasks.value];
  if (statusFilter.value !== 'all') {
    result = result.filter(task => task.status === statusFilter.value);
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(task =>
      task.title.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query))
    );
  }
  result.sort((a, b) => {
    const [key, order] = sortBy.value.split('_');
    const valA = a[key] || '';
    const valB = b[key] || '';
    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });
  return result;
});

// --- API Logic ---

async function fetchTasks() {
  try {
    const data = await api.graphql(`
      query {
        tasks { id title description status dueDate createdAt updatedAt attachments { id filename originalName path uploadedAt } }
      }
    `);
    tasks.value = data.tasks.map(task => ({ ...task, expanded: false }));
    isAuthenticated.value = true; // Если задачи загрузились, пользователь аутентифицирован
  } catch (error) {
    console.error('Ошибка при загрузке задач:', error);
    if (error.message === 'Unauthorized') {
      isAuthenticated.value = false;
    }
  }
}

async function handleAddTask({ task, files }) {
  try {
    const data = await api.graphql(`
      mutation CreateTask($input: TaskInput!) {
        createTask(input: $input) { id title description status dueDate createdAt updatedAt attachments { id } }
      }
    `, { input: { title: task.title, description: task.description, dueDate: task.dueDate, status: task.status } });
    const newlyCreatedTask = data.createTask;
    tasks.value.push({ ...newlyCreatedTask, expanded: false });
    // upload files via REST bridge if needed
    if (files && files.length > 0) {
      const fd = new FormData();
      files.forEach(f => fd.append('attachments', f));
      await api.fetch(`/api/tasks/${newlyCreatedTask.id}/attachments`, { method: 'POST', body: fd });
      await fetchTasks();
    }
    closeModal();
  } catch (error) {
    console.error('Ошибка при добавлении задачи:', error);
  }
}

async function handleUpdateTask({ task, files, attachmentsToDelete }) {
  // 1. Delete attachments marked for deletion
  if (attachmentsToDelete && attachmentsToDelete.length > 0) {
    for (const attachmentId of attachmentsToDelete) {
      try {
        await api.fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
        const taskInState = tasks.value.find(t => t.id === task.id);
        if (taskInState) {
          taskInState.attachments = taskInState.attachments.filter(a => a.id !== attachmentId);
        }
      } catch (error) {
        console.error('Ошибка при удалении вложения:', error);
      }
    }
  }

  // 2. Update text data
  try {
    const data = await api.graphql(`
      mutation UpdateTask($id: ID!, $input: TaskInput!) {
        updateTask(id: $id, input: $input) { id title description status dueDate updatedAt }
      }
    `, { id: task.id, input: { title: task.title, description: task.description, dueDate: task.dueDate, status: task.status } });
    const updatedTask = data.updateTask;
    const index = tasks.value.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
      updatedTask.attachments = tasks.value[index].attachments;
      updatedTask.expanded = tasks.value[index].expanded;
      tasks.value[index] = updatedTask;
    }
  } catch (error) {
    console.error('Ошибка при обновлении задачи:', error);
  }

  // 3. Upload new files if any
  if (files.length > 0) {
    const fileData = new FormData();
    files.forEach(file => {
      fileData.append('attachments', file);
    });
    try {
      const response = await api.fetch(`/api/tasks/${task.id}/attachments`, { method: 'POST', body: fileData });
      const newAttachments = await response.json();
      const taskInList = tasks.value.find(t => t.id === task.id);
      if (taskInList) {
        if (!taskInList.attachments) taskInList.attachments = [];
        taskInList.attachments.push(...newAttachments);
      }
    } catch (error) {
      console.error('Ошибка при добавлении файлов:', error);
    }
  }
  closeModal();
}

async function handleUpdateStatus(updatedTask) {
  try {
    const data = await api.graphql(`
      mutation PatchTask($id: ID!, $input: TaskUpdateInput!) {
        patchTask(id: $id, input: $input) { id status }
      }
    `, { id: updatedTask.id, input: { status: updatedTask.status } });
    const index = tasks.value.findIndex(t => t.id === updatedTask.id);
    if (index !== -1) {
      tasks.value[index].status = data.patchTask.status;
    }
  } catch (error) {
    console.error('Ошибка при обновлении статуса:', error);
  }
}

async function handleDeleteTask(taskId) {
  if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;
  try {
    await api.graphql(`
      mutation DeleteTask($id: ID!) { deleteTask(id: $id) }
    `, { id: taskId });
    tasks.value = tasks.value.filter(t => t.id !== taskId);
  } catch (error) {
    console.error('Ошибка при удалении задачи:', error);
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
    await api.graphql(`mutation { logout { message } }`);
  } catch (error) {
    console.error('Ошибка при выходе:', error);
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
  window.addEventListener('unauthorized', handleUnauthorized);
  fetchTasks(); // Пробуем загрузить задачи при старте
});

onUnmounted(() => {
  window.removeEventListener('unauthorized', handleUnauthorized);
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