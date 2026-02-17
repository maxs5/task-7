import { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams
} from 'react-router-dom';
import './App.css';

const JSON_SERVER_URL =
  process.env.REACT_APP_JSON_SERVER_URL || 'http://127.0.0.1:3001/todos';

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

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

function HomePage() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTodoText, setNewTodoText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const debouncedSearch = useDebouncedValue(searchText, 350);

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

  useEffect(() => {
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
      result.sort((a, b) => a.text.localeCompare(b.text, 'ru', { sensitivity: 'base' }));
    }

    return result;
  }, [debouncedSearch, sortAZ, todos]);

  async function handleAddTodo(event) {
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

  return (
    <section className="card">
      <header className="header-row">
        <h1>Todo List</h1>
      </header>

      <p className="hint">
        Главная страница: добавление, поиск, сортировка и переход к задаче.
      </p>

      <form className="add-form" onSubmit={handleAddTodo}>
        <input
          value={newTodoText}
          onChange={(event) => setNewTodoText(event.target.value)}
          placeholder="Введите текст новой задачи"
        />
        <button type="submit">Добавить</button>
      </form>

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

      {loading && <p className="status">Загрузка...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && (
        <ul className="todo-list">
          {visibleTodos.length === 0 && (
            <li className="empty">Список пуст или ничего не найдено.</li>
          )}
          {visibleTodos.map((todo) => (
            <li key={todo.id} className="todo-item">
              <Link to={`/task/${todo.id}`} className="task-link" title={todo.text}>
                {todo.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadTask() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchJson(`${JSON_SERVER_URL}/${id}`);
        if (!active) {
          return;
        }
        setTask({
          id: String(data.id),
          text: data.text || ''
        });
        setEditingText(data.text || '');
      } catch (requestError) {
        if (!active) {
          return;
        }
        if (requestError.message.includes('404')) {
          navigate('/404', { replace: true });
          return;
        }
        setError(`Ошибка загрузки задачи: ${requestError.message}`);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTask();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  async function handleSave() {
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
      setTask((prev) => (prev ? { ...prev, text: nextText } : prev));
      setEditingText(nextText);
    } catch (requestError) {
      setError(`Ошибка изменения: ${requestError.message}`);
    }
  }

  async function handleDelete() {
    setError('');
    try {
      await fetchJson(`${JSON_SERVER_URL}/${id}`, { method: 'DELETE' });
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(`Ошибка удаления: ${requestError.message}`);
    }
  }

  return (
    <section className="card">
      <button className="back-button" type="button" onClick={() => navigate(-1)}>
        ← Назад
      </button>

      {loading && <p className="status">Загрузка...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && task && (
        <>
          <h1 className="task-title">Задача #{task.id}</h1>
          <p className="task-full-text">{task.text}</p>

          <div className="edit-panel">
            <label htmlFor="editText">Редактирование</label>
            <textarea
              id="editText"
              value={editingText}
              onChange={(event) => setEditingText(event.target.value)}
              rows={4}
            />
          </div>

          <div className="actions">
            <button type="button" onClick={handleSave} className="small">
              Сохранить
            </button>
            <button type="button" onClick={handleDelete} className="small danger">
              Удалить
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="card not-found">
      <h1>404</h1>
      <p>Страница не найдена.</p>
      <Link to="/" className="to-home">
        На главную
      </Link>
    </section>
  );
}

function App() {
  return (
    <BrowserRouter>
      <main className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/task/:id" element={<TaskPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
