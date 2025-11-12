const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "db.json");

const readData = () => {
  const data = fs.readFileSync(dbPath);
  return JSON.parse(data);
};

const writeData = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

router.post("/register", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password || password.length < 5) {
    return res.status(400).json({ message: "Логин и пароль обязательны" });
  }

  const db = readData();

  if (db.users.find((user) => user.login === login)) {
    return res
      .status(400)
      .json({ message: "Пользователь с таким логином уже существует" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { id: Date.now(), login, password: hashedPassword };
  db.users.push(newUser);
  writeData(db);

  res.status(201).json({ message: "Пользователь успешно зарегистрирован" });
});

router.post("/login", async (req, res) => {
  const { login, password } = req.body;
  const db = readData();
  const user = db.users.find((u) => u.login === login);

  if (!user) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res.status(401).json({ message: "Неверный логин или пароль" });
  }

  const token = jwt.sign({ id: user.id, login: user.login }, "123123", {
    expiresIn: "1h",
  });

  res
    .cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    })
    .status(200)
    .json({ message: "Вход выполнен успешно" });
});

router.post("/logout", (req, res) => {
  res
    .clearCookie("access_token")
    .status(200)
    .json({ message: "Выход выполнен успешно" });
});

module.exports = router;
