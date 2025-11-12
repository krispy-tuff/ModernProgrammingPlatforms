import { socket } from './socket'

// Функции для отправки событий на сервер через сокеты

/**
 * Запрашивает создание новой задачи.
 * @param {object} taskData - Данные новой задачи (title, description, status, dueDate).
 */
function createTask(taskData) {
  // Обработка файлов здесь не реализована для простоты.
  // В реальном приложении для загрузки файлов может потребоваться отдельный HTTP-эндпоинт.
  socket.emit('create_task', taskData)
}

/**
 * Запрашивает обновление существующей задачи.
 * @param {object} taskData - Обновленные данные задачи. Должен содержать `id`.
 */
function updateTask(taskData) {
  socket.emit('update_task', taskData)
}

/**
 * Запрашивает удаление задачи.
 * @param {string} taskId - ID задачи для удаления.
 */
function deleteTask(taskId) {
  socket.emit('delete_task', taskId)
}

// Для аутентификации и загрузки файлов пока оставим стандартный fetch,
// так как это более типичный сценарий для этих операций.
const http = {
  async fetch(url, options = {}) {
    const response = await fetch(url, options)
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('unauthorized'))
      throw new Error('Unauthorized')
    }
    return response
  },
}

export default {
  createTask,
  updateTask,
  deleteTask,
  http, // Экспортируем и старый http-клиент для логина/логаута
}
