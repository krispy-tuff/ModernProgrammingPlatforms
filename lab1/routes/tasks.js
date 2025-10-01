const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db/db");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Список задач + фильтр по статусу
router.get("/", async (req, res) => {
  const status = req.query.status || null;
  const tasks = await db.getTasks({ status });

  // Вложения к каждой задаче
  for (const task of tasks) {
    task.attachments = await db.getAttachmentsByTask(task.id);
  }

  res.render("tasks/index", { tasks, status });
});

// Форма создания задачи
router.get("/new", (req, res) => {
  res.render("tasks/new");
});

// Создание задачи + вложения
router.post("/", upload.array("attachments"), async (req, res) => {
  const { title, description, status, due_date } = req.body;
  const result = await db.createTask({ title, description, status, due_date });
  const taskId = result.lastID;

  if (req.files && req.files.length) {
    for (const f of req.files) {
      await db.addAttachment(taskId, {
        filename: f.filename,
        original_name: f.originalname,
        content_type: f.mimetype,
      });
    }
  }

  res.redirect("/tasks");
});

// Форма редактирования
router.get("/:id/edit", async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id); // подтягиваем задачу
    if (!task) return res.status(404).send("Task not found");

    // подтягиваем вложения
    task.attachments = await db.getAttachmentsByTask(task.id);

    res.render("tasks/edit", { task });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Обновление задачи
router.put("/:id", upload.array("attachments"), async (req, res) => {
  const { title, description, status, due_date } = req.body;
  await db.updateTask(req.params.id, { title, description, status, due_date });

  // сохраняем новые вложения
  if (req.files && req.files.length) {
    for (const f of req.files) {
      await db.addAttachment(req.params.id, {
        filename: f.filename,
        original_name: f.originalname,
        content_type: f.mimetype,
      });
    }
  }

  res.redirect(`/tasks/${req.params.id}/edit`);
});

// Удаление задачи
router.delete("/:id", async (req, res) => {
  await db.deleteTask(req.params.id);
  res.redirect("/tasks");
});

// Скачивание вложения
router.get("/:id/attachments/:aid", async (req, res) => {
  const { id, aid } = req.params;
  const attachment = await db.getAttachmentById(aid);

  if (!attachment || attachment.task_id != id) {
    return res.status(404).send("Attachment not found");
  }

  const filePath = path.join(__dirname, "../uploads", attachment.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File missing on server");
  }

  res.download(filePath, attachment.original_name);
});

// Удаление вложения
router.delete("/:id/attachments/:aid", async (req, res) => {
  const { id, aid } = req.params;
  const attachment = await db.getAttachmentById(aid);

  if (!attachment || attachment.task_id != id) {
    return res.status(404).send("Attachment not found");
  }

  // удаление файла с диска
  const filePath = path.join(__dirname, "../uploads", attachment.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // удаление из БД
  await db.deleteAttachment(aid);

  res.redirect(`/tasks/${id}/edit`);
});

module.exports = router;
