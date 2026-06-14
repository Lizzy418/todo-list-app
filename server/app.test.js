const { createDatabase } = require('./db');
const { handleTodoAgentMessage, parseIntent } = require('./agentService');
const {
  createTodo,
  deleteCompletedTodos,
  deleteTodo,
  getUserFromToken,
  listTodos,
  loginUser,
  registerUser,
  updateTodo
} = require('./services');

const createTestContext = () => ({
  db: createDatabase(':memory:'),
  jwtSecret: 'test-secret'
});

const register = (db, email = 'user@example.com', password = 'password123') =>
  registerUser(db, { email, password });

const login = (db, jwtSecret, email = 'user@example.com', password = 'password123') =>
  loginUser(db, { email, password }, jwtSecret);

describe('server API services', () => {
  it('회원가입 성공', async () => {
    const { db } = createTestContext();

    const response = await register(db);

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ email: 'user@example.com' });
    expect(response.body.user.password_hash).toBeUndefined();
  });

  it('중복 이메일 가입을 방지한다.', async () => {
    const { db } = createTestContext();

    await register(db);
    const response = await register(db);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('이미 가입된 이메일입니다.');
  });

  it('회원가입 이메일 형식을 검증한다.', async () => {
    const { db } = createTestContext();

    const response = await register(db, 'invalid-email');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('올바른 이메일 형식을 입력하세요.');
  });

  it('회원가입 비밀번호 최소 길이를 검증한다.', async () => {
    const { db } = createTestContext();

    const response = await register(db, 'short@example.com', 'short');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('비밀번호는 최소 8자 이상이어야 합니다.');
  });

  it('로그인 성공', async () => {
    const { db, jwtSecret } = createTestContext();

    await register(db);
    const response = await login(db, jwtSecret);

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toMatchObject({ email: 'user@example.com' });
    await expect(getUserFromToken(db, response.body.token, jwtSecret)).resolves.toMatchObject({
      email: 'user@example.com'
    });
  });

  it('로그인 실패', async () => {
    const { db, jwtSecret } = createTestContext();

    await register(db);
    const response = await login(db, jwtSecret, 'user@example.com', 'wrong-password');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
  });

  it('인증 없이 Todo API에 접근할 수 없다.', async () => {
    const { db, jwtSecret } = createTestContext();

    await expect(getUserFromToken(db, '', jwtSecret)).resolves.toBeNull();
  });

  it('Todo 추가/조회/수정/삭제', async () => {
    const { db, jwtSecret } = createTestContext();

    await register(db);
    const loginResponse = await login(db, jwtSecret);
    const userId = Number(loginResponse.body.user.id);

    const createResponse = await createTodo(db, userId, {
      title: '서버 Todo',
      dueDate: '2026-05-28',
      priority: 'high',
      tags: ['api']
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.todo).toMatchObject({
      title: '서버 Todo',
      completed: false,
      dueDate: '2026-05-28',
      priority: 'high',
      tags: ['api']
    });

    await expect(listTodos(db, userId)).resolves.toHaveLength(1);

    const todoId = createResponse.body.todo.id;
    const updateResponse = await updateTodo(db, userId, todoId, {
      title: '수정된 서버 Todo',
      completed: true
    });

    expect(updateResponse.body.todo).toMatchObject({
      title: '수정된 서버 Todo',
      completed: true
    });

    await expect(deleteTodo(db, userId, todoId)).resolves.toMatchObject({ status: 204 });
    await expect(listTodos(db, userId)).resolves.toHaveLength(0);
  });

  it('사용자별 Todo 데이터를 분리한다.', async () => {
    const { db, jwtSecret } = createTestContext();

    await register(db, 'a@example.com');
    await register(db, 'b@example.com');

    const userA = (await login(db, jwtSecret, 'a@example.com')).body.user;
    const userB = (await login(db, jwtSecret, 'b@example.com')).body.user;

    await createTodo(db, Number(userA.id), { title: 'A만 보는 Todo' });

    const listA = await listTodos(db, Number(userA.id));
    const listB = await listTodos(db, Number(userB.id));

    expect(listA).toHaveLength(1);
    expect(listA[0].title).toBe('A만 보는 Todo');
    expect(listB).toHaveLength(0);
  });

  it('완료 항목 전체 삭제', async () => {
    const { db, jwtSecret } = createTestContext();

    await register(db);
    const userId = Number((await login(db, jwtSecret)).body.user.id);

    const completedTodo = (await createTodo(db, userId, { title: '완료 Todo' })).body.todo;
    await createTodo(db, userId, { title: '진행 Todo' });
    await updateTodo(db, userId, completedTodo.id, { completed: true });

    await expect(deleteCompletedTodos(db, userId)).resolves.toMatchObject({ status: 204 });

    const todos = await listTodos(db, userId);
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe('진행 Todo');
  });

  it('PostgreSQL JSONB 태그 배열을 가진 Todo의 완료 상태를 수정한다.', async () => {
    const updates = [];
    const db = {
      async findTodoById() {
        return {
          id: '1',
          user_id: '1',
          text: '태그 있는 Todo',
          completed: false,
          due_date: '',
          priority: 'normal',
          tags: ['업무', '공부']
        };
      },
      async updateTodo(userId, todoId, todo) {
        updates.push(todo);
        return {
          id: todoId,
          title: todo.text,
          completed: Boolean(todo.completed),
          dueDate: todo.due_date,
          priority: todo.priority,
          tags: JSON.parse(todo.tags)
        };
      }
    };

    const response = await updateTodo(db, '1', '1', { completed: true });

    expect(response.status).toBe(200);
    expect(updates[0].tags).toBe(JSON.stringify(['업무', '공부']));
    expect(response.body.todo).toMatchObject({
      title: '태그 있는 Todo',
      completed: true,
      tags: ['업무', '공부']
    });
  });

  it('Mock Todo Agent가 날짜 단어와 생성 의도를 파싱한다.', () => {
    const intent = parseIntent('내일 운동하기 추가해줘', {
      today: new Date('2026-06-14T00:00:00.000Z')
    });

    expect(intent).toMatchObject({
      action: 'create_todo',
      title: '운동하기',
      dueDate: '2026-06-15'
    });
  });

  it('Mock Todo Agent가 직접 입력한 날짜와 생성 의도를 파싱한다.', () => {
    const intent = parseIntent('6월 18일에 운동 추가해줘', {
      today: new Date('2026-06-14T00:00:00.000Z')
    });

    expect(intent).toMatchObject({
      action: 'create_todo',
      title: '운동',
      dueDate: '2026-06-18'
    });
  });

  it('Mock Todo Agent가 오늘 추가 요청을 API 없이 처리한다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;

    const response = await handleTodoAgentMessage(db, user.id, '오늘 운동하기 추가해줘');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'create_todo',
      message: '운동하기를 추가했습니다.'
    });
    expect(response.body.todos).toEqual([]);
    const todos = await listTodos(db, user.id);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({
      title: '운동하기',
      dueDate: new Date().toISOString().slice(0, 10)
    });
  });

  it('Mock Todo Agent가 키워드와 완료 필터로 조회한다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;
    const completedTodo = (await createTodo(db, user.id, { title: '독서 10분' })).body.todo;
    await createTodo(db, user.id, { title: '운동하기' });
    await updateTodo(db, user.id, completedTodo.id, { completed: true });

    const response = await handleTodoAgentMessage(db, user.id, '완료 독서 목록 보여줘');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'list_todos',
      todo: null
    });
    expect(response.body.todos).toHaveLength(1);
    expect(response.body.todos[0]).toMatchObject({ title: '독서 10분', completed: true });
  });

  it('Mock Todo Agent가 찾아 요청을 조회로 판단하고 직접 날짜를 필터링한다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;
    await createTodo(db, user.id, { title: '운동하기', dueDate: '2026-06-18' });
    await createTodo(db, user.id, { title: '운동하기', dueDate: '2026-06-19' });

    const response = await handleTodoAgentMessage(db, user.id, '2026-06-18 운동 찾아줘');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'list_todos',
      todo: null
    });
    expect(response.body.todos).toHaveLength(1);
    expect(response.body.todos[0]).toMatchObject({
      title: '운동하기',
      dueDate: '2026-06-18'
    });
  });

  it('Mock Todo Agent delete_todo는 여러 항목이 매칭되면 삭제하지 않고 후보를 반환한다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;
    await createTodo(db, user.id, { title: '독서 10분' });
    await createTodo(db, user.id, { title: '독서 기록 정리' });

    const response = await handleTodoAgentMessage(db, user.id, '독서 삭제해줘');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'clarify',
      todo: null
    });
    expect(response.body.todos).toHaveLength(2);
    await expect(listTodos(db, user.id)).resolves.toHaveLength(2);
  });

  it('Mock Todo Agent delete_todo는 1개 매칭이면 삭제한다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;
    await createTodo(db, user.id, { title: '물 마시기' });

    const response = await handleTodoAgentMessage(db, user.id, '물 마시기 삭제해줘');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'delete_todo',
      message: '물 마시기를 삭제했습니다.'
    });
    expect(response.body.todo).toMatchObject({ title: '물 마시기' });
    expect(response.body.todos).toEqual([]);
    await expect(listTodos(db, user.id)).resolves.toHaveLength(0);
  });

  it('Mock Todo Agent delete_todo는 날짜 단어가 있으면 해당 날짜만 삭제 후보로 본다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await createTodo(db, user.id, { title: '운동하기', dueDate: today });
    await createTodo(db, user.id, { title: '운동하기', dueDate: tomorrow });

    const response = await handleTodoAgentMessage(db, user.id, '오늘 운동하기 삭제해줘');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'delete_todo'
    });
    const todos = await listTodos(db, user.id);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ title: '운동하기', dueDate: tomorrow });
  });

  it('Mock Todo Agent delete_todo는 직접 날짜가 있으면 해당 날짜만 삭제한다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;

    await createTodo(db, user.id, { title: '운동하기', dueDate: '2026-06-18' });
    await createTodo(db, user.id, { title: '운동하기', dueDate: '2026-06-19' });

    const response = await handleTodoAgentMessage(db, user.id, '6/18 운동 삭제해줘');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'delete_todo'
    });
    const todos = await listTodos(db, user.id);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ title: '운동하기', dueDate: '2026-06-19' });
  });
});
