// Grab The Practical: the app (subjects -> practicals -> images and code).
import { configured } from './supabase.js';
import { ADMIN_ROUTE } from './config.js';
import * as api from './api.js';
import { highlight, LANGS, EXT } from './highlight.js';
import { compressImage } from './images.js';
import {
  $, h, rid, pad, plural, slug, safeName, toast, status, openModal, field, errBox,
  saveBlob, downloadButton,
} from './ui.js';

/* ---------------------------------------------------------------- state */

const S = {
  staged: null,
  subjects: [], practicals: [], images: [], codes: [],
  loaded: false, loadError: null,
  isAdmin: false,
  tab: 'images', tabFor: null,
  query: '',
};

const subjectById = (id) => S.subjects.find((s) => s.id === id);
const practicalById = (id) => S.practicals.find((p) => p.id === id);
const practicalsOf = (sid) =>
  S.practicals.filter((p) => p.subject_id === sid).sort((a, b) => a.number - b.number);
const imagesOf = (pid) => S.images.filter((i) => i.practical_id === pid);
const codesOf = (pid) => S.codes.filter((c) => c.practical_id === pid);
const plabel = (p) => `Practical ${pad(p.number)}`;
const pathsOfPractical = (pid) => imagesOf(pid).map((i) => i.storage_path);
const pathsOfSubject = (sid) => practicalsOf(sid).flatMap((p) => pathsOfPractical(p.id));

function fileBase(pr) {
  const s = subjectById(pr.subject_id) || {};
  return `${slug(s.code || s.name || 'practical')}-practical-${pad(pr.number)}`;
}
function codeFileName(c) {
  const base = safeName((c.title || '').replace(/\.[A-Za-z0-9]{1,4}$/, ''), 'code');
  return `${base}.${EXT[c.language] || 'txt'}`;
}

function errMsg(e) {
  const code = e && (e.code || e.statusCode);
  const text = String((e && e.message) || '');
  if (code === 'not_admin') return 'That was not allowed. Log in as admin and try again.';
  if (code === '42501' || /row-level security|violates row/i.test(text)) return 'You are not allowed to do that.';
  if (code === '23505') return 'That already exists.';
  if (/exceeded|too large|payload/i.test(text)) return 'That file is too large.';
  if (/failed to fetch|network/i.test(text)) return 'Cannot reach the server. Check your internet and try again.';
  return 'Something went wrong. Try again in a moment.';
}

/* ---------------------------------------------------------------- loading */

let refreshing = null;
let refreshAgain = false;

function refresh() {
  if (refreshing) { refreshAgain = true; return refreshing; }
  refreshing = (async () => {
    try {
      Object.assign(S, await api.loadAll());
      S.loaded = true;
      S.loadError = null;
    } catch (e) {
      S.loadError = e;
      console.error('Grab The Practical: could not load data', e);
    } finally {
      refreshing = null;
      render();
      if (refreshAgain) { refreshAgain = false; refresh(); }
    }
  })();
  return refreshing;
}

/* ---------------------------------------------------------------- admin mode */

function setAdmin(on) {
  S.isAdmin = on;
  $('#adminbar').hidden = !on;
  render();
}

async function initAuth() {
  const { data } = await api.auth.getSession();
  setAdmin(data.session ? await api.checkAdmin() : false);
  // Do not call Supabase inside this callback directly (known deadlock), so defer it.
  api.auth.onChange((_event, session) => {
    setTimeout(async () => setAdmin(session ? await api.checkAdmin() : false), 0);
  });
}

async function logOut() {
  await api.auth.signOut();
  setAdmin(false);
  toast('Admin mode is off.');
  if (location.hash === '#' + ADMIN_ROUTE) location.hash = '#home';
}

function confirmDelete(what, run) {
  if (!S.isAdmin) return;
  openModal({
    title: 'Delete this?', desc: what, body: h('div'),
    actions: [
      { label: 'Cancel', kind: 'quiet', onClick: (m) => m.close() },
      {
        label: 'Delete', kind: 'warn',
        onClick: async (m, b) => {
          b.disabled = true; m.close();
          try { await run(); await refresh(); } catch (e) { toast(errMsg(e)); } finally { status(''); }
        },
      },
    ],
  });
}

const removeSubject = (s) =>
  confirmDelete(`"${s.name}" and its ${plural(practicalsOf(s.id).length, 'practical')}, photos and code will be removed for everyone.`,
    async () => {
      status('Deleting…');
      await api.deleteSubject(s, pathsOfSubject(s.id));
      location.hash = '#home'; toast('Subject deleted.', 'del');
    });

const removePractical = (p) =>
  confirmDelete(`${plabel(p)} with all its photos and code will be removed for everyone.`,
    async () => {
      status('Deleting…');
      await api.deletePractical(p, pathsOfPractical(p.id));
      location.hash = '#subject-' + p.subject_id; toast('Practical deleted.', 'del');
    });

const removeCode = (c) =>
  confirmDelete(`"${c.title}" will be removed for everyone.`,
    async () => { status('Deleting…'); await api.deleteCode(c); toast('Code deleted.', 'del'); });

const removeImage = (img) =>
  confirmDelete('This photo will be removed for everyone.',
    async () => { status('Deleting…'); await api.deleteImage(img); toast('Photo deleted.', 'del'); });

/* ---------------------------------------------------------------- adding */

function addSubjectModal() {
  const name = h('input', { id: 'as-name', type: 'text', maxlength: '80', placeholder: 'e.g. Data Structures' });
  const code = h('input', { id: 'as-code', type: 'text', maxlength: '8', placeholder: 'e.g. DSA' });
  const er = errBox();
  openModal({
    title: 'Add a subject',
    body: h('div', {}, field('as-name', 'Subject name', name), field('as-code', 'Short code (optional)', code), er),
    actions: [
      { label: 'Cancel', kind: 'quiet', onClick: (m) => m.close() },
      {
        label: 'Add subject', kind: 'primary',
        onClick: async (m, b) => {
          const nm = name.value.trim();
          if (!nm) { er.show('Enter a subject name.'); return; }
          const base = slug(code.value.trim() || nm);
          let id = base;
          while (subjectById(id)) id = `${base}-${rid().slice(0, 3)}`;
          const position = S.subjects.reduce((a, s) => Math.max(a, s.position || 0), 0) + 1;
          b.disabled = true;
          try {
            await api.addSubject({ id, name: nm, code: code.value.trim().toUpperCase(), position });
            m.close(); toast('Subject added.', 'ok'); refresh();
          } catch (e) { b.disabled = false; er.show(errMsg(e)); }
        },
      },
    ],
  });
}

function addPracticalModal(sub) {
  const next = practicalsOf(sub.id).reduce((a, p) => Math.max(a, p.number), 0) + 1;
  const num = h('input', { id: 'ap-num', type: 'number', min: '1', max: '99', value: String(next) });
  const ttl = h('input', { id: 'ap-title', type: 'text', maxlength: '120', placeholder: 'e.g. Linear regression on a small dataset' });
  const er = errBox();
  openModal({
    title: 'Add a practical', desc: `It will appear in ${sub.name}.`,
    body: h('div', {}, h('div', { class: 'row2' }, field('ap-num', 'Practical number', num), field('ap-title', 'Title (optional)', ttl)), er),
    actions: [
      { label: 'Cancel', kind: 'quiet', onClick: (m) => m.close() },
      {
        label: 'Add practical', kind: 'primary',
        onClick: async (m, b) => {
          const n = parseInt(num.value, 10);
          if (!(n >= 1 && n <= 99)) { er.show('Enter a number from 1 to 99.'); return; }
          if (practicalsOf(sub.id).some((p) => p.number === n)) { er.show(`Practical ${n} already exists in this subject.`); return; }
          b.disabled = true;
          try {
            const row = await api.addPractical({ subject_id: sub.id, number: n, title: ttl.value.trim() });
            m.close(); await refresh(); location.hash = '#practical-' + row.id;
          } catch (e) { b.disabled = false; er.show(errMsg(e)); }
        },
      },
    ],
  });
}

function addCodeModal(pr) {
  const ttl = h('input', { id: 'ac-title', type: 'text', maxlength: '120', placeholder: 'e.g. Program 1: factorial' });
  const lang = h('select', { id: 'ac-lang' }, LANGS.map(([v, l]) => h('option', { value: v, text: l })));
  const ta = h('textarea', { id: 'ac-code', spellcheck: 'false', placeholder: 'Paste your code here' });
  const file = h('input', { type: 'file', hidden: true, accept: '.py,.c,.cpp,.cc,.java,.js,.sql,.r,.txt' });
  const er = errBox();
  const byExt = { py: 'python', c: 'c', cpp: 'cpp', cc: 'cpp', java: 'java', js: 'javascript', sql: 'sql', r: 'r' };

  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
      ta.value = String(reader.result || '');
      if (byExt[ext]) lang.value = byExt[ext];
      if (!ttl.value) ttl.value = f.name;
    };
    reader.readAsText(f);
  });

  openModal({
    title: 'Add code', desc: `For ${plabel(pr)}.`, wide: true,
    body: h('div', {},
      h('div', { class: 'row2' }, field('ac-title', 'Title', ttl), field('ac-lang', 'Language', lang)),
      h('div', { class: 'field' }, h('label', { for: 'ac-code', text: 'Code' }), ta,
        h('button', { class: 'btn', type: 'button', text: 'Load from a file', onclick: () => file.click() }), file),
      er),
    actions: [
      { label: 'Cancel', kind: 'quiet', onClick: (m) => m.close() },
      {
        label: 'Save code', kind: 'primary',
        onClick: async (m, b) => {
          const content = ta.value.replace(/\s+$/, '');
          if (!content.trim()) { er.show('Paste or load some code first.'); return; }
          if (content.length > 150000) { er.show('That file is too long. Split it into two entries.'); return; }
          b.disabled = true;
          try {
            await api.addCode({ practical_id: pr.id, title: ttl.value.trim() || 'Code', language: lang.value, content });
            m.close(); toast('Code added.', 'ok'); refresh();
          } catch (e) { b.disabled = false; er.show(errMsg(e)); }
        },
      },
    ],
  });
}

// Chosen photos wait here until the admin presses "Apply changes".
function stagePhotos(files, pr) {
  const list = [...files].filter((f) => /^image\//.test(f.type));
  if (!list.length) { toast('Choose image files (JPG, PNG or WebP).'); return; }
  const keep = S.staged && S.staged.pid === pr.id ? S.staged.files : [];
  S.staged = { pid: pr.id, files: keep.concat(list) };
  render();
}

async function uploadFiles(files, pr) {
  S.staged = null;
  const list = [...files].filter((f) => /^image\//.test(f.type));
  if (!list.length) { toast('Choose image files (JPG, PNG or WebP).'); return; }
  let ok = 0, bad = 0, lastError = null;
  for (let i = 0; i < list.length; i++) {
    status(`Uploading ${i + 1} of ${list.length}…`);
    try {
      const { blob, width, height } = await compressImage(list[i]);
      await api.uploadImage(pr.id, blob, { name: list[i].name.replace(/\.[^.]+$/, '').slice(0, 80), width, height });
      ok++;
    } catch (e) { bad++; lastError = e; }
  }
  status('');
  await refresh();
  if (bad && !ok) toast(lastError && lastError.message === 'unreadable' ? 'Could not read that image. Try a JPG or PNG.' : errMsg(lastError));
  else if (bad) toast(`${ok} uploaded, ${bad} failed.`);
  else toast(`${plural(ok, 'photo')} uploaded.`, 'ok');
}

/* ---------------------------------------------------------------- downloads */

async function downloadPhotos(pr) {
  const list = imagesOf(pr.id);
  if (!list.length) { toast('No photos in this practical yet.'); return; }
  if (!window.JSZip) { toast('Download tools are still loading. Try again in a moment.'); return; }
  const zip = new window.JSZip();
  let added = 0;
  for (let i = 0; i < list.length; i++) {
    status(`Preparing photos ${i + 1} of ${list.length}…`);
    try {
      const res = await fetch(api.publicUrl(list[i].storage_path));
      if (!res.ok) continue;
      zip.file(`${pad(i + 1)}-${safeName(list[i].name, 'photo')}.jpg`, await res.blob());
      added++;
    } catch { /* skip this photo */ }
  }
  if (!added) { status(''); toast('The photos could not be loaded. Try again.'); return; }
  const blob = await zip.generateAsync({ type: 'blob' });
  status('');
  saveBlob(blob, `${fileBase(pr)}-photos.zip`);
}

async function downloadCode(pr) {
  const list = codesOf(pr.id);
  if (!list.length) { toast('No code in this practical yet.'); return; }
  if (!window.JSZip) { toast('Download tools are still loading. Try again in a moment.'); return; }
  const zip = new window.JSZip();
  const used = new Set();
  list.forEach((c, i) => {
    let name = codeFileName(c);
    if (used.has(name)) name = name.replace(/(\.[^.]+)$/, `-${i + 1}$1`);
    used.add(name);
    zip.file(name, c.content);
  });
  saveBlob(await zip.generateAsync({ type: 'blob' }), `${fileBase(pr)}-code.zip`);
}

async function saveImage(img) {
  try {
    const res = await fetch(api.publicUrl(img.storage_path));
    saveBlob(await res.blob(), `${safeName(img.name, 'practical')}.jpg`);
  } catch { toast('Could not save the image.'); }
}

/* ---------------------------------------------------------------- lightbox */

function openLightbox(list, start) {
  const previous = document.activeElement;
  let idx = start;
  const lb = h('div', { class: 'lb', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Image viewer' });
  const stage = h('div', { class: 'lb-stage' });
  const cap = h('div', { class: 'cap' });
  const bar = h('div', { class: 'lb-bar' }, cap);
  lb.append(stage, bar);

  const show = () => {
    const m = list[idx];
    stage.replaceChildren(h('img', { src: api.publicUrl(m.storage_path), alt: m.name || 'Practical page' }));
    cap.textContent = `${m.name ? m.name + ' · ' : ''}${idx + 1} of ${list.length}`;
  };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    lb.remove();
    if (previous && previous.focus) { try { previous.focus(); } catch { /* ignore */ } }
  };
  const step = (d) => { idx = (idx + d + list.length) % list.length; show(); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  };

  if (list.length > 1) {
    bar.append(
      h('button', { class: 'btn', type: 'button', text: 'Previous', onclick: () => step(-1) }),
      h('button', { class: 'btn', type: 'button', text: 'Next', onclick: () => step(1) }));
  }
  bar.append(h('button', { class: 'btn', type: 'button', text: 'Save image', onclick: () => saveImage(list[idx]) }));
  if (S.isAdmin) {
    bar.append(h('button', {
      class: 'btn danger', type: 'button', text: 'Delete',
      onclick: () => { const m = list[idx]; close(); removeImage(m); },
    }));
  }
  bar.append(h('button', { class: 'btn', type: 'button', text: 'Close', onclick: close }));
  document.addEventListener('keydown', onKey);
  $('#layer').append(lb);
  show();
}

/* ---------------------------------------------------------------- views */

function route() {
  const m = location.hash.slice(1);
  if (m === ADMIN_ROUTE) return { v: 'admin' };
  if (m.startsWith('subject-')) return { v: 'subject', id: m.slice(8) };
  if (m.startsWith('practical-')) return { v: 'practical', id: m.slice(10) };
  return { v: 'home' };
}

function crumbs(items) {
  const nav = h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' });
  items.forEach((it, i) => {
    if (i) nav.append(h('span', { text: '/', 'aria-hidden': 'true' }));
    nav.append(it.href ? h('a', { href: it.href, text: it.label }) : h('span', { 'aria-current': 'page', text: it.label }));
  });
  return nav;
}

const notFound = (what) =>
  h('div', { class: 'empty' },
    h('p', { text: `This ${what} is not here. It may have been deleted.` }),
    h('a', { class: 'btn', href: '#home', text: 'Back to all subjects' }));

const loadingView = (label) =>
  h('div', {}, crumbs([{ label: 'Subjects', href: '#home' }, { label }]), h('div', { class: 'skeleton' }));

function viewHome() {
  const out = h('div');
  out.append(h('div', { class: 'head' },
    h('div', {},
      h('h1', { text: 'Pick a subject.' }),
      h('p', { class: 'lede', text: 'Find your practical, then grab the photos and the code.' }))));
  if (!S.loaded) {
    out.append(h('div', { class: 'grid' }, [1, 2, 3, 4, 5].map(() => h('div', { class: 'skeleton' }))));
    return out;
  }
  if (!S.subjects.length) {
    out.append(h('div', { class: 'empty' },
      h('p', { text: S.isAdmin ? 'No subjects yet. Add the first one to get started.' : 'No subjects yet. Check back soon.' }),
      S.isAdmin ? h('button', { class: 'btn primary', type: 'button', text: 'Add a subject', onclick: addSubjectModal }) : null));
    return out;
  }
  const grid = h('div', { class: 'grid' });
  for (const s of S.subjects) {
    const mine = practicalsOf(s.id);
    const ids = new Set(mine.map((p) => p.id));
    const files = S.images.filter((i) => ids.has(i.practical_id)).length + S.codes.filter((c) => ids.has(c.practical_id)).length;
    grid.append(h('a', { class: 'tile', href: '#subject-' + s.id },
      h('span', { class: 'code', text: s.code || 'SUBJECT' }),
      h('h3', { text: s.name }),
      h('span', { class: 'meta', text: `${plural(mine.length, 'practical')} · ${plural(files, 'file')}` })));
  }
  if (S.isAdmin) grid.append(h('button', { class: 'tile add', type: 'button', onclick: addSubjectModal }, '+ Add a subject'));
  out.append(grid);
  return out;
}

function viewSubject(r) {
  if (!S.loaded) return loadingView('Loading…');
  const s = subjectById(r.id);
  if (!s) return h('div', {}, crumbs([{ label: 'Subjects', href: '#home' }, { label: 'Not found' }]), notFound('subject'));
  const out = h('div');
  out.append(crumbs([{ label: 'Subjects', href: '#home' }, { label: s.name }]));
  const actions = h('div', { class: 'head-actions' });
  if (S.isAdmin) {
    actions.append(
      h('button', { class: 'btn primary', type: 'button', text: 'Add practical', onclick: () => addPracticalModal(s) }),
      h('button', { class: 'btn danger', type: 'button', text: 'Delete subject', onclick: () => removeSubject(s) }));
  }
  out.append(h('div', { class: 'head' },
    h('div', {}, h('div', { class: 'eyebrow', text: s.code || 'Subject' }), h('h1', { text: s.name })), actions));

  const list = practicalsOf(s.id);
  if (!list.length) {
    out.append(h('div', { class: 'empty' },
      h('p', { text: 'No practicals here yet.' }),
      S.isAdmin ? h('button', { class: 'btn primary', type: 'button', text: 'Add Practical 01', onclick: () => addPracticalModal(s) }) : null));
    return out;
  }
  const box = h('div', { class: 'plist' });
  for (const p of list) {
    box.append(h('a', { class: 'prow', href: '#practical-' + p.id },
      h('span', { class: 'no', text: pad(p.number) }),
      h('span', {}, h('div', { class: 'ttl', text: p.title || plabel(p) }), p.title ? h('div', { class: 'sub', text: plabel(p) }) : null),
      h('span', { class: 'cnt', text: `${plural(imagesOf(p.id).length, 'photo')} · ${plural(codesOf(p.id).length, 'code file')}` })));
  }
  out.append(box);
  return out;
}

function codeCard(c) {
  const langName = (LANGS.find((l) => l[0] === c.language) || ['', 'Code'])[1];
  const pre = h('pre', { class: 'code-body', tabindex: '0' });
  pre.innerHTML = highlight(c.content, c.language || 'text'); // highlight() escapes everything

  const copy = h('button', { class: 'btn', type: 'button', text: 'Copy' });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(c.content);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1500);
    } catch {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(pre);
      sel.removeAllRanges(); sel.addRange(range);
      toast('Selected. Press Ctrl+C to copy.');
    }
  });

  const head = h('div', { class: 'code-head' },
    h('span', { class: 't', text: c.title }), h('span', { class: 'lang', text: langName }), copy,
    h('button', {
      class: 'btn', type: 'button', text: 'Download',
      onclick: () => saveBlob(new Blob([c.content], { type: 'text/plain' }), codeFileName(c)),
    }));
  if (S.isAdmin) head.append(h('button', { class: 'btn danger', type: 'button', text: 'Delete', onclick: () => removeCode(c) }));
  return h('article', { class: 'code-card' }, head, pre);
}

function thumb(m, list, i) {
  const img = h('img', { src: api.publicUrl(m.storage_path), alt: m.name || 'Practical page', loading: 'lazy', draggable: 'false' });
  const b = h('button', {
    class: 'thumb loading', type: 'button', 'aria-label': 'Open ' + (m.name || `photo ${i + 1}`),
    onclick: () => openLightbox(list, i),
  }, img, m.name ? h('span', { class: 'thumb-name', text: m.name }) : null);
  img.addEventListener('load', () => b.classList.remove('loading'));
  img.addEventListener('error', () => { b.classList.remove('loading'); b.classList.add('missing'); img.hidden = true; });
  return b;
}

function viewPractical(r) {
  if (!S.loaded) return loadingView('Loading…');
  const pr = practicalById(r.id);
  if (!pr) return h('div', {}, crumbs([{ label: 'Subjects', href: '#home' }, { label: 'Not found' }]), notFound('practical'));
  const s = subjectById(pr.subject_id);
  if (S.tabFor !== pr.id) { S.tab = 'images'; S.tabFor = pr.id; }
  const imgs = imagesOf(pr.id);
  const codes = codesOf(pr.id);

  const out = h('div');
  out.append(crumbs([
    { label: 'Subjects', href: '#home' },
    s ? { label: s.name, href: '#subject-' + s.id } : { label: 'Subject' },
    { label: plabel(pr) }]));

  const actions = h('div', { class: 'head-actions' },
    downloadButton('Download photos', () => downloadPhotos(pr), imgs.length === 0),
    downloadButton('Download code', () => downloadCode(pr), codes.length === 0));
  if (S.isAdmin) actions.append(h('button', { class: 'btn danger', type: 'button', text: 'Delete practical', onclick: () => removePractical(pr) }));
  out.append(h('div', { class: 'head' },
    h('div', {},
      h('div', { class: 'eyebrow', text: `${s && s.code ? s.code + ' · ' : ''}${plabel(pr)}` }),
      h('h1', { text: pr.title || (s ? s.name : plabel(pr)) })),
    actions));

  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  for (const [key, label, n] of [['images', 'Images', imgs.length], ['code', 'Code', codes.length]]) {
    tabs.append(h('button', {
      class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(S.tab === key),
      onclick: () => { S.tab = key; render(); },
    }, label, h('span', { class: 'n', text: String(n) })));
  }
  out.append(tabs);

  if (S.tab === 'images') {
    const drop = h('div', { class: 'drop' },
      h('p', { text: 'Add photos of the written practical. They are shrunk so they stay readable and load fast.' }),
      h('button', {
        class: 'btn primary', type: 'button', text: 'Add photos',
        onclick: () => { $('#pick').dataset.pid = pr.id; $('#pick').click(); },
      }));
    for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
    for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
    drop.addEventListener('drop', (e) => { if (e.dataTransfer?.files) stagePhotos(e.dataTransfer.files, pr); });
    if (S.isAdmin) out.append(drop);
    if (S.isAdmin && S.staged && S.staged.pid === pr.id && S.staged.files.length) {
      const f = S.staged.files;
      out.append(h('div', { class: 'staged' },
        h('p', { text: `${plural(f.length, 'photo')} ready: ${f.map((x) => x.name).slice(0, 3).join(', ')}${f.length > 3 ? '…' : ''}` }),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', text: 'Clear', onclick: () => { S.staged = null; render(); } }),
          h('button', { class: 'btn primary', type: 'button', text: 'Apply changes', onclick: () => uploadFiles(f, pr) }))));
    }
    if (!imgs.length) out.append(h('div', { class: 'empty' }, h('p', { text: S.isAdmin ? 'No photos yet. Add the pages of this practical.' : 'No photos here yet.' })));
    else out.append(h('div', { class: 'pics' }, imgs.map((m, i) => thumb(m, imgs, i))));
  } else {
    if (S.isAdmin) out.append(h('div', { class: 'drop' },
      h('p', { text: 'Paste a program or load a file. It is shown with colours and a copy button.' }),
      h('button', { class: 'btn primary', type: 'button', text: 'Add code', onclick: () => addCodeModal(pr) })));
    if (!codes.length) out.append(h('div', { class: 'empty' }, h('p', { text: 'No code yet for this practical.' })));
    else out.append(h('div', { class: 'codes' }, codes.map(codeCard)));
  }
  return out;
}

function viewSearch(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (text) => { const t = text.toLowerCase(); return words.every((w) => t.includes(w)); };
  const out = h('div', {}, h('div', { class: 'head' }, h('div', {}, h('h1', { text: 'Search' }), h('p', { class: 'lede', text: `Results for "${q}"` }))));

  const subs = S.subjects.filter((s) => hit(`${s.name} ${s.code || ''}`));
  const prs = S.practicals.filter((p) => {
    const s = subjectById(p.subject_id) || {};
    return hit([s.name, s.code, plabel(p), `practical ${p.number}`, p.title].join(' '));
  });
  const cds = S.codes.filter((c) => {
    const p = practicalById(c.practical_id) || {};
    const s = subjectById(p.subject_id) || {};
    return hit([s.name, s.code, p.number ? `practical ${p.number}` : '', c.title, c.language, c.content].join(' '));
  }).slice(0, 30);

  if (!subs.length && !prs.length && !cds.length) {
    out.append(h('div', { class: 'empty' }, h('p', { text: 'Nothing matches that. Try a subject code or a practical number.' })));
    return out;
  }
  if (subs.length) out.append(h('section', { class: 'res-group' }, h('h2', { text: 'Subjects' }),
    subs.map((s) => h('a', { class: 'res', href: '#subject-' + s.id }, h('b', { text: s.name }), h('small', { text: s.code || '' })))));
  if (prs.length) out.append(h('section', { class: 'res-group' }, h('h2', { text: 'Practicals' }),
    prs.slice(0, 40).map((p) => h('a', { class: 'res', href: '#practical-' + p.id },
      h('b', { text: plabel(p) + (p.title ? ' · ' + p.title : '') }), h('small', { text: (subjectById(p.subject_id) || {}).name || '' })))));
  if (cds.length) out.append(h('section', { class: 'res-group' }, h('h2', { text: 'Code' }),
    cds.map((c) => {
      const p = practicalById(c.practical_id);
      const s = p ? subjectById(p.subject_id) : null;
      return h('a', { class: 'res', href: p ? '#practical-' + p.id : '#home' },
        h('b', { text: c.title }), h('small', { text: `${s ? s.name : ''}${p ? ' · ' + plabel(p) : ''}` }));
    })));
  return out;
}

/* Admin login: only reachable through the secret address in config.js */
function viewAdmin() {
  const out = h('div', { class: 'adm' }, h('h1', { text: 'Admin' }));
  const er = errBox();

  if (S.isAdmin) {
    out.append(
      h('p', { class: 'lede', text: 'Admin mode is on. Delete buttons now show on subjects, practicals, photos and code.' }),
      h('div', { class: 'actions', style: 'justify-content:flex-start;margin-top:16px' },
        h('button', { class: 'btn primary', type: 'button', text: 'Back to the shelf', onclick: () => (location.hash = '#home') }),
        h('button', { class: 'btn', type: 'button', text: 'Log out', onclick: logOut })));
    return out;
  }

  out.append(
    h('p', { class: 'lede', text: 'Log in to delete subjects, practicals, photos and code.' }),
    h('form', {
      onsubmit: async (e) => {
        e.preventDefault(); er.hidden = true;
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          const { error } = await api.auth.signIn($('#ad-email').value.trim(), $('#ad-pw').value);
          if (error) { er.show('Wrong email or password.'); return; }
          if (!(await api.checkAdmin())) {
            await api.auth.signOut();
            er.show('This account is not set up as an admin. See docs/SETUP.md, step 5.');
            return;
          }
          setAdmin(true); toast('Admin mode is on.'); location.hash = '#home';
        } catch (x) { er.show(errMsg(x)); } finally { btn.disabled = false; }
      },
    },
      field('ad-email', 'Email', h('input', { id: 'ad-email', type: 'email', autocomplete: 'username', required: true })),
      field('ad-pw', 'Password', h('input', { id: 'ad-pw', type: 'password', autocomplete: 'current-password', required: true })),
      er,
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'submit', text: 'Log in' }))));
  return out;
}

function viewSetup() {
  return h('div', { class: 'adm' },
    h('h1', { text: 'Almost ready.' }),
    h('p', { class: 'lede', text: 'This site is not connected to a Supabase project yet.' }),
    h('ol', { class: 'setup-list' },
      h('li', { text: 'Create a Supabase project and run supabase/schema.sql in its SQL editor.' }),
      h('li', { text: 'Copy the Project URL and the anon public key into assets/js/config.js.' }),
      h('li', { text: 'Redeploy. The full steps are in docs/SETUP.md.' })));
}

/* ---------------------------------------------------------------- render */

/** Turns a load failure into a sentence that says what to fix. */
function loadErrorText(e) {
  const code = String((e && (e.code || e.status)) || '');
  const msg = String((e && e.message) || '');
  if (code === '42501' || /permission denied/i.test(msg)) {
    return 'The database is blocking access. Run supabase/schema.sql again (it has the grant lines). See docs/SETUP.md, Troubleshooting.';
  }
  if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(msg)) {
    return 'The tables are missing. Run supabase/schema.sql in the Supabase SQL Editor.';
  }
  if (/invalid api key|jwt/i.test(msg)) {
    return 'Supabase rejected the key. Check SUPABASE_ANON_KEY in assets/js/config.js.';
  }
  return `Could not load the shelf: ${msg || 'unknown error'}. Open the browser console (F12) for details.`;
}

let rafId = 0;
let adminShown = null;

function render() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(draw);
}

function draw() {
  const main = $('#main');
  const notice = $('#notice');
  if (!configured) { main.replaceChildren(viewSetup()); return; }

  const q = S.query.trim();
  const r = route();
  let view;
  if (r.v === 'admin' && !q) {
    // Keep what is being typed: rebuild the login form only when admin state changes.
    if (adminShown === S.isAdmin && main.querySelector('.adm')) return;
    adminShown = S.isAdmin;
    view = viewAdmin();
  } else {
    adminShown = null;
    if (q && S.loaded) view = viewSearch(q);
    else if (r.v === 'subject') view = viewSubject(r);
    else if (r.v === 'practical') view = viewPractical(r);
    else view = viewHome();
  }
  main.replaceChildren(view);

  if (S.loadError) { notice.textContent = loadErrorText(S.loadError); notice.hidden = false; }
  else notice.hidden = true;
}

/* ---------------------------------------------------------------- boot */

function boot() {
  draw();
  if (!configured) return;

  window.addEventListener('hashchange', () => { S.query = ''; $('#q').value = ''; scrollTo(0, 0); render(); });
  $('#q').addEventListener('input', (e) => { S.query = e.target.value; render(); });
  $('#lockBtn').addEventListener('click', logOut);
  $('#pick').addEventListener('change', (e) => {
    const pr = practicalById(e.target.dataset.pid);
    if (pr && e.target.files.length) stagePhotos(e.target.files, pr);
    e.target.value = '';
  });

  refresh();
  initAuth();
  let timer;
  api.watchChanges(() => { clearTimeout(timer); timer = setTimeout(refresh, 400); });
}

boot();