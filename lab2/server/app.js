const express = require("express");
const cors = require("cors");
const path = require("path");

const tasksRouter = require("./routes/tasks");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // отдаём файлы

// API
app.use("/api/tasks", tasksRouter);

// Отдача фронта после сборки
app.use(express.static(path.join(__dirname, "../client/dist")));
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () =>
  console.log(`Server started on http://localhost:${PORT}`)
);
