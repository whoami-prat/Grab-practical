# Changelog

## 1.0.0

First complete version.

- Landing page and app on static hosting (Vercel).
- Subjects, practicals, image uploads and code snippets stored in Supabase.
- Five starter subjects: AIML, PPS, VOC, EP, CS.
- Separate zip downloads for photos and code.
- Search, syntax colours, copy button, live updates.
- Admin-only deleting through Supabase Auth and row level security.
- Setup, architecture and security documentation.

## Read-only for students
- Students can only view and download. Adding, uploading and deleting are admin-only (row level security, Data API grants and Storage policies).
- Re-run `supabase/schema.sql` once to close the old open-upload rules.
