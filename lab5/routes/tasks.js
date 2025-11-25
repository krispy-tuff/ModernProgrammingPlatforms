const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { body, validationResult } = require("express-validator");

const router = express.Router();
const dataPath = path.join(__dirname, "..", "data", "db.json");
const uploadsDir = path.join(__dirname, "..", "uploads");

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    const safeName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, safeName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// --- Вспомогательные функции ---
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

function getTasksForUser(uid) {
  tasks = readTasks();
  return tasks.filter((t) => String(t.userId) === String(uid));
}

// --- Эндпоинты API ---

// GET /api/tasks - Получить все задачи
router.get("/tasks", (req, res) => {
  const tasks = getTasksForUser(req.userId);
  res.json(tasks);
});

// GET /api/tasks/:id - Получить задачу по ID
router.get("/tasks/:id", (req, res) => {
  const tasks = getTasksForUser(req.userId);
  const task = tasks.find((t) => t.id === req.params.id);
  if (task) {
    res.json(task);
  } else {
    res.status(404).json({ message: "Задача не найдена" });
  }
});

// POST /api/tasks - Создать новую задачу
router.post(
  "/tasks",
  upload.array("attachments", 10),
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Название задачи обязательно"),
    body("status")
      .isIn(["pending", "in_progress", "completed", "cancelled"])
      .withMessage("Неверный статус"),
    body("dueDate").optional().isISO8601().withMessage("Неверный формат даты"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tasks = readTasks();
    const newTask = {
      id: generateId(),
      userId: req.userId,
      title: req.body.title,
      description: req.body.description || "",
      status: req.body.status,
      dueDate: req.body.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: req.files
        ? req.files.map((file) => ({
            id: generateId(),
            filename: file.filename,
            originalName: file.originalname,
            path: `/uploads/${file.filename}`,
            uploadedAt: new Date().toISOString(),
          }))
        : [],
    };

    tasks.push(newTask);
    writeTasks(tasks);
    res.status(201).json(newTask);
  }
);

// PUT /api/tasks/:id - Полностью обновить задачу
router.put(
  "/tasks/:id",
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Название задачи обязательно"),
    body("status")
      .isIn(["pending", "in_progress", "completed", "cancelled"])
      .withMessage("Неверный статус"),
    body("dueDate").optional().isISO8601().withMessage("Неверный формат даты"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === req.params.id);

    if (taskIndex === -1) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    if (String(tasks[taskIndex].userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedTask = {
      ...tasks[taskIndex],
      title: req.body.title,
      description: req.body.description || "",
      status: req.body.status,
      dueDate: req.body.dueDate || null,
      updatedAt: new Date().toISOString(),
    };

    tasks[taskIndex] = updatedTask;
    writeTasks(tasks);
    res.json(updatedTask);
  }
);

// PATCH /api/tasks/:id - Частично обновить задачу (например, статус)
router.patch("/tasks/:id", (req, res) => {
  const tasks = readTasks();
  const taskIndex = tasks.findIndex((t) => t.id === req.params.id);

  if (taskIndex === -1) {
    return res.status(404).json({ message: "Задача не найдена" });
  }

  const task = tasks[taskIndex];

  if (String(task.userId) !== String(req.userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { title, description, status, dueDate } = req.body;

  if (title) task.title = title;
  if (description) task.description = description;
  if (status) task.status = status;
  if (dueDate) task.dueDate = dueDate;
  task.updatedAt = new Date().toISOString();

  tasks[taskIndex] = task;
  writeTasks(tasks);
  res.json(task);
});

// DELETE /api/tasks/:id - Удалить задачу
router.delete("/tasks/:id", (req, res) => {
  const tasks = readTasks();
  const taskIndex = tasks.findIndex((t) => t.id === req.params.id);

  if (taskIndex === -1) {
    return res.status(404).json({ message: "Задача не найдена" });
  }

  if (String(tasks[taskIndex].userId) !== String(req.userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  // Удаляем связанные файлы
  tasks[taskIndex].attachments.forEach((attachment) => {
    const filePath = path.join(uploadsDir, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  tasks.splice(taskIndex, 1);
  writeTasks(tasks);
  res.status(204).send(); // No Content
});

// POST /api/tasks/:id/attachments - Добавить вложения к задаче
router.post(
  "/tasks/:id/attachments",
  upload.array("attachments", 10),
  (req, res) => {
    const tasks = readTasks();
    const taskIndex = tasks.findIndex((t) => t.id === req.params.id);

    if (taskIndex === -1) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    if (String(tasks[taskIndex].userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Файлы не были загружены" });
    }

    const newAttachments = req.files.map((file) => ({
      id: generateId(),
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${file.filename}`,
      uploadedAt: new Date().toISOString(),
    }));

    tasks[taskIndex].attachments.push(...newAttachments);
    tasks[taskIndex].updatedAt = new Date().toISOString();
    writeTasks(tasks);

    res.status(201).json(newAttachments);
  }
);

// DELETE /api/attachments/:id - Удалить вложение
router.delete("/attachments/:id", (req, res) => {
  const tasks = getTasksForUser(req.userId);
  let attachmentToDelete = null;
  let taskOfAttachment = null;

  for (const task of tasks) {
    const attachment = task.attachments.find((a) => a.id === req.params.id);
    if (attachment) {
      attachmentToDelete = attachment;
      taskOfAttachment = task;
      break;
    }
  }

  if (!attachmentToDelete) {
    return res.status(404).json({ message: "Вложение не найдено" });
  }

  // Удаляем файл с диска
  const filePath = path.join(uploadsDir, attachmentToDelete.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Удаляем запись о файле из задачи
  taskOfAttachment.attachments = taskOfAttachment.attachments.filter(
    (a) => a.id !== req.params.id
  );
  taskOfAttachment.updatedAt = new Date().toISOString();

  writeTasks(tasks);
  res.status(204).send(); // No Content
});

module.exports = router;
