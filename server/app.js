require('dotenv').config({ quiet: true });

const cors = require('cors');
const express = require('express');
const { resolve } = require('node:path');
const { createAuthMiddleware } = require('./authMiddleware');
const { createDatabase } = require('./db');
const { logError, logInfo } = require('./logger');
const {
  createTodo,
  deleteCompletedTodos,
  deleteTodo,
  listTodos,
  loginUser,
  registerUser,
  updateTodo
} = require('./services');

const createApp = ({ databaseFile, jwtSecret = process.env.JWT_SECRET || 'dev-secret' } = {}) => {
  const app = express();
  const db = createDatabase({ databaseFile });
  const authRequired = createAuthMiddleware(db, jwtSecret);
  const asyncRoute = (handler) => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

  app.locals.db = db;

  const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      }
    })
  );
  app.use(express.json());

  const serializeUser = (user) => ({
    id: String(user.id),
    email: user.email
  });

  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const result = await registerUser(db, req.body);
    if (result.status === 201) {
      logInfo('auth.register.success', {
        userId: result.body.user.id,
        email: result.body.user.email
      });
    }
    return res.status(result.status).json(result.body);
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const result = await loginUser(db, req.body, jwtSecret);
    if (result.status === 200) {
      logInfo('auth.login.success', {
        userId: result.body.user.id,
        email: result.body.user.email
      });
    } else {
      logInfo('auth.login.failure', {
        email: String(req.body?.email || '').trim().toLowerCase(),
        status: result.status
      });
    }
    return res.status(result.status).json(result.body);
  }));

  app.get('/api/auth/me', authRequired, (req, res) => {
    return res.json({ user: serializeUser(req.user) });
  });

  app.post('/api/auth/logout', authRequired, (req, res) => {
    logInfo('auth.logout', {
      userId: req.user.id,
      email: req.user.email
    });
    return res.status(204).end();
  });

  app.get('/api/todos', authRequired, asyncRoute(async (req, res) => {
    return res.json({ todos: await listTodos(db, req.user.id) });
  }));

  app.post('/api/todos', authRequired, asyncRoute(async (req, res) => {
    const result = await createTodo(db, req.user.id, req.body);
    return res.status(result.status).json(result.body);
  }));

  app.patch('/api/todos/:id', authRequired, asyncRoute(async (req, res) => {
    const result = await updateTodo(db, req.user.id, req.params.id, req.body);
    return res.status(result.status).json(result.body);
  }));

  app.delete('/api/todos/completed', authRequired, asyncRoute(async (req, res) => {
    const result = await deleteCompletedTodos(db, req.user.id);
    return res.status(result.status).end();
  }));

  app.delete('/api/todos/:id', authRequired, asyncRoute(async (req, res) => {
    const result = await deleteTodo(db, req.user.id, req.params.id);
    return res.status(result.status).end();
  }));

  if (process.env.NODE_ENV === 'production') {
    const distPath = resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }

      res.sendFile(resolve(distPath, 'index.html'));
    });
  }

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    logError('request.failed', {
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  });

  return app;
};

module.exports = {
  createApp
};
