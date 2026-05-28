const parseTags = (tags) => {
  try {
    const parsedTags = JSON.parse(tags || '[]');
    return Array.isArray(parsedTags) ? parsedTags : [];
  } catch {
    return [];
  }
};

const mapTodoRow = (row) => ({
  id: String(row.id),
  title: row.text,
  completed: Boolean(row.completed),
  dueDate: row.due_date || '',
  priority: row.priority || 'normal',
  tags: parseTags(row.tags),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

module.exports = {
  mapTodoRow
};
