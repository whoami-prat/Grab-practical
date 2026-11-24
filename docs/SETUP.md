# Setup guide

About 20 minutes. You need a free [Supabase](https://supabase.com) account, a free [Vercel](https://vercel.com) account and a [GitHub](https://github.com) account.

## 1. Create the Supabase project

1. In Supabase, choose **New project**. Pick any name, a strong database password and the region closest to you.
2. Wait about a minute until the project finishes setting up.

## 2. Create the tables, rules and bucket

1. Open **SQL Editor -> New query**.
2. Paste the whole content of `supabase/schema.sql` and press **Run**.
3. You should see "Success. No rows returned". The script is safe to run again.

This creates the tables, the security rules, the `practicals` photo bucket and the five starter subjects.

Students can only view and download. Adding, uploading and deleting are limited to admins. If you ran an older version of this file, run this one again: it closes the old open-upload rules and keeps all your data.

## 3. Connect the website to Supabase

1. In Supabase open **Settings -> API Keys**.
2. Copy the **Publishable key** (it starts with `sb_publishable_`). If your project is older and shows a legacy **anon** key instead, that works too.
3. Copy the **Project URL** from the **Connect** button at the top of the dashboard (or from Settings -> Data API).
4. Paste them into `assets/js/config.js` (the variable is still called `SUPABASE_ANON_KEY`, put the publishable key in it):

   ```js
   export const SUPABASE_URL = 'https://abcdxyz.supabase.co';
   export const SUPABASE_ANON_KEY = 'sb_publishable_...';
   ```

5. Change `ADMIN_ROUTE` in the same file to your own random text, for example `gtp-r4n9d0m`.

> Never use the **secret** key (`sb_secret_...`) or the legacy `service_role` key. The publishable key is safe to publish because the database rules limit what it can do. Supabase plans to retire the legacy `anon` and `service_role` keys by the end of 2026, so prefer the publishable key.

## 4. Preview on your computer

```bash
npm start
```

Open http://localhost:3000. Without Node you can run `python3 -m http.server 3000` instead.

Check that the five subjects show. Adding content needs the admin login from step 5, so test uploads after that.

## 5. Create the admin account

1. In Supabase open **Authentication -> Users -> Add user -> Create new user**.
2. Enter your admin email and a strong password. Tick **Auto Confirm User**.
3. Back in the **SQL Editor** run this once, with your email:

   ```sql
   insert into public.admins (user_id)
     select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
     on conflict do nothing;
   ```

4. Open `http://localhost:3000/app/#YOUR-ADMIN-ROUTE` and log in. "Admin mode" and a Log out button appear at the top.

   Delete buttons are inside the pages, not on the home page:
   - open a subject to see **Delete subject**
   - open a practical to see **Delete practical** and a **Delete** on each code card
   - open a photo to see **Delete** in the viewer

   If the home page shows only grey boxes, the data is not loading yet. See Troubleshooting below.

## 6. Turn off public sign-ups

The site never lets visitors register, so close that door.

**Authentication -> Sign In / Providers -> Email** -> switch off **Allow new users to sign up**. Your admin account keeps working.

## 7. Put the code on GitHub

```bash
git remote add origin https://github.com/YOUR-NAME/grab-the-practical.git
git branch -M main
git push -u origin main
```

## 8. Deploy on Vercel

1. In Vercel choose **Add New -> Project** and import the GitHub repository.
2. Framework preset: **Other**. Leave the build command and output directory empty.
3. Press **Deploy**. Vercel gives you a link like `https://grab-the-practical.vercel.app`.

Every push to `main` redeploys automatically.

## 9. Final check

- Open the Vercel link on your phone.
- Log in as admin, add a practical, upload a photo and add a code snippet. Then open the site on another device without logging in: everything shows, and there are no Add or Delete buttons.
- Download photos and code from a practical.
- Log in at the secret admin address and delete the test practical.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The app shows "Almost ready" | `config.js` still has the placeholder values. Edit it and redeploy. |
| The shelf never loads, grey boxes stay forever | Press F12, open **Console**. If it says `permission denied for table` (code 42501), run `supabase/schema.sql` again. Newer Supabase projects do not expose new tables automatically, and the grant lines in the file fix that. |
| "The tables are missing" | `schema.sql` has not been run, or it stopped with an error. Run it again and read the result panel. |
| "Supabase rejected the key" | Wrong key in `config.js`. Use the Publishable key from Settings -> API Keys. |
| Upload says "You are not allowed" | The storage policies are missing. Run `schema.sql` again. |
| Delete does nothing or says not allowed | You are not logged in as admin, or step 5 was skipped. |
| Admin login says "not set up as an admin" | Run the `insert into public.admins` line from step 5. |
| New uploads do not appear live | Realtime is off. Refresh the page, or re-run `schema.sql`. |
