import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  get,
  getDatabase,
  push,
  ref,
  remove,
  set,
  update
} from 'firebase/database';
import './App.css';

const MODES = {
  placeholder: 'placeholder',
  jsonServer: 'jsonServer',
  firebase: 'firebase'
};

const JSON_PLACEHOLDER_URL =
  'https://jsonplaceholder.typicode.com/todos?_limit=20';
const JSON_SERVER_URL =
  process.env.REACT_APP_JSON_SERVER_URL || 'http://localhost:3001/todos';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every(Boolean);
}

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

function createFirebaseAdapter() {
  if (!hasFirebaseConfig()) {
    return null;
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const todosRef = ref(db, 'todos');

  return {
    async list() {
      const snapshot = await get(todosRef);
      const value = snapshot.val() || {};
      return Object.entries(value).map(([id, item]) => ({
        id,
        text: item.text || '',
        createdAt: item.createdAt || Date.now()
      }));
    },
    async create(text) {
      const newRef = push(todosRef);
      const todo = {
        id: newRef.key,
        text,
        createdAt: Date.now()
      };
      await set(newRef, todo);
      return todo;
    },
    async edit(id, text) {
      await update(ref(db, `todos/${id}`), { text });
    },
    async removeById(id) {
      await remove(ref(db, `todos/${id}`));
    }
  };
}

function App() {
  const [mode, setMode] = useState(MODES.placeholder);

  const [placeholderTodos, setPlaceholderTodos] = useState([]);
  const [placeholderLoading, setPlaceholderLoading] = useState(false);
  const [placeholderError, setPlaceholderError] = useState('');

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTodoText, setNewTodoText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingText, setEditingText] = useState('');

  const debouncedSearch = useDebouncedValue(searchText, 350);

  const isCrudMode = mode === MODES.jsonServer || mode === MODES.firebase;
  const isFirebaseMode = mode === MODES.firebase;

  const firebaseAdapter = useMemo(() => {
    if (mode !== MODES.firebase) {
      return null;
    }
    return createFirebaseAdapter();
  }, [mode]);

  const loadPlaceholderTodos = useCallback(async () => {
    setPlaceholderLoading(true);
    setPlaceholderError('');
    try {
      const data = await fetchJson(JSON_PLACEHOLDER_URL);
      setPlaceholderTodos(
        data.map((item) => ({
          id: String(item.id),
          title: item.title,
          completed: item.completed
        }))
      );
    } catch (requestError) {
      setPlaceholderError(
        `Не удалось загрузить данные JSONPlaceholder: ${requestError.message}`
      );
    } finally {
      setPlaceholderLoading(false);
    }
  }, []);

  const loadCrudTodos = useCallback(async () => {
    if (!isCrudMode) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === MODES.jsonServer) {
        const data = await fetchJson(JSON_SERVER_URL);
        setTodos(
          data.map((item) => ({
            id: String(item.id),
            text: item.text || '',
            createdAt: item.createdAt || 0
          }))
        );
      } else if (mode === MODES.firebase) {
        if (!firebaseAdapter) {
          throw new Error(
            'Firebase не настроен. Заполните REACT_APP_FIREBASE_* в .env'
          );
        }
        const data = await firebaseAdapter.list();
        setTodos(data);
      }
    } catch (requestError) {
      setError(`Ошибка загрузки: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  }, [firebaseAdapter, isCrudMode, mode]);

  useEffect(() => {
    if (mode === MODES.placeholder) {
      loadPlaceholderTodos();
    } else {
      loadCrudTodos();
    }
  }, [loadCrudTodos, loadPlaceholderTodos, mode]);

  const visibleTodos = useMemo(() => {
    const normalizedQuery = debouncedSearch.trim().toLowerCase();
    let result = [...todos];

    if (normalizedQuery) {
      result = result.filter((todo) =>
        todo.text.toLowerCase().includes(normalizedQuery)
      );
    }

    if (sortAZ) {
      result.sort((a, b) => a.text.localeCompare(b.text, 'ru'));
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
      if (mode === MODES.jsonServer) {
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
      } else if (mode === MODES.firebase) {
        if (!firebaseAdapter) {
          throw new Error('Firebase не настроен');
        }
        const created = await firebaseAdapter.create(text);
        setTodos((prev) => [...prev, created]);
      }

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
      if (mode === MODES.jsonServer) {
        await fetchJson(`${JSON_SERVER_URL}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nextText })
        });
      } else if (mode === MODES.firebase) {
        if (!firebaseAdapter) {
          throw new Error('Firebase не настроен');
        }
        await firebaseAdapter.edit(id, nextText);
      }

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
      if (mode === MODES.jsonServer) {
        await fetchJson(`${JSON_SERVER_URL}/${id}`, { method: 'DELETE' });
      } else if (mode === MODES.firebase) {
        if (!firebaseAdapter) {
          throw new Error('Firebase не настроен');
        }
        await firebaseAdapter.removeById(id);
      }

      setTodos((prev) => prev.filter((todo) => todo.id !== id));
    } catch (requestError) {
      setError(`Ошибка удаления: ${requestError.message}`);
    }
  }

  return (
    <main className="app">
      <section className="card">
        <h1>Todo List</h1>
        <p className="subtitle">
          CRA + JSONPlaceholder, JSON Server и Firebase в одном интерфейсе.
        </p>

        <div className="tabs">
          <button
            className={mode === MODES.placeholder ? 'tab active' : 'tab'}
            onClick={() => setMode(MODES.placeholder)}
            type="button"
          >
            1) JSONPlaceholder
          </button>
          <button
            className={mode === MODES.jsonServer ? 'tab active' : 'tab'}
            onClick={() => setMode(MODES.jsonServer)}
            type="button"
          >
            2) JSON Server
          </button>
          <button
            className={mode === MODES.firebase ? 'tab active' : 'tab'}
            onClick={() => setMode(MODES.firebase)}
            type="button"
          >
            3) Firebase
          </button>
        </div>

        {mode === MODES.placeholder && (
          <section>
            <p className="hint">
              Пункт 1: только чтение списка дел с endpoint <code>todos</code>.
            </p>

            {placeholderLoading && <p className="status">Загрузка...</p>}
            {placeholderError && <p className="status error">{placeholderError}</p>}

            {!placeholderLoading && !placeholderError && (
              <ul className="todo-list">
                {placeholderTodos.map((todo) => (
                  <li key={todo.id} className="todo-item readonly">
                    <span>{todo.title}</span>
                    <span className={todo.completed ? 'badge done' : 'badge'}>
                      {todo.completed ? 'done' : 'open'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isCrudMode && (
          <section>
            <p className="hint">
              {isFirebaseMode
                ? 'Пункт 3: CRUD в Firebase Realtime Database. Поиск и сортировка выполняются на клиенте.'
                : 'Пункт 2: CRUD в JSON Server, поиск по фрагменту текста, debounce и переключаемая сортировка.'}
            </p>

            <form className="add-form" onSubmit={handleAddTodo}>
              <input
                value={newTodoText}
                onChange={(event) => setNewTodoText(event.target.value)}
                placeholder="Введите текст нового дела"
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
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
