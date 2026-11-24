# Security notes

## What is enforced, and where

All rules are in `supabase/schema.sql`, inside the database. The website cannot bypass them.

| Action | Who | How |
| --- | --- | --- |
| Read subjects, practicals, code, photos | Everyone | `select` policy for `anon` |
| Add subjects, practicals, code, photos | Admins only | `insert` policy checks `is_admin()` (database and Storage) |
| Edit anything | Nobody | No `update` policy exists |
| Delete rows or photo files | Admins only | `delete` policy checks `is_admin()` |
| Read the admins list | Nobody | Row level security on, no policy |
| Register a new account | Nobody | Turn off sign-ups (SETUP.md, step 6) |

## Why the admin password is not in the page

An earlier prototype stored a password hash in the shared data. Anyone who could open it could read the hash. This version uses Supabase Auth, so the password never reaches the browser source and the check happens on the server.

## Keys

- The **publishable key** (`sb_publishable_...`, formerly the "anon" key) in `config.js` is public by design. Row level security limits it.
- The **secret key** (`sb_secret_...`) and the legacy **service_role key** bypass all rules. They must never be placed in this project, in GitHub or in Vercel.

## Known limits

- **Read-only for students.** Visitors can view and download only. Everything is added by an admin, so spam is not possible without an admin account. Photos are still limited to 2 MB and JPEG, PNG or WebP, and code to 150,000 characters.
- **Every admin can add and delete.** If more class members need to upload, add them to the `admins` table (SETUP.md, step 5). They can then delete too, so only add people you trust.
- **Public photos.** A photo URL works for anyone who has it.
- **No editing.** A mistake means delete and re-add. This keeps the data trustworthy.
- **Free plan.** Supabase free projects have storage, bandwidth and inactivity limits. Check the dashboard before demo day.

## Ideas for hardening

1. Add a separate "uploader" role so trusted students can add content without being able to delete it.
2. Add a `by` column filled from `auth.uid()` so uploads can be traced.
3. Let students send a practical for the admin to approve before it shows.
