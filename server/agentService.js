const {
  createTodo,
  deleteTodo,
  listTodos
} = require('./services');

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

const todoTools = [
  {
    type: 'function',
    function: {
      name: 'create_todo',
      description: 'Create a new todo from a natural language request.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The todo title without command words like add or create.'
          },
          dueDate: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format, or an empty string when not specified.'
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high'],
            description: 'Todo priority.'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Short tags inferred from the request.'
          }
        },
        required: ['title'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_todos',
      description: 'List todos matching the user request.',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'today', 'active', 'completed'],
            description: 'Which todos to list.'
          },
          searchTerm: {
            type: 'string',
            description: 'Optional text to search in todo titles.'
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_todo',
      description: 'Delete one todo by a natural language search query.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Todo title or keywords to find before deleting.'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  }
];

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

const filterTodos = (todos, { filter = 'all', searchTerm = '' } = {}) => {
  const today = getTodayDateString();
  const normalizedSearchTerm = normalizeSearchText(searchTerm);

  return todos.filter((todo) => {
    const matchesFilter =
      filter === 'today'
        ? todo.dueDate === today
        : filter === 'active'
          ? !todo.completed
          : filter === 'completed'
            ? todo.completed
            : true;
    const matchesSearch =
      !normalizedSearchTerm || todo.title.toLowerCase().includes(normalizedSearchTerm);

    return matchesFilter && matchesSearch;
  });
};

const findDeleteMatches = (todos, query) => {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const exactMatches = todos.filter((todo) => todo.title.toLowerCase() === normalizedQuery);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return todos.filter((todo) => todo.title.toLowerCase().includes(normalizedQuery));
};

const parseToolArguments = (toolCall) => {
  try {
    return JSON.parse(toolCall.function?.arguments || '{}');
  } catch {
    return {};
  }
};

const callOpenAI = async ({ apiKey, model, messages, tools, toolChoice = 'auto' }) => {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: toolChoice,
      parallel_tool_calls: false
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || 'OpenAI 요청을 처리하지 못했습니다.');
  }

  return data.choices?.[0]?.message || {};
};

const executeTodoTool = async (db, userId, toolCall) => {
  const toolName = toolCall.function?.name;
  const args = parseToolArguments(toolCall);

  if (toolName === 'create_todo') {
    const result = await createTodo(db, userId, {
      title: args.title,
      dueDate: args.dueDate || '',
      priority: args.priority || 'normal',
      tags: Array.isArray(args.tags) ? args.tags : []
    });

    return {
      action: 'create_todo',
      changed: result.status === 201,
      status: result.status,
      todo: result.body?.todo,
      message:
        result.status === 201
          ? `${result.body.todo.title}를 추가했어요.`
          : result.body?.error || '할 일을 추가하지 못했어요.'
    };
  }

  if (toolName === 'list_todos') {
    const todos = filterTodos(await listTodos(db, userId), args);

    return {
      action: 'list_todos',
      changed: false,
      todos,
      message:
        todos.length === 0
          ? '조건에 맞는 할 일이 없어요.'
          : `${todos.length}개의 할 일을 찾았어요.`
    };
  }

  if (toolName === 'delete_todo') {
    const todos = await listTodos(db, userId);
    const matches = findDeleteMatches(todos, args.query);

    if (matches.length === 0) {
      return {
        action: 'delete_todo',
        changed: false,
        candidates: [],
        message: `"${args.query || ''}"와 일치하는 할 일을 찾지 못했어요.`
      };
    }

    if (matches.length > 1) {
      return {
        action: 'delete_todo',
        changed: false,
        candidates: matches,
        message: `일치하는 할 일이 ${matches.length}개 있어요. 삭제할 항목을 더 정확히 말해주세요.`
      };
    }

    await deleteTodo(db, userId, matches[0].id);

    return {
      action: 'delete_todo',
      changed: true,
      todo: matches[0],
      message: `${matches[0].title}를 삭제했어요.`
    };
  }

  return {
    action: 'unknown',
    changed: false,
    message: '지원하지 않는 요청입니다.'
  };
};

const createFallbackReply = (toolResult) => {
  if (toolResult.action !== 'list_todos' || !Array.isArray(toolResult.todos)) {
    return toolResult.message;
  }

  if (toolResult.todos.length === 0) {
    return toolResult.message;
  }

  const titles = toolResult.todos.slice(0, 5).map((todo) => todo.title).join(', ');
  const suffix = toolResult.todos.length > 5 ? ` 외 ${toolResult.todos.length - 5}개` : '';

  return `${toolResult.message} ${titles}${suffix}`;
};

const handleTodoAgentMessage = async (
  db,
  userId,
  message,
  {
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL || 'gpt-5.5',
    openAIClient = callOpenAI
  } = {}
) => {
  const normalizedMessage = String(message || '').trim();

  if (!normalizedMessage) {
    return { status: 400, body: { error: '요청 내용을 입력하세요.' } };
  }

  if (!apiKey) {
    return { status: 503, body: { error: 'OpenAI API 키가 서버에 설정되어 있지 않습니다.' } };
  }

  const messages = [
    {
      role: 'system',
      content: [
        'You are a Korean Todo assistant.',
        'Choose exactly one todo tool when the user asks to create, list, or delete todos.',
        'Do not invent todo ids.',
        `Today is ${getTodayDateString()}.`,
        'Keep final answers brief and in Korean.'
      ].join(' ')
    },
    { role: 'user', content: normalizedMessage }
  ];

  const assistantMessage = await openAIClient({
    apiKey,
    model,
    messages,
    tools: todoTools
  });
  const toolCall = assistantMessage.tool_calls?.[0];

  if (!toolCall) {
    return {
      status: 200,
      body: {
        message: assistantMessage.content || '할 일 추가, 조회, 삭제만 도와드릴 수 있어요.',
        action: 'none',
        changed: false
      }
    };
  }

  const toolResult = await executeTodoTool(db, userId, toolCall);
  let finalMessage = createFallbackReply(toolResult);

  try {
    const finalAssistantMessage = await openAIClient({
      apiKey,
      model,
      messages: [
        ...messages,
        assistantMessage,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        }
      ],
      tools: todoTools,
      toolChoice: 'none'
    });

    finalMessage = finalAssistantMessage.content || finalMessage;
  } catch {
    finalMessage = createFallbackReply(toolResult);
  }

  return {
    status: 200,
    body: {
      ...toolResult,
      message: finalMessage
    }
  };
};

module.exports = {
  executeTodoTool,
  filterTodos,
  handleTodoAgentMessage,
  todoTools
};
