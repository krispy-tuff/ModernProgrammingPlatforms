// routes/tasks.js
const express = require("express");
const router = express.Router();
const db = require("../db/db");
const multer = require("multer");
const path = require("path");

// Настройка multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ==================== CRUD для задач ====================

// Получить все задачи
router.get("/", async (req, res) => {
  try {
    const tasks = await db.getTasks();
    for (const task of tasks) {
      task.attachments = await db.getAttachmentsByTask(task.id);
    }
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Ошибка при получении задач" });
  }
});

// Получить задачу по ID
router.get("/:id", async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: "Задача не найдена" });

    task.attachments = await db.getAttachmentsByTask(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: "Ошибка при получении задачи" });
  }
});

// Создать задачу
router.post("/", async (req, res) => {
  try {
    const newTask = await db.createTask(req.body);
    res.status(201).json(newTask);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Ошибка при создании задачи", message: err.message });
  }
});

// Обновить задачу
router.put("/:id", async (req, res) => {
  try {
    due_date = "2025-10-01";
    const updatedTask = await db.updateTask(req.params.id, req.body);
    if (!updatedTask)
      return res.status(404).json({ error: "Задача не найдена" });

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: "Ошибка при обновлении задачи" });
  }
});

// Удалить задачу
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await db.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Задача не найдена" });

    res.json({ message: "Задача удалена" });
  } catch (err) {
    res.status(500).json({ error: "Ошибка при удалении задачи" });
  }
});

// ==================== CRUD для вложений ====================

// Загрузить вложение к задаче
router.post("/:id/attachments", upload.array("file"), async (req, res) => {
  try {
    const task = await db.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: "Задача не найдена" });

    const attachments = [];
    for (const f of req.files) {
      const att = await db.addAttachment(req.params.id, {
        filename: f.filename,
        original_name: f.originalname,
        content_type: f.mimetype,
      });
      attachments.push(att);
    }

    res.status(201).json(attachments);
  } catch (err) {
    res.status(500).json({ error: "Ошибка при загрузке файла" });
  }
});

// Удалить вложение
router.delete("/:id/attachments/:aid", async (req, res) => {
  try {
    const attId = req.params.aid;
    const attachments = await db.getAttachmentsByTask(req.params.id);
    const file = attachments.find((a) => a.id == attId);
    if (!file) return res.status(404).json({ error: "Not found" });

    const ok = await db.deleteAttachment(attId);
    if (ok) {
      const filePath = path.join(uploadDir, file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ success: true });
    } else res.status(404).json({ error: "Not found" });
  } catch (err) {
    res.status(500).json({ error: "Ошибка при удалении файла" });
  }
});

module.exports = router;
