import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import './App.css';

const JSON_SERVER_URL =
  process.env.REACT_APP_JSON_SERVER_URL || 'http://127.0.0.1:3001/todos';

const TodoContext = createContext(null);

function useTodoContext() {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodoContext must be used inside TodoProvider');
  }
  return context;
}

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function TodoProvider({ children }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTodoText, setNewTodoText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingText, setEditingText] = useState('');
  const debouncedSearch = useDebouncedValue(searchText, 350);

  useEffect(() => {
    async function loadTodos() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJson(JSON_SERVER_URL);
        setTodos(
          data.map((item) => ({
            id: String(item.id),
            text: item.text || '',
            createdAt: item.createdAt || 0
          }))
        );
      } catch (requestError) {
        setError(`Ошибка загрузки: ${requestError.message}`);
      } finally {
        setLoading(false);
      }
    }

    loadTodos();
  }, []);

  const visibleTodos = useMemo(() => {
    const normalizedQuery = debouncedSearch.trim().toLowerCase();
    let result = [...todos];

    if (normalizedQuery) {
      result = result.filter((todo) =>
        todo.text.toLowerCase().includes(normalizedQuery)
      );
    }

    if (sortAZ) {
      result.sort((a, b) =>
        a.text.localeCompare(b.text, 'ru', { sensitivity: 'base' })
      );
    }

    return result;
  }, [debouncedSearch, sortAZ, todos]);

  async function addTodo(event) {
    event.preventDefault();
    const text = newTodoText.trim();
    if (!text) {
      return;
    }

    setError('');
    try {
      const created = await fetchJson(JSON_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, createdAt: Date.now() })
      });
      setTodos((prev) => [
        ...prev,
        {
          id: String(created.id),
          text: created.text || text,
          createdAt: created.createdAt || Date.now()
        }
      ]);
      setNewTodoText('');
    } catch (requestError) {
      setError(`Ошибка добавления: ${requestError.message}`);
    }
  }

  function startEditing(todo) {
    setEditingId(todo.id);
    setEditingText(todo.text);
  }

  function cancelEditing() {
    setEditingId('');
    setEditingText('');
  }

  async function saveEditing(id) {
    const nextText = editingText.trim();
    if (!nextText) {
      return;
    }

    setError('');
    try {
      await fetchJson(`${JSON_SERVER_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nextText })
      });
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, text: nextText } : todo))
      );
      cancelEditing();
    } catch (requestError) {
      setError(`Ошибка изменения: ${requestError.message}`);
    }
  }

  async function deleteTodo(id) {
    setError('');
    try {
      await fetchJson(`${JSON_SERVER_URL}/${id}`, { method: 'DELETE' });
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
    } catch (requestError) {
      setError(`Ошибка удаления: ${requestError.message}`);
    }
  }

  const value = {
    addTodo,
    cancelEditing,
    deleteTodo,
    editingId,
    editingText,
    error,
    loading,
    newTodoText,
    saveEditing,
    searchText,
    setEditingText,
    setNewTodoText,
    setSearchText,
    setSortAZ,
    sortAZ,
    startEditing,
    visibleTodos
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
}

function TodoForm() {
  const { addTodo, newTodoText, setNewTodoText } = useTodoContext();

  return (
    <form className="add-form" onSubmit={addTodo}>
      <input
        value={newTodoText}
        onChange={(event) => setNewTodoText(event.target.value)}
        placeholder="Введите текст нового дела"
      />
      <button type="submit">Добавить</button>
    </form>
  );
}

function TodoToolbar() {
  const { searchText, setSearchText, setSortAZ, sortAZ } = useTodoContext();

  return (
    <div className="toolbar">
      <input
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder="Поиск по фразе..."
      />
      <button
        className={sortAZ ? 'toggle active' : 'toggle'}
        onClick={() => setSortAZ((prev) => !prev)}
        type="button"
      >
        {sortAZ ? 'Сортировка A-Z: Вкл' : 'Сортировка A-Z: Выкл'}
      </button>
    </div>
  );
}

function TodoList() {
  const {
    cancelEditing,
    deleteTodo,
    editingId,
    editingText,
    error,
    loading,
    saveEditing,
    setEditingText,
    startEditing,
    visibleTodos
  } = useTodoContext();

  if (loading) {
    return <p className="status">Загрузка...</p>;
  }

  return (
    <>
      {error && <p className="status error">{error}</p>}
      {!error && (
        <ul className="todo-list">
          {visibleTodos.length === 0 && (
            <li className="empty">Список пуст или ничего не найдено.</li>
          )}
          {visibleTodos.map((todo) => (
            <li key={todo.id} className="todo-item">
              {editingId === todo.id ? (
                <>
                  <input
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    className="edit-input"
                  />
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => saveEditing(todo.id)}
                      className="small"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="small ghost"
                    >
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span>{todo.text}</span>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => startEditing(todo)}
                      className="small"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      className="small danger"
                    >
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TodoPage() {
  return (
    <section className="card">
      <h1>Todo List</h1>
      <p className="hint">
        Версия на JSON Server с Context API (без useReducer и без Firebase).
      </p>
      <TodoForm />
      <TodoToolbar />
      <TodoList />
    </section>
  );
}

function App() {
  return (
    <main className="app">
      <TodoProvider>
        <TodoPage />
      </TodoProvider>
    </main>
  );
}

export default App;
