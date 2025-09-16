const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "tasks.sqlite");
const db = new sqlite3.Database(dbPath);

// Промисифицированные обёртки
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // { lastID, changes }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// =======================
// CRUD для задач
// =======================
async function createTask({ title, description, status, due_date }) {
  return run(
    `INSERT INTO tasks (title, description, status, due_date)
     VALUES (?, ?, ?, ?)`,
    [title, description, status, due_date]
  );
}

async function getTasks({ status } = {}) {
  if (status) {
    return all(
      `SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );
  }
  return all(`SELECT * FROM tasks ORDER BY created_at DESC`);
}

async function getTaskById(id) {
  return get(`SELECT * FROM tasks WHERE id = ?`, [id]);
}

async function updateTask(id, { title, description, status, due_date }) {
  return run(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, due_date = ?
     WHERE id = ?`,
    [title, description, status, due_date, id]
  );
}

async function deleteTask(id) {
  return run(`DELETE FROM tasks WHERE id = ?`, [id]);
}

// =======================
// CRUD для вложений
// =======================
async function addAttachment(
  taskId,
  { filename, original_name, content_type }
) {
  return run(
    `INSERT INTO attachments (task_id, filename, original_name, content_type)
     VALUES (?, ?, ?, ?)`,
    [taskId, filename, original_name, content_type]
  );
}

async function getAttachmentsByTask(taskId) {
  return all(`SELECT * FROM attachments WHERE task_id = ?`, [taskId]);
}

async function getAttachmentById(id) {
  return get(`SELECT * FROM attachments WHERE id = ?`, [id]);
}

async function deleteAttachment(id) {
  return run(`DELETE FROM attachments WHERE id = ?`, [id]);
}

module.exports = {
  // задачи
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  // вложения
  addAttachment,
  getAttachmentsByTask,
  getAttachmentById,
  deleteAttachment,
};
