// =====================================================================
// Project settings. Edit the two Supabase values below, then redeploy.
//
// Where to find them: Supabase dashboard -> Settings -> API Keys
//   - Project URL (also shown in the Connect dialog) -> SUPABASE_URL
//   - Publishable key (starts with sb_publishable_)  -> SUPABASE_ANON_KEY
//     (Older projects: the legacy "anon" key, which starts with eyJ, also works.)
//
// The publishable key is meant to be public: it only does what the row level
// security rules in supabase/schema.sql allow. NEVER paste a "secret" key
// (sb_secret_...) or the legacy "service_role" key anywhere in this project.
// =====================================================================

export const SUPABASE_URL = 'https://xwhyxnnpimtywqximago.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3aHl4bm5waW10eXdxeGltYWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0Mzc0OTksImV4cCI6MjExMTAxMzQ5OX0.XIsar8A3YfDKrFcfzPtSUFM2MKB48b0T5VDL1iw018o';

// Storage bucket created by supabase/schema.sql
export const BUCKET = 'practicals';

// The admin login page is not linked anywhere. Open it by adding this to the
// end of the app address, e.g. https://your-site.vercel.app/app/#gtp-x7k2q9m4
// Change it to any other random letters, digits and hyphens.
export const ADMIN_ROUTE = 'gtp-x7k2q9m4';
