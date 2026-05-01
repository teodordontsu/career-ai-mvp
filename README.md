# Career AI MVP

Рабочий локальный MVP профориентационного приложения.

## Что есть

- выбор аудитории: ученик, родитель ученика, взрослый специалист;
- общий AI-чат для всех ролей;
- сбор профиля по критериям;
- уточняющие вопросы;
- подбор 5 профессий из JSON-базы;
- демо-покупка полной карточки профессии за 500 ₽;
- mock-режим без ключа OpenAI;
- OpenAI API режим при наличии `OPENAI_API_KEY`.

## Локальный запуск

```powershell
cd C:\Users\79060\Documents\Codex\2026-05-01\5-5\career-ai-mvp
node server.js
```

Открыть:

```text
http://localhost:3000
```

## Подключение OpenAI

По умолчанию приложение работает в mock-режиме. Чтобы включить реальный OpenAI API:

```powershell
$env:OPENAI_API_KEY="sk-..."
$env:OPENAI_MODEL="gpt-4.1-mini"
node server.js
```

API-ключ хранится только на backend-сервере и не попадает в браузер.

## Деплой в интернет

Для Render / Railway / другого Node.js хостинга:

- root directory: `career-ai-mvp`;
- build command: пусто или `npm install`;
- start command: `node server.js`;
- environment variables:
  - `OPENAI_API_KEY=ваш_ключ_OpenAI`;
  - `OPENAI_MODEL=gpt-4.1-mini` опционально.

После деплоя хостинг выдаст публичную HTTPS-ссылку. Ее можно открыть на телефоне и добавить приложение на главный экран как PWA.

## Важное

Оплата сейчас демо. Для настоящей оплаты нужно подключить платежного провайдера и заменить `/api/purchase` на реальный checkout.

Файл `data/sessions.json` подходит только для локального MVP. Для реальных пользователей нужна база данных: PostgreSQL, MongoDB, Supabase, Firebase или аналог.
