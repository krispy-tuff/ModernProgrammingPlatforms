<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { socket } from './socket' // Импортируем сокет
import api from './api' // Импортируем обновленный API

import AppHeader from './components/AppHeader.vue'
import TaskFilters from './components/TaskFilters.vue'
import TaskList from './components/TaskList.vue'
import TaskModal from './components/TaskModal.vue'
import LoginForm from './components/LoginForm.vue'

// --- Auth State ---
const isAuthenticated = ref(false)

// --- Main state ---
const tasks = ref([])
const showTaskModal = ref(false)
const currentEditingTask = ref(null)

// --- Filters state ---
const searchQuery = ref('')
const statusFilter = ref('all')
const sortBy = ref('createdAt_desc')

// Computed property for filtered and sorted tasks
const filteredAndSortedTasks = computed(() => {
  let result = [...tasks.value]
  if (statusFilter.value !== 'all') {
    result = result.filter((task) => task.status === statusFilter.value)
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query)),
    )
  }
  result.sort((a, b) => {
    const [key, order] = sortBy.value.split('_')
    const valA = a[key] || ''
    const valB = b[key] || ''
    if (valA < valB) return order === 'asc' ? -1 : 1
    if (valA > valB) return order === 'asc' ? 1 : -1
    return 0
  })
  return result
})

// --- Socket & API Logic ---

// --- helpers: ожидать следующее tasks_updated и вернуть список задач ---
function waitForNextTasksUpdate(timeout = 5000) {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      socket.off('tasks_updated', onUpdate)
      reject(new Error('timeout waiting for tasks_updated'))
    }, timeout)

    function onUpdate(serverTasks) {
      clearTimeout(timer)
      socket.off('tasks_updated', onUpdate)
      resolve(serverTasks)
    }

    socket.on('tasks_updated', onUpdate)
  })
}

// --- helper: загрузить файлы и удалить вложения через REST API ---
async function uploadAttachmentsForTask(taskId, files = [], attachmentsToDelete = []) {
  // если нечего делать — сразу возврат
  if (
    (!files || files.length === 0) &&
    (!attachmentsToDelete || attachmentsToDelete.length === 0)
  ) {
    return { added: [], deleted: [] }
  }

  const formData = new FormData()
  // файлы
  if (files && files.length) {
    files.forEach((f) => formData.append('attachments', f))
  }
  // удалить указанные вложения
  if (attachmentsToDelete && attachmentsToDelete.length) {
    formData.append('attachmentsToDelete', JSON.stringify(attachmentsToDelete))
  }

  // используем api.http.fetch если он есть; добавляем credentials
  const fetchFn = api && api.http && typeof api.http.fetch === 'function' ? api.http.fetch : fetch

  const res = await fetchFn(`/api/tasks/${encodeURIComponent(taskId)}/attachments`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  return res
}

async function handleAddTask({ task, files = [], attachmentsToDelete = [] }) {
  try {
    // сохраняем текущие ids, чтобы найти новые после обновления
    const beforeIds = new Set(tasks.value.map((t) => t.id))

    // отправляем создание задачи по сокету (сервер создаст задачу и пришлёт tasks_updated)
    api.createTask({
      title: task.title,
      description: task.description || '',
      status: task.status || 'todo',
      dueDate: task.dueDate || null,
    })

    // ждём следующего обновления задач
    const serverTasks = await waitForNextTasksUpdate(7000).catch((err) => {
      console.error('Не дождались tasks_updated после create_task:', err)
      return null
    })

    closeModal()
    if (!serverTasks) {
      return
    }

    // находим новые задачи (те, которых не было до)
    const newTasks = serverTasks.filter((t) => !beforeIds.has(t.id))

    // если ничего нового не найдено, берём самую недавнюю задачу как fallback
    const created = newTasks.length
      ? newTasks[0]
      : serverTasks.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))

    // если есть файлы или есть удаляемые вложения - вызываем REST endpoint для attachments
    if ((files && files.length) || (attachmentsToDelete && attachmentsToDelete.length)) {
      const res = await uploadAttachmentsForTask(created.id, files, attachmentsToDelete)
      if (res.status === 401) {
        handleUnauthorized()
        return
      }
      if (!res.ok && res.status !== 200 && res.status !== 201) {
        console.error('Ошибка при загрузке вложений:', await res.text())
      }
      // сервер по POST /attachments эмитит tasks_updated внутри роутера, так что список обновится
      // ждём обновления (необязательно, но безопасно)
      await waitForNextTasksUpdate(5000).catch(() => {})
    }
  } catch (err) {
    console.error('Ошибка при добавлении задачи:', err)
    closeModal()
  }
}

async function handleUpdateTask({ task, files = [], attachmentsToDelete = [] }) {
  try {
    // отправляем обновление задачи по сокету (сервер обновит и пришлёт tasks_updated)
    api.updateTask({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate || null,
    })

    // ждём подтверждения изменения (tasks_updated)
    await waitForNextTasksUpdate(7000).catch((err) => {
      console.warn('Не дождались tasks_updated после update_task:', err)
    })

    // теперь обрабатываем вложения через REST (если есть)
    if ((files && files.length) || (attachmentsToDelete && attachmentsToDelete.length)) {
      const res = await uploadAttachmentsForTask(task.id, files, attachmentsToDelete)
      if (res.status === 401) {
        handleUnauthorized()
        return
      }
      if (!res.ok && res.status !== 200 && res.status !== 201) {
        console.error('Ошибка при обновлении вложений:', await res.text())
      } else {
        // ждать обновления списка от сервера (attachments route эмитит tasks_updated)
        await waitForNextTasksUpdate(5000).catch(() => {})
      }
    }

    closeModal()
  } catch (err) {
    console.error('Ошибка при обновлении задачи:', err)
    closeModal()
  }
}

function handleUpdateStatus(updatedTask) {
  api.updateTask({ id: updatedTask.id, status: updatedTask.status })
}

function handleDeleteTask(taskId) {
  if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return
  api.deleteTask(taskId)
}

// --- Modal Control ---
function openAddTaskModal() {
  currentEditingTask.value = null
  showTaskModal.value = true
}

function openEditModal(task) {
  currentEditingTask.value = task
  showTaskModal.value = true
}

function closeModal() {
  showTaskModal.value = false
}

async function handleLogout() {
  try {
    await api.http.fetch('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    console.error('Ошибка при выходе:', error)
  } finally {
    isAuthenticated.value = false
    tasks.value = []
    if (socket.connected) socket.disconnect()
  }
}

// --- Auth Handling ---
async function checkAuthStatus() {
  try {
    const res = await api.http.fetch('/api/auth/status')
    if (res.ok) {
      const data = await res.json()
      if (data.isAuthenticated) {
        isAuthenticated.value = true
      }
    } else {
      isAuthenticated.value = false
    }
  } catch (e) {
    isAuthenticated.value = false
  }
}

function handleLoginSuccess() {
  isAuthenticated.value = true
  if (socket.connected) socket.disconnect()
  socket.connect()
  // Задачи теперь придут по сокету, ничего не вызываем
}

function handleUnauthorized() {
  isAuthenticated.value = false
  tasks.value = [] // Очищаем задачи
}

// --- Lifecycle & Socket Listeners ---
onMounted(() => {
  window.addEventListener('unauthorized', handleUnauthorized)
  checkAuthStatus()

  // Слушаем обновления задач от сервера
  socket.on('tasks_updated', (serverTasks) => {
    tasks.value = serverTasks.map((task) => ({ ...task, expanded: false }))
  })

  // Если сокет переподключился, сервер автоматически пришлет актуальный список
  socket.on('connect', () => {
    console.log('Переподключились к серверу, ожидаем задачи...')
  })
})

onUnmounted(() => {
  window.removeEventListener('unauthorized', handleUnauthorized)
  // Отключаем слушатели, чтобы избежать утечек памяти
  socket.off('tasks_updated')
  socket.off('connect')
})
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
