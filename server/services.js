const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const serializeUser = (user) => ({
  id: String(user.id),
  email: user.email
});
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const passwordMinLength = 8;

const createToken = (user, jwtSecret) =>
  jwt.sign(
    { sub: user.id, email: user.email },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const registerUser = async (db, { email, password }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    return { status: 400, body: { error: '이메일과 비밀번호를 입력하세요.' } };
  }

  if (!isValidEmail(normalizedEmail)) {
    return { status: 400, body: { error: '올바른 이메일 형식을 입력하세요.' } };
  }

  if (normalizedPassword.length < passwordMinLength) {
    return { status: 400, body: { error: `비밀번호는 최소 ${passwordMinLength}자 이상이어야 합니다.` } };
  }

  const existingUser = await db.findUserByEmail(normalizedEmail);

  if (existingUser) {
    return { status: 409, body: { error: '이미 가입된 이메일입니다.' } };
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, 10);
  const user = await db.createUser(normalizedEmail, passwordHash);

  return { status: 201, body: { user: serializeUser(user) } };
};

const loginUser = async (db, { email, password }, jwtSecret) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  const user = await db.findUserByEmail(normalizedEmail);

  if (
    !isValidEmail(normalizedEmail) ||
    normalizedPassword.length < passwordMinLength ||
    !user ||
    !(await bcrypt.compare(normalizedPassword, user.password_hash))
  ) {
    return { status: 401, body: { error: '이메일 또는 비밀번호가 올바르지 않습니다.' } };
  }

  return {
    status: 200,
    body: {
      token: createToken(user, jwtSecret),
      user: serializeUser(user)
    }
  };
};

const getUserFromToken = async (db, token, jwtSecret) => {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await db.findUserById(payload.sub);
    return user ? serializeUser(user) : null;
  } catch {
    return null;
  }
};

const listTodos = (db, userId) => db.listTodos(userId);

const createTodo = async (db, userId, todo) => {
  const title = String(todo.title || '').trim();
  const dueDate = String(todo.dueDate || '');
  const priority = String(todo.priority || 'normal');
  const tags = Array.isArray(todo.tags) ? todo.tags : [];

  if (!title) {
    return { status: 400, body: { error: '할 일을 입력하세요.' } };
  }

  return {
    status: 201,
    body: {
      todo: await db.createTodo(userId, { title, dueDate, priority, tags })
    }
  };
};

const serializeTagsForStorage = (tags) => {
  if (Array.isArray(tags)) {
    return JSON.stringify(tags);
  }

  if (typeof tags === 'string') {
    return tags;
  }

  return '[]';
};

const updateTodo = async (db, userId, todoId, patch) => {
  const existingTodo = await db.findTodoById(userId, todoId);

  if (!existingTodo) {
    return { status: 404, body: { error: '할 일을 찾을 수 없습니다.' } };
  }

  const nextTodo = {
    text: patch.title === undefined ? existingTodo.text : String(patch.title).trim(),
    completed: patch.completed === undefined ? existingTodo.completed : patch.completed ? 1 : 0,
    due_date: patch.dueDate === undefined ? existingTodo.due_date : String(patch.dueDate || ''),
    priority: patch.priority === undefined ? existingTodo.priority : String(patch.priority || 'normal'),
    tags:
      patch.tags === undefined
        ? serializeTagsForStorage(existingTodo.tags)
        : serializeTagsForStorage(patch.tags)
  };

  if (!nextTodo.text) {
    return { status: 400, body: { error: '할 일을 입력하세요.' } };
  }

  return {
    status: 200,
    body: {
      todo: await db.updateTodo(userId, todoId, nextTodo)
    }
  };
};

const deleteTodo = async (db, userId, todoId) => {
  await db.deleteTodo(userId, todoId);
  return { status: 204 };
};

const deleteCompletedTodos = async (db, userId) => {
  await db.deleteCompletedTodos(userId);
  return { status: 204 };
};

module.exports = {
  registerUser,
  loginUser,
  getUserFromToken,
  listTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  deleteCompletedTodos
};
