// server/routes/tasks.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken"); // оставляем, если потребуется
const multer = require("multer");

const router = express.Router();
const dataPath = path.join(__dirname, "..", "data", "db.json");
const uploadsDir = path.join(__dirname, "..", "uploads");

// Multer storage (твоя логика сохранения имен)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    try {
      file.originalname = Buffer.from(file.originalname, "latin1").toString(
        "utf8"
      );
    } catch (e) {
      // если декодирование не требуется — пропускаем
    }
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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// --- helpers ---
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
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("Ошибка записи файла базы данных:", error);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// requireAuth: используем существующее req.userId (auth middleware должен его выставлять)
function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
}

// helper: emit updated tasks to user room if io available
function emitUserTasks(req) {
  const io = req.app.get("io");
  if (!io) return;
  const db = readDb();
  const userTasks = (db.tasks || []).filter(
    (t) => String(t.userId) === String(req.userId)
  );
  io.to(`user_${req.userId}`).emit("tasks_updated", userTasks);
}

// -----------------
// POST /api/tasks/:id/attachments
//  - multipart: attachments[] (files)
//  - optional body field: attachmentsToDelete (JSON string) -> array of attachment ids to remove
// Handles both adding and deleting attachments for a given task (auth required).
// -----------------
router.post(
  "/tasks/:id/attachments",
  requireAuth,
  upload.array("attachments", 20),
  (req, res) => {
    const db = readDb();
    db.tasks = db.tasks || [];
    db.attachments = db.attachments || []; // optional global registry if used

    const taskId = req.params.id;
    const taskIndex = db.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1)
      return res.status(404).json({ message: "Task not found" });

    const task = db.tasks[taskIndex];

    // Проверка авторства: task.userId должен совпадать с req.userId
    if (String(task.userId) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const added = [];
    const deleted = [];

    // 1) Удаляем запрошенные вложения (если есть attachmentsToDelete)
    if (req.body.attachmentsToDelete) {
      let toDelete;
      try {
        toDelete = Array.isArray(req.body.attachmentsToDelete)
          ? req.body.attachmentsToDelete
          : JSON.parse(req.body.attachmentsToDelete);
      } catch (e) {
        toDelete = [];
      }

      for (const aid of toDelete) {
        // Найти attachment в задаче
        const aidx = (task.attachments || []).findIndex(
          (a) => String(a.id) === String(aid)
        );
        if (aidx === -1) continue; // нет такого вложения в задаче

        const att = task.attachments[aidx];

        // удалить физический файл
        const filePath = path.join(uploadsDir, att.filename);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Ошибка удаления файла:", filePath, e);
        }

        // удалить из задачи
        task.attachments.splice(aidx, 1);
        deleted.push(String(aid));

        // если у тебя есть глобальная таблица attachments в db, удалим оттуда тоже
        if (Array.isArray(db.attachments)) {
          const gidx = db.attachments.findIndex(
            (g) =>
              String(g.id) === String(aid) &&
              String(g.taskId) === String(taskId)
          );
          if (gidx !== -1) db.attachments.splice(gidx, 1);
        }
      }
    }

    // 2) Добавляем новые файлы (если есть)
    if (req.files && req.files.length) {
      for (const f of req.files) {
        const att = {
          id: generateId(),
          taskId: task.id,
          filename: f.filename,
          originalName: f.originalname,
          path: `/uploads/${f.filename}`,
          contentType: f.mimetype,
          uploadedAt: new Date().toISOString(),
        };
        // сохраняем в задаче
        task.attachments = task.attachments || [];
        task.attachments.push(att);

        // если используешь глобальный список attachments — добавим туда
        if (!Array.isArray(db.attachments)) db.attachments = [];
        db.attachments.push(att);

        added.push(att);
      }
      task.updatedAt = new Date().toISOString();
    }

    // Сохраняем БД
    writeDb(db);

    // Эмитим обновление задач только для этого юзера (комната user_<id>)
    emitUserTasks(req);

    // Ответ: какие добавлены, какие удалены, и обновлённая задача
    return res.status(200).json({
      added,
      deleted,
      task,
    });
  }
);

// -----------------
// DELETE /api/attachments/:id
// Удаляет одно вложение (auth required). Удаляет файл с диска и запись в задаче.
// -----------------
router.delete("/attachments/:id", requireAuth, (req, res) => {
  const db = readDb();
  db.tasks = db.tasks || [];
  db.attachments = db.attachments || [];

  const aid = req.params.id;
  let found = false;
  for (const task of db.tasks) {
    const aidx = (task.attachments || []).findIndex(
      (a) => String(a.id) === String(aid)
    );
    if (aidx !== -1) {
      // проверка авторства
      if (String(task.userId) !== String(req.userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const att = task.attachments[aidx];
      const filePath = path.join(uploadsDir, att.filename);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Ошибка удаления файла:", filePath, e);
      }

      // удаляем запись во вложениях задачи
      task.attachments.splice(aidx, 1);

      // удалить из глобального списка attachments, если есть
      const gidx = db.attachments.findIndex(
        (g) => String(g.id) === String(aid)
      );
      if (gidx !== -1) db.attachments.splice(gidx, 1);

      found = true;
      break;
    }
  }

  if (!found) return res.status(404).json({ message: "Attachment not found" });

  writeDb(db);
  // отправляем обновление задач пользователю
  emitUserTasks(req);
  return res.status(204).send();
});

module.exports = router;
