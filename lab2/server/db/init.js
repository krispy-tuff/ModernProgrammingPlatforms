const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "tasks.sqlite");
const initSql = fs.readFileSync(path.join(__dirname, "init.sql"), "utf-8");

const db = new sqlite3.Database(dbPath);

db.exec(initSql, (err) => {
  if (err) {
    console.error("Ошибка инициализации БД:", err);
  } else {
    console.log("База данных инициализирована успешно.");
  }
  db.close();
});
