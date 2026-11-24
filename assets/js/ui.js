// Small UI helpers: element builder, toast, status bar, modal, downloads.

export const $ = (selector, root = document) => root.querySelector(selector);

/** h('div', {class:'x', onclick: fn}, child, [children], 'text') */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(add);
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

export const rid = () => Math.random().toString(36).slice(2, 8);
export const pad = (n) => String(n).padStart(2, '0');
export const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const plural = (n, word, pl) => `${n} ${n === 1 ? word : pl || word + 's'}`;
export const slug = (s) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 's';
export const safeName = (s, fallback) =>
  (s || '').replace(/[^\w\- ]+/g, '').trim().slice(0, 50) || fallback;

/* ---------- toast and status ---------- */
let toastTimer;
export function toast(message, kind) {
  const t = $('#toast');
  t.textContent = message;
  t.className = kind || '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4200);
}
export function status(message) {
  const s = $('#status');
  s.textContent = message || '';
  s.hidden = !message;
}

/* ---------- modal ---------- */
export function openModal({ title, desc, body, actions = [], wide = false }) {
  const previous = document.activeElement;
  const overlay = h('div', { class: 'ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const box = h('div', { class: 'md' + (wide ? ' wide' : '') }, h('h2', { text: title }));
  if (desc) box.append(h('p', { class: 'desc', text: desc }));
  box.append(body);

  const api = { close, box };
  const bar = h('div', { class: 'actions' });
  for (const a of actions) {
    const btn = h('button', { class: 'btn ' + (a.kind || ''), type: 'button', text: a.label });
    btn.addEventListener('click', () => a.onClick(api, btn));
    bar.append(btn);
  }
  box.append(bar);
  overlay.append(box);

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }
  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (previous && previous.focus) { try { previous.focus(); } catch { /* ignore */ } }
  }
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  $('#layer').append(overlay);
  box.querySelector('input,textarea,select')?.focus();
  return api;
}

export const field = (id, label, control) =>
  h('div', { class: 'field' }, h('label', { for: id, text: label }), control);

export function errBox() {
  const el = h('p', { class: 'err', hidden: true });
  el.show = (message) => { el.textContent = message; el.hidden = false; };
  return el;
}

/* ---------- downloads ---------- */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

export const ICON_DOWNLOAD =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" stroke-width="1.6" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function downloadButton(label, onclick, disabled) {
  const b = h('button', { class: 'btn', type: 'button', disabled, onclick });
  b.innerHTML = ICON_DOWNLOAD;
  b.append(label);
  return b;
}