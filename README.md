# Todo List (JSON Server + React Context)

Версия для отдельного ДЗ:
- за основу взят формат задания с JSON Server (без Firebase);
- использован `React Context` там, где это уместно;
- `useReducer` и flux-подход не используются.

## Реализовано

- CRUD для задач;
- поиск по фразе;
- сортировка A-Z по кнопке;
- debounce для поиска;
- единый store через Context (`TodoContext`), из которого берут данные:
  - форма добавления;
  - панель поиска/сортировки;
  - список задач.

## Запуск

1. Установить зависимости:
```bash
npm install
```

2. Запустить JSON Server:
```bash
npm run server
```

3. В отдельном терминале запустить приложение:
```bash
npm start
```

Открыть:
`http://localhost:3000`

## API

JSON Server:
`http://127.0.0.1:3001`

Todos endpoint:
`http://127.0.0.1:3001/todos`
