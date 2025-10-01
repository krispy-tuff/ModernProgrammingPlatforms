-- Таблица задач
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo', -- todo / in-progress / done
  due_date TEXT,                       -- строка в формате YYYY-MM-DD
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Таблица вложений
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  filename TEXT NOT NULL,       -- имя файла на диске (сгенерированное Multer)
  original_name TEXT,           -- оригинальное имя
  content_type TEXT,            -- MIME-тип
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
