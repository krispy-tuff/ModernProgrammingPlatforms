const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dataPath = path.join(__dirname, "..", "data", "db.json");

function readDb() {
  const data = fs.readFileSync(dataPath, "utf8");
  return JSON.parse(data);
}

function writeDb(db) {
  fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
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

const resolvers = {
  DateTime: {
    __parseValue(value) {
      return value;
    },
    __serialize(value) {
      return value;
    },
    __parseLiteral(ast) {
      return ast.value;
    },
  },

  Query: {
    me: (_, __, ctx) => {
      if (!ctx.user) return null;
      return { id: ctx.user.id, login: ctx.user.login };
    },
    tasks: (_, __, ctx) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return getTasksForUser(ctx.user.id);
    },
    task: (_, { id }, ctx) => {
      if (!ctx.user) throw new Error("Unauthorized");
      return getTasksForUser(ctx.user.id).find((t) => t.id === id) || null;
    },
  },

  Mutation: {
    async register(_, { login, password }) {
      const db = readDb();
      if (db.users.find((u) => u.login === login)) {
        throw new Error("Пользователь с таким логином уже существует");
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = { id: Date.now(), login, password: hashedPassword };
      db.users.push(newUser);
      writeDb(db);
      return {
        message: "Пользователь успешно зарегистрирован",
        user: { id: newUser.id, login: newUser.login },
      };
    },

    async login(_, { login, password }, { res }) {
      const db = readDb();
      const user = db.users.find((u) => u.login === login);
      if (!user) throw new Error("Неверный логин или пароль");
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) throw new Error("Неверный логин или пароль");
      const token = jwt.sign({ id: user.id, login: user.login }, "123123", {
        expiresIn: "1h",
      });
      res.cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });
      return {
        message: "Вход выполнен успешно",
        user: { id: user.id, login: user.login },
      };
    },

    logout(_, __, { res }) {
      res.clearCookie("access_token");
      return { message: "Выход выполнен успешно" };
    },

    createTask(_, { input }, ctx) {
      if (!ctx.user) throw new Error("Unauthorized");
      const userId = ctx.user.id;
      const tasks = readTasks();
      const now = new Date().toISOString();
      const newTask = {
        id: generateId(),
        userId: userId,
        title: input.title,
        description: input.description || "",
        status: input.status,
        dueDate: input.dueDate || null,
        createdAt: now,
        updatedAt: now,
        attachments: [],
      };
      tasks.push(newTask);
      writeTasks(tasks);
      return newTask;
    },

    updateTask(_, { id, input }, ctx) {
      if (!ctx.user) throw new Error("Unauthorized");
      const tasks = getTasksForUser(ctx.user.id);
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error("Задача не найдена");
      const updated = {
        ...tasks[idx],
        title: input.title,
        description: input.description || "",
        status: input.status,
        dueDate: input.dueDate || null,
        updatedAt: new Date().toISOString(),
      };
      tasks[idx] = updated;
      writeTasks(tasks);
      return updated;
    },

    patchTask(_, { id, input }, ctx) {
      if (!ctx.user) throw new Error("Unauthorized");
      const tasks = getTasksForUser(ctx.user.id);
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) throw new Error("Задача не найдена");
      const task = tasks[idx];
      const updated = {
        ...task,
        title: input.title ?? task.title,
        description: input.description ?? task.description,
        status: input.status ?? task.status,
        dueDate: input.dueDate ?? task.dueDate,
        updatedAt: new Date().toISOString(),
      };
      tasks[idx] = updated;
      writeTasks(tasks);
      return updated;
    },

    deleteTask(_, { id }, ctx) {
      if (!ctx.user) throw new Error("Unauthorized");
      const tasks = getTasksForUser(ctx.user.id);
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) return false;
      // Remove files on disk
      try {
        const uploadsDir = path.join(__dirname, "..", "uploads");
        tasks[idx].attachments.forEach((att) => {
          const filePath = path.join(uploadsDir, att.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      } catch {}
      tasks.splice(idx, 1);
      writeTasks(tasks);
      return true;
    },
  },
};

module.exports = { resolvers };
