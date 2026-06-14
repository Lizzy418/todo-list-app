const { createDatabase } = require('./db');
const { handleTodoAgentMessage } = require('./agentService');
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

  it('Todo Agent가 create_todo tool로 기존 Todo 생성 서비스를 호출한다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;
    const openAIClient = vi
      .fn()
      .mockResolvedValueOnce({
        role: 'assistant',
        tool_calls: [
          {
            id: 'call-create',
            type: 'function',
            function: {
              name: 'create_todo',
              arguments: JSON.stringify({
                title: '운동하기',
                dueDate: '',
                priority: 'normal',
                tags: []
              })
            }
          }
        ]
      })
      .mockResolvedValueOnce({ role: 'assistant', content: '운동하기를 추가했어요.' });

    const response = await handleTodoAgentMessage(db, user.id, '운동하기 추가해줘', {
      apiKey: 'test-key',
      openAIClient
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'create_todo',
      changed: true,
      message: '운동하기를 추가했어요.'
    });
    await expect(listTodos(db, user.id)).resolves.toHaveLength(1);
  });

  it('Todo Agent delete_todo는 여러 항목이 매칭되면 삭제하지 않는다.', async () => {
    const { db } = createTestContext();
    const user = (await register(db)).body.user;
    await createTodo(db, user.id, { title: '독서 10분' });
    await createTodo(db, user.id, { title: '독서 기록 정리' });
    const openAIClient = vi
      .fn()
      .mockResolvedValueOnce({
        role: 'assistant',
        tool_calls: [
          {
            id: 'call-delete',
            type: 'function',
            function: {
              name: 'delete_todo',
              arguments: JSON.stringify({ query: '독서' })
            }
          }
        ]
      })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '일치하는 할 일이 2개 있어요. 삭제할 항목을 더 정확히 말해주세요.'
      });

    const response = await handleTodoAgentMessage(db, user.id, '독서 삭제해줘', {
      apiKey: 'test-key',
      openAIClient
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      action: 'delete_todo',
      changed: false
    });
    expect(response.body.candidates).toHaveLength(2);
    await expect(listTodos(db, user.id)).resolves.toHaveLength(2);
  });
});
