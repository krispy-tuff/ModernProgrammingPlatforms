const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors'); // Импортируем cors
const tasksRouter = require('./routes/tasks');
const authRouter = require('./routes/auth');
const authMiddleware = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3002;

// Настройка CORS
app.use(cors({
    origin: 'http://localhost:5173', // Явно указываем разрешенный источник
    credentials: true // Разрешаем отправку cookie
}));

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Инициализация и раздача папки для загрузок
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));


// Инициализация базы данных если её нет
const dataDir = path.join(__dirname, 'data');
const dataPath = path.join(dataDir, 'db.json');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ tasks: [], users: [] }, null, 2));
}

// Маршруты API
app.use('/api/auth', authRouter);
app.use('/api', authMiddleware, tasksRouter);

// Отдаем SPA (Vue) на все остальные запросы
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// Обработка 404 для API
app.use((req, res, next) => {
    // Если запрос был к /api, но не был обработан
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ message: 'Эндпоинт не найден' });
    }
    next();
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Ошибка на стороне сервера',
        error: err.message 
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
});
