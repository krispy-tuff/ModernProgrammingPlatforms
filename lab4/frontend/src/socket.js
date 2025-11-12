import { io } from 'socket.io-client'

// Укажите URL вашего бэкенд-сервера
// eslint-disable-next-line no-undef
const URL = process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3002'

export const socket = io(URL, {
  // Опция autoConnect: false позволяет инициализировать сокет,
  // но не подключаться сразу. Подключение можно будет запустить вручную через socket.connect().
  // Это полезно, если нужно, например, сначала получить токен аутентификации.
  // autoConnect: true,

  // withCredentials необходимо для отправки cookie, если ваш сервер использует их для аутентификации
  withCredentials: true,
})

// Логирование событий для отладки
socket.on('connect', () => {
  console.log('Socket.IO: Подключено к серверу, id:', socket.id)
})

socket.on('disconnect', () => {
  console.log('Socket.IO: Отключено от сервера.')
})

socket.on('connect_error', (err) => {
  console.error('Socket.IO: Ошибка подключения:', err.message)
})
