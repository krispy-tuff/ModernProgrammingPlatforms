const express = require("express");
const methodOverride = require("method-override");
const path = require("path");
const tasksRouter = require("./routes/tasks");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true })); // для форм
app.use(methodOverride("_method")); // чтобы формы поддерживали PUT/DELETE

// Статика
app.use(express.static(path.join(__dirname, "public"))); // CSS, JS, картинки

// Настройка EJS
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const expressLayouts = require("express-ejs-layouts");
app.use(expressLayouts);
app.set("layout", "layouts/layout");

// Роуты
app.use("/tasks", tasksRouter);

// Главная редирект на /tasks
app.get("/", (req, res) => {
  res.redirect("/tasks");
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
