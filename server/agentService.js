const {
  createTodo,
  deleteTodo,
  listTodos
} = require('./services');

const CREATE_WORDS = ['추가', '등록', '넣어', '만들어'];
const LIST_WORDS = ['보여', '조회', '목록', '뭐 있어', '뭐있어', '알려'];
const DELETE_WORDS = ['삭제', '지워', '제거'];
const DATE_WORDS = ['오늘', '내일', '어제', '모레'];
const FILLER_WORDS = [
  '해줘',
  '해주세요',
  '해',
  '줘',
  '할 일',
  '할일',
  'todo',
  'Todo',
  '투두'
];

const getDateStringWithOffset = (offsetDays, today = new Date()) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offsetDays);

  return date.toISOString().slice(0, 10);
};

const parseDueDate = (message, today = new Date()) => {
  if (message.includes('어제')) {
    return getDateStringWithOffset(-1, today);
  }

  if (message.includes('오늘')) {
    return getDateStringWithOffset(0, today);
  }

  if (message.includes('내일')) {
    return getDateStringWithOffset(1, today);
  }

  if (message.includes('모레')) {
    return getDateStringWithOffset(2, today);
  }

  return '';
};

const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

const includesAny = (message, words) => words.some((word) => message.includes(word));

const removeWords = (message, words) => {
  let result = message;

  words
    .sort((first, second) => second.length - first.length)
    .forEach((word) => {
      result = result.replaceAll(word, ' ');
    });

  return result.replace(/\s+/g, ' ').trim();
};

const buildQueryText = (message, actionWords) =>
  removeWords(message, [...actionWords, ...DATE_WORDS, ...FILLER_WORDS]);

const parseListFilter = (message) => {
  if (message.includes('완료')) {
    return 'completed';
  }

  if (message.includes('남은') || message.includes('미완료')) {
    return 'active';
  }

  return 'all';
};

const parseListSearchTerm = (message) =>
  removeWords(message, [...LIST_WORDS, ...DATE_WORDS, ...FILLER_WORDS, '완료', '남은', '미완료']);

const parseIntent = (message, { today = new Date() } = {}) => {
  const normalizedMessage = String(message || '').trim();
  const dueDate = parseDueDate(normalizedMessage, today);

  // TODO: Add update_todo intent parsing when title/metadata edits are supported.
  // TODO: Add complete_todo intent parsing when natural language completion is supported.

  if (!normalizedMessage) {
    return { action: 'unknown', dueDate: '', query: '', title: '', filter: 'all' };
  }

  if (includesAny(normalizedMessage, DELETE_WORDS)) {
    return {
      action: 'delete_todo',
      dueDate,
      query: buildQueryText(normalizedMessage, DELETE_WORDS),
      title: '',
      filter: 'all'
    };
  }

  if (includesAny(normalizedMessage, LIST_WORDS)) {
    return {
      action: 'list_todos',
      dueDate,
      query: parseListSearchTerm(normalizedMessage),
      title: '',
      filter: parseListFilter(normalizedMessage)
    };
  }

  if (includesAny(normalizedMessage, CREATE_WORDS)) {
    return {
      action: 'create_todo',
      dueDate,
      query: '',
      title: buildQueryText(normalizedMessage, CREATE_WORDS),
      filter: 'all'
    };
  }

  return { action: 'unknown', dueDate, query: '', title: '', filter: 'all' };
};

const emptyAgentBody = (message, action = 'unknown') => ({
  message,
  action,
  todo: null,
  todos: []
});

const matchesTodo = (todo, query) => {
  const normalizedQuery = normalizeSearchText(query);

  return !normalizedQuery || todo.title.toLowerCase().includes(normalizedQuery);
};

const matchesFilter = (todo, filter) => {
  if (filter === 'completed') {
    return todo.completed;
  }

  if (filter === 'active') {
    return !todo.completed;
  }

  return true;
};

const matchesDueDate = (todo, dueDate) => !dueDate || todo.dueDate === dueDate;

const listMatchingTodos = (todos, intent) =>
  todos.filter(
    (todo) =>
      matchesTodo(todo, intent.query) &&
      matchesFilter(todo, intent.filter) &&
      matchesDueDate(todo, intent.dueDate)
  );

const formatTodoTitles = (todos) => todos.map((todo) => todo.title).join(', ');

const handleCreateTodo = async (db, userId, intent) => {
  if (!intent.title) {
    return {
      status: 200,
      body: emptyAgentBody('추가할 할 일을 더 정확히 입력해주세요.', 'clarify')
    };
  }

  const result = await createTodo(db, userId, {
    title: intent.title,
    dueDate: intent.dueDate,
    priority: 'normal',
    tags: []
  });

  if (result.status !== 201) {
    return {
      status: result.status,
      body: emptyAgentBody(result.body?.error || '할 일을 추가하지 못했습니다.', 'create_todo')
    };
  }

  return {
    status: 200,
    body: {
      message: `${result.body.todo.title}를 추가했습니다.`,
      action: 'create_todo',
      todo: result.body.todo,
      todos: []
    }
  };
};

const handleListTodos = async (db, userId, intent) => {
  const todos = listMatchingTodos(await listTodos(db, userId), intent);

  return {
    status: 200,
    body: {
      message:
        todos.length === 0
          ? '조건에 맞는 할 일을 찾지 못했습니다.'
          : `${todos.length}개의 할 일을 찾았습니다: ${formatTodoTitles(todos)}`,
      action: 'list_todos',
      todo: null,
      todos
    }
  };
};

const handleDeleteTodo = async (db, userId, intent) => {
  if (!intent.query && !intent.dueDate) {
    return {
      status: 200,
      body: emptyAgentBody('삭제할 할 일을 더 정확히 입력해주세요.', 'clarify')
    };
  }

  const matches = listMatchingTodos(await listTodos(db, userId), {
    ...intent,
    filter: 'all'
  });

  if (matches.length === 0) {
    return {
      status: 200,
      body: emptyAgentBody('일치하는 할 일을 찾지 못했습니다.', 'delete_todo')
    };
  }

  if (matches.length > 1) {
    return {
      status: 200,
      body: {
        message: '여러 개의 할 일이 일치합니다. 삭제할 항목을 더 정확히 말해주세요.',
        action: 'clarify',
        todo: null,
        todos: matches
      }
    };
  }

  await deleteTodo(db, userId, matches[0].id);

  return {
    status: 200,
    body: {
      message: `${matches[0].title}를 삭제했습니다.`,
      action: 'delete_todo',
      todo: matches[0],
      todos: []
    }
  };
};

const handleTodoAgentMessage = async (db, userId, message) => {
  const intent = parseIntent(message);

  if (intent.action === 'create_todo') {
    return handleCreateTodo(db, userId, intent);
  }

  if (intent.action === 'list_todos') {
    return handleListTodos(db, userId, intent);
  }

  if (intent.action === 'delete_todo') {
    return handleDeleteTodo(db, userId, intent);
  }

  return {
    status: 200,
    body: emptyAgentBody('할 일 추가, 조회, 삭제만 도와드릴 수 있습니다.', 'unknown')
  };
};

module.exports = {
  handleTodoAgentMessage,
  parseIntent
};
