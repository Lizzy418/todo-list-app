const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const serializeUser = (user) => ({
  id: String(user.id),
  email: user.email
});
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const passwordMinLength = 8;

const refreshTokenDays = Number(process.env.REFRESH_TOKEN_DAYS || 30);

const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createAccessToken = (user, jwtSecret) =>
  jwt.sign(
    { sub: user.id, email: user.email, type: 'access' },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

const createRefreshToken = async (db, user) => {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000).toISOString();

  await db.createRefreshToken(user.id, hashRefreshToken(refreshToken), expiresAt);

  return refreshToken;
};

const createAuthSession = async (db, user, jwtSecret) => ({
  token: createAccessToken(user, jwtSecret),
  refreshToken: await createRefreshToken(db, user),
  user: serializeUser(user)
});

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
    body: await createAuthSession(db, user, jwtSecret)
  };
};

const refreshUserToken = async (db, refreshToken, jwtSecret) => {
  const normalizedRefreshToken = String(refreshToken || '').trim();

  if (!normalizedRefreshToken) {
    return { status: 401, body: { error: '로그인이 필요합니다.' } };
  }

  const tokenHash = hashRefreshToken(normalizedRefreshToken);
  const storedToken = await db.findRefreshToken(tokenHash);

  if (!storedToken) {
    return { status: 401, body: { error: '로그인이 필요합니다.' } };
  }

  const expiresAt = new Date(storedToken.expires_at).getTime();

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await db.deleteRefreshToken(tokenHash);
    return { status: 401, body: { error: '로그인이 만료되었습니다. 다시 로그인하세요.' } };
  }

  const user = {
    id: storedToken.user_id,
    email: storedToken.email
  };

  await db.deleteRefreshToken(tokenHash);
  await db.deleteExpiredRefreshTokens(new Date().toISOString());

  return {
    status: 200,
    body: await createAuthSession(db, user, jwtSecret)
  };
};

const logoutUser = async (db, refreshToken) => {
  const normalizedRefreshToken = String(refreshToken || '').trim();

  if (normalizedRefreshToken) {
    await db.deleteRefreshToken(hashRefreshToken(normalizedRefreshToken));
  }

  return { status: 204 };
};

const getUserFromToken = async (db, token, jwtSecret) => {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload.type !== 'access') {
      return null;
    }
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
  logoutUser,
  refreshUserToken,
  getUserFromToken,
  listTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  deleteCompletedTodos
};
