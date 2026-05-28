const { mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');
const { mapTodoRow } = require('./todoMapper');

const DEFAULT_DATABASE_FILE = resolve(process.cwd(), 'server/data/todolist.sqlite');

const sqliteSchema = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'normal',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

const postgresSchema = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS todos (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    due_date TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'normal',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const normalizeSqliteTodoRow = (row) => mapTodoRow(row);
const normalizePostgresTodoRow = (row) =>
  mapTodoRow({
    ...row,
    tags: JSON.stringify(Array.isArray(row.tags) ? row.tags : row.tags || []),
    completed: row.completed ? 1 : 0,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  });

const createSqliteClient = (databaseFile = process.env.DATABASE_FILE || DEFAULT_DATABASE_FILE) => {
  if (databaseFile !== ':memory:') {
    mkdirSync(dirname(databaseFile), { recursive: true });
  }

  const db = new DatabaseSync(databaseFile);
  db.exec(sqliteSchema);

  return {
    dialect: 'sqlite',
    async migrate() {
      db.exec(sqliteSchema);
    },
    async close() {
      db.close();
    },
    async findUserByEmail(email) {
      return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
    },
    async findUserById(id) {
      return db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) || null;
    },
    async createUser(email, passwordHash) {
      const result = db
        .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
        .run(email, passwordHash);
      return db.prepare('SELECT id, email FROM users WHERE id = ?').get(result.lastInsertRowid);
    },
    async listTodos(userId) {
      return db
        .prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC')
        .all(userId)
        .map(normalizeSqliteTodoRow);
    },
    async createTodo(userId, todo) {
      const result = db
        .prepare(
          `INSERT INTO todos (user_id, text, completed, due_date, priority, tags)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(userId, todo.title, 0, todo.dueDate, todo.priority, JSON.stringify(todo.tags));
      const row = db
        .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
        .get(result.lastInsertRowid, userId);
      return normalizeSqliteTodoRow(row);
    },
    async findTodoById(userId, todoId) {
      const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(todoId, userId);
      return row || null;
    },
    async updateTodo(userId, todoId, todo) {
      db.prepare(
        `UPDATE todos
         SET text = ?, completed = ?, due_date = ?, priority = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ?`
      ).run(
        todo.text,
        todo.completed,
        todo.due_date,
        todo.priority,
        todo.tags,
        todoId,
        userId
      );
      const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(todoId, userId);
      return normalizeSqliteTodoRow(row);
    },
    async deleteTodo(userId, todoId) {
      db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(todoId, userId);
    },
    async deleteCompletedTodos(userId) {
      db.prepare('DELETE FROM todos WHERE user_id = ? AND completed = 1').run(userId);
    }
  };
};

const createPostgresClient = (databaseUrl = process.env.DATABASE_URL) => {
  const shouldUseSsl =
    process.env.PGSSLMODE === 'require' ||
    process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false
  });

  return {
    dialect: 'postgres',
    async migrate() {
      await pool.query(postgresSchema);
    },
    async close() {
      await pool.end();
    },
    async findUserByEmail(email) {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] || null;
    },
    async findUserById(id) {
      const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [id]);
      return result.rows[0] || null;
    },
    async createUser(email, passwordHash) {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash]
      );
      return result.rows[0];
    },
    async listTodos(userId) {
      const result = await pool.query(
        'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
        [userId]
      );
      return result.rows.map(normalizePostgresTodoRow);
    },
    async createTodo(userId, todo) {
      const result = await pool.query(
        `INSERT INTO todos (user_id, text, completed, due_date, priority, tags)
         VALUES ($1, $2, FALSE, $3, $4, $5::jsonb)
         RETURNING *`,
        [userId, todo.title, todo.dueDate, todo.priority, JSON.stringify(todo.tags)]
      );
      return normalizePostgresTodoRow(result.rows[0]);
    },
    async findTodoById(userId, todoId) {
      const result = await pool.query('SELECT * FROM todos WHERE id = $1 AND user_id = $2', [
        todoId,
        userId
      ]);
      return result.rows[0] || null;
    },
    async updateTodo(userId, todoId, todo) {
      const result = await pool.query(
        `UPDATE todos
         SET text = $1, completed = $2, due_date = $3, priority = $4, tags = $5::jsonb, updated_at = NOW()
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [todo.text, Boolean(todo.completed), todo.due_date, todo.priority, todo.tags, todoId, userId]
      );
      return normalizePostgresTodoRow(result.rows[0]);
    },
    async deleteTodo(userId, todoId) {
      await pool.query('DELETE FROM todos WHERE id = $1 AND user_id = $2', [todoId, userId]);
    },
    async deleteCompletedTodos(userId) {
      await pool.query('DELETE FROM todos WHERE user_id = $1 AND completed = TRUE', [userId]);
    }
  };
};

const createDatabase = (options = {}) => {
  if (typeof options === 'string') {
    return createSqliteClient(options);
  }

  if (options.databaseUrl || process.env.DATABASE_URL) {
    return createPostgresClient(options.databaseUrl || process.env.DATABASE_URL);
  }

  return createSqliteClient(options.databaseFile);
};

module.exports = {
  createDatabase,
  createPostgresClient,
  createSqliteClient,
  postgresSchema,
  sqliteSchema
};
