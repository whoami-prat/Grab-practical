# Grab The Practical

One shared shelf where an admin adds practical photos and code, and the whole class can view and download them, organised by subject and practical number. It replaces chasing a friend for her photos in a chat.

```
Subject  ->  Practical number  ->  Images | Code
```

## Features

- Five starter subjects (AIML, PPS, VOC, EP, CS). The admin can add more.
- Practicals listed by number, with an optional title.
- **Images tab:** photos of the written practical. The admin uploads them from a phone or laptop, and they are shrunk in the browser first.
- **Code tab:** paste or load a program. Syntax colours and a copy button.
- **Two separate downloads:** all photos of a practical as one zip, all code as another.
- Search across subjects, practicals and code (`practical 5 PPS`).
- Live updates when the admin adds something.
- **Read-only for students.** Everyone can view, copy and download. Only a logged-in admin can add, upload or delete. The admin login is on a hidden address.
- Landing page that explains the project.

## Tech stack

| Part | Tool |
| --- | --- |
| Frontend | HTML, CSS and JavaScript modules (no build step), hosted on **Vercel** |
| Database | **Supabase** Postgres |
| Photo storage | **Supabase** Storage |
| Admin login | **Supabase** Auth |
| Security | Postgres row level security |

There is no separate backend server. The browser talks to Supabase directly, and the database rules in `supabase/schema.sql` decide what each visitor may do. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for why.

## Project structure

```
grab-the-practical/
├── index.html            Landing page
├── app/index.html        The app
├── assets/
│   ├── css/              base.css, landing.css, app.css
│   ├── js/               config.js, supabase.js, api.js, app.js, ui.js, highlight.js, images.js
│   └── favicon.svg
├── supabase/schema.sql   Tables, security rules, storage bucket, starter subjects
├── docs/                 SETUP.md, ARCHITECTURE.md, SECURITY.md
├── vercel.json           Vercel settings
└── package.json          Local preview script
```

## Quick start

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Put your Project URL and publishable key (Settings -> API Keys) in `assets/js/config.js`.
3. Preview locally: `npm start` (or `npx serve .`), then open http://localhost:3000.
4. Push to GitHub and import the repo in Vercel. No build command is needed.

Full steps with screenshots-level detail: **[docs/SETUP.md](docs/SETUP.md)**.

## Admin

The admin login page is not linked anywhere. Open the app and add the secret route from `assets/js/config.js` to the address, for example `/app/#gtp-x7k2q9m4`. Change that route to your own random text before you deploy.

## Limits to know about

- Every admin can add and delete. To let more people upload, add them to the `admins` table (docs/SETUP.md, step 5).
- The public bucket means anyone with a photo's link can view that photo.
- The free Supabase plan has storage and bandwidth limits. See [docs/SECURITY.md](docs/SECURITY.md).

## Responsible use

This is a place to share your own work so classmates can check it against theirs. Follow your college's academic integrity rules.

## Licence

MIT. See [LICENSE](LICENSE).
