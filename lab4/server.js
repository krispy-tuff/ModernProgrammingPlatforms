const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRouter = require("./routes/auth");
const tasksRouter = require("./routes/tasks");
const authMiddleware = require("./authMiddleware");

const jwt = require("jsonwebtoken");
// helper: извлечь cookie по имени из строки cookie header
function getCookieFromHeader(cookieHeader, name) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const c of cookies) {
    const [k, v] = c.split("=");
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3002;

// Настройка CORS для Express
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "frontend", "dist")));

// Папки для загрузок и данных
const uploadsDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
const dataPath = path.join(dataDir, "db.json");

// Инициализация папок и файлов
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataPath)) {
  fs.writeFileSync(dataPath, JSON.stringify({ tasks: [], users: [] }, null, 2));
}

// --- Вспомогательные функции для работы с БД ---
function readDb() {
  try {
    const data = fs.readFileSync(dataPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Ошибка чтения файла базы данных:", error);
    return { tasks: [], users: [] };
  }
}

function writeDb(db) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error("Ошибка записи файла базы данных:", error);
  }
}

function readTasks() {
  return readDb().tasks;
}

function writeTasks(tasks) {
  const db = readDb();
  db.tasks = tasks;
  writeDb(db);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- Логика Socket.IO ---
io.on("connection", (socket) => {
  console.log("Клиент подключился (socket.id):", socket.id);

  // Попытаться извлечь токен из handshake headers (cookie)
  const cookieHeader = socket.handshake.headers.cookie;
  const token = getCookieFromHeader(cookieHeader, "access_token");

  if (!token) {
    // неаутентифицированный сокет — просто отключаем, или можно оставить, но не давать действий
    console.log("Socket without token, disconnecting", socket.id);
    socket.emit("unauthorized");
    socket.disconnect(true);
    return;
  }

  // верифицируем токен
  let payload;
  try {
    payload = jwt.verify(token, "123123");
  } catch (err) {
    console.log("Invalid token on socket handshake:", err.message);
    socket.emit("unauthorized");
    socket.disconnect(true);
    return;
  }

  const userId = payload.id ?? payload.userId;
  if (!userId) {
    console.log("Token has no user id, disconnecting", socket.id);
    socket.emit("unauthorized");
    socket.disconnect(true);
    return;
  }

  // сохраняем userId на сокете и подписываем на комнату user_<id>
  socket.userId = String(userId);
  const room = `user_${socket.userId}`;
  socket.join(room);
  console.log(`Socket ${socket.id} joined room ${room}`);

  // Отправляем только задачи этого пользователя
  const allTasks = readTasks();
  const userTasks = allTasks.filter(
    (t) => String(t.userId) === String(socket.userId)
  );
  socket.emit("tasks_updated", userTasks);

  // === события: create/update/delete, все работают только для authenticated socket ===

  socket.on("create_task", (newTaskData) => {
    // безопасность: проверяем наличие userId на сокете
    if (!socket.userId) {
      socket.emit("unauthorized");
      return;
    }

    const tasks = readTasks();
    const newTask = {
      id: generateId(),
      userId: String(socket.userId),
      title: newTaskData.title,
      description: newTaskData.description || "",
      status: newTaskData.status || "todo",
      dueDate: newTaskData.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [], // файловая логика позже
    };
    tasks.push(newTask);
    writeTasks(tasks);

    // пришлём обновление только пользователю (в комнату)
    const updatedForUser = tasks.filter(
      (t) => String(t.userId) === String(socket.userId)
    );
    io.to(room).emit("tasks_updated", updatedForUser);
  });

  socket.on("update_task", (updatedTaskData) => {
    if (!socket.userId) {
      socket.emit("unauthorized");
      return;
    }
    const tasks = readTasks();
    const idx = tasks.findIndex((t) => t.id === updatedTaskData.id);
    if (idx === -1) {
      socket.emit("error", { message: "Task not found" });
      return;
    }
    const task = tasks[idx];
    if (String(task.userId) !== String(socket.userId)) {
      socket.emit("error", { message: "Forbidden" });
      return;
    }

    // Обновляем безопасно — не перезаписываем userId
    tasks[idx] = {
      ...task,
      title: updatedTaskData.title ?? task.title,
      description: updatedTaskData.description ?? task.description,
      status: updatedTaskData.status ?? task.status,
      dueDate:
        updatedTaskData.dueDate !== undefined
          ? updatedTaskData.dueDate
          : task.dueDate,
      updatedAt: new Date().toISOString(),
      // attachments пока не меняем
      attachments: task.attachments || [],
    };

    writeTasks(tasks);

    const updatedForUser = tasks.filter(
      (t) => String(t.userId) === String(socket.userId)
    );
    io.to(room).emit("tasks_updated", updatedForUser);
  });

  socket.on("delete_task", (taskId) => {
    if (!socket.userId) {
      socket.emit("unauthorized");
      return;
    }
    let tasks = readTasks();
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) {
      socket.emit("error", { message: "Task not found" });
      return;
    }
    const task = tasks[idx];
    if (String(task.userId) !== String(socket.userId)) {
      socket.emit("error", { message: "Forbidden" });
      return;
    }

    // удаляем task и сохраняем
    tasks.splice(idx, 1);
    writeTasks(tasks);

    const updatedForUser = tasks.filter(
      (t) => String(t.userId) === String(socket.userId)
    );
    io.to(room).emit("tasks_updated", updatedForUser);
  });

  socket.on("disconnect", () => {
    console.log("Клиент отключился:", socket.id);
  });
});

// Маршруты API (остаются только для аутентификации)
app.use("/api/auth", authRouter);
app.use("/api", authMiddleware, tasksRouter); // Маршруты задач теперь через сокеты

// Отдаем SPA (Vue) на все остальные запросы
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

// Обработка 404 для API
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ message: "Эндпоинт не найден" });
  }
  next();
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Ошибка на стороне сервера",
    error: err.message,
  });
});

httpServer.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT} в браузере`);
});
