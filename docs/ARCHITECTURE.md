# Architecture

## Overview

```
 Browser (HTML, CSS, JS modules)
   │  served as static files
   ▼
 Vercel ───────────────────────────────────────────────┐
                                                       │ (only serves files)
 Browser ── supabase-js ──►  Supabase                   │
                              ├─ Postgres   subjects, practicals, images, codes, admins
                              ├─ Storage    "practicals" bucket (photos)
                              ├─ Auth       admin login
                              └─ Realtime   live refresh
```

Vercel only delivers the static files. All data goes straight from the browser to Supabase.

## Why there is no separate backend

A backend such as Express on Render would only forward requests to the database. Supabase already provides what we need: an API for the tables, file storage, login and live updates. The security rules live in the database itself (row level security), so they apply no matter how the data is reached. Fewer parts means fewer things to deploy, pay for and break.

If the project later needs private logic, such as moderation or email alerts, a Supabase Edge Function or a Vercel serverless function can be added without changing the rest.

## Data model

```
subjects (id PK, name, code, position)
   └─< practicals (id PK, subject_id FK, number, title)   unique (subject_id, number)
          ├─< images (id PK, practical_id FK, storage_path, name, width, height, size_bytes)
          └─< codes  (id PK, practical_id FK, title, language, content)

admins (user_id PK -> auth.users)
```

Foreign keys use `on delete cascade`, so deleting a subject removes its practicals, images and code rows in one step. Files in Storage are removed by the app right after, because the database cannot delete files by itself.

## Request flow

**Reading.** On load, `api.loadAll()` fetches the four tables in parallel. The app keeps them in memory and re-renders. A Realtime subscription triggers a reload after any change.

**Adding a photo (admin only).** The browser shrinks the image (`images.js`), uploads it to `practicals/<practical_id>/<uuid>.jpg`, then inserts an `images` row. If the row insert fails, the uploaded file is removed again.

**Adding code (admin only).** One insert into `codes`. The text is shown through an escaping highlighter, so pasted code can never run as HTML.

**Deleting.** Rows are deleted first. If the database returns no deleted row, the user is not an admin and the app stops before touching any file. Only then are the Storage files removed.

**Admin login.** Supabase Auth signs in with email and password. The app then calls the `is_admin()` database function. Being signed in is not enough: the account must be listed in the `admins` table.

## Frontend modules

| File | Job |
| --- | --- |
| `config.js` | Supabase URL, anon key, bucket name, secret admin route |
| `supabase.js` | Creates the Supabase client |
| `api.js` | Every database, storage and auth call |
| `app.js` | State, views, forms, routing |
| `ui.js` | Element builder, toast, modal, download helpers |
| `highlight.js` | Syntax colouring |
| `images.js` | Browser-side photo compression |

Routing uses the URL hash (`#subject-pps`, `#practical-<id>`), so Vercel needs no rewrite rules.
