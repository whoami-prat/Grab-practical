// All talking to Supabase lives here, so the UI code never touches the database directly.
import { supabase } from './supabase.js';
import { BUCKET } from './config.js';

function check(error) {
  if (error) throw error;
}

/* ---------- reading ---------- */

export async function loadAll() {
  const [subjects, practicals, images, codes] = await Promise.all([
    supabase.from('subjects').select('*').order('position'),
    supabase.from('practicals').select('*').order('number'),
    supabase.from('images').select('*').order('created_at'),
    supabase.from('codes').select('*').order('created_at'),
  ]);
  [subjects, practicals, images, codes].forEach((r) => check(r.error));
  return {
    subjects: subjects.data,
    practicals: practicals.data,
    images: images.data,
    codes: codes.data,
  };
}

export function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ---------- adding (admins only, enforced by row level security) ---------- */

export async function addSubject(row) {
  check((await supabase.from('subjects').insert(row)).error);
}

export async function addPractical(row) {
  const { data, error } = await supabase.from('practicals').insert(row).select().single();
  check(error);
  return data;
}

export async function addCode(row) {
  check((await supabase.from('codes').insert(row)).error);
}

/** Uploads the file to Storage first, then records it in the images table. */
export async function uploadImage(practicalId, blob, meta) {
  const path = `${practicalId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  check(up.error);
  const ins = await supabase.from('images').insert({
    practical_id: practicalId,
    storage_path: path,
    name: meta.name,
    width: meta.width,
    height: meta.height,
    size_bytes: blob.size,
  });
  if (ins.error) {
    await supabase.storage.from(BUCKET).remove([path]); // do not leave an orphan file
    throw ins.error;
  }
}

/* ---------- deleting (admins only, enforced by row level security) ---------- */

async function deleteRows(table, column, value) {
  const { data, error } = await supabase.from(table).delete().eq(column, value).select('id');
  check(error);
  if (!data || data.length === 0) {
    // Row level security hides the row from non-admins instead of raising an error.
    throw Object.assign(new Error('Nothing was deleted'), { code: 'not_admin' });
  }
}

async function removeFiles(paths) {
  for (let i = 0; i < paths.length; i += 100) {
    check((await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))).error);
  }
}

// Rows go first: if the admin check fails, no file has been touched yet.
export async function deleteImage(image) {
  await deleteRows('images', 'id', image.id);
  await removeFiles([image.storage_path]);
}
export async function deleteCode(code) {
  await deleteRows('codes', 'id', code.id);
}
export async function deletePractical(practical, filePaths) {
  await deleteRows('practicals', 'id', practical.id); // images and codes cascade
  await removeFiles(filePaths);
}
export async function deleteSubject(subject, filePaths) {
  await deleteRows('subjects', 'id', subject.id); // practicals, images and codes cascade
  await removeFiles(filePaths);
}

/* ---------- admin login ---------- */

export const auth = {
  signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
  getSession: () => supabase.auth.getSession(),
  onChange: (callback) => supabase.auth.onAuthStateChange(callback),
};

/** True only if the logged-in user is listed in the admins table. */
export async function checkAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/* ---------- live updates ---------- */

export function watchChanges(callback) {
  return supabase
    .channel('gtp-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, callback)
    .subscribe();
}
