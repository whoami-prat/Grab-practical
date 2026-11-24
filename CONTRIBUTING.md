# Contributing

Thanks for helping. This is a small project, so the process is small too.

## Run it locally

```bash
npm start
```

Then open http://localhost:3000. You need your own Supabase project (see `docs/SETUP.md`).

## Branches and commits

- Work on a branch: `git switch -c feature/short-name`.
- Keep commits small and write them as `type: what changed`, for example `feat: add download buttons` or `fix: stop duplicate practical numbers`.
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`.
- Open a pull request into `main`. One teammate reviews before merging.

## Code style

- Plain JavaScript modules, no build step.
- Build page content with the `h()` helper. Do not put user text into `innerHTML`. The only exception is `highlight()`, which escapes its input.
- All Supabase calls go in `assets/js/api.js`.
- Colours come from the tokens in `assets/css/base.css`.

## Database changes

Edit `supabase/schema.sql` so it stays safe to run twice, and mention the change in the pull request so everyone re-runs it.

## Never commit

- A `service_role` key
- A `.env` file
- Real admin emails or passwords
