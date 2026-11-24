// A tiny, dependency-free syntax highlighter for the languages used in practicals.
import { esc } from './ui.js';

export const LANGS = [
  ['python', 'Python'], ['c', 'C'], ['cpp', 'C++'], ['java', 'Java'],
  ['javascript', 'JavaScript'], ['sql', 'SQL'], ['r', 'R'], ['text', 'Other / plain text'],
];

/** File extension used when a snippet is downloaded. */
export const EXT = {
  python: 'py', c: 'c', cpp: 'cpp', java: 'java', javascript: 'js', sql: 'sql', r: 'r', text: 'txt',
};

const KEYWORDS = {
  python: 'and as assert break class continue def del elif else except finally for from global if import in is lambda None nonlocal not or pass raise return True False try while with yield print self',
  c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while NULL',
  java: 'abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void while true false String System',
  javascript: 'async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new null of return static super switch this throw try typeof undefined var void while yield true false console',
  sql: 'select from where group by order having insert into values update set delete create table alter drop join inner left right outer on as and or not null primary key foreign references distinct limit count sum avg min max like in between',
  r: 'function if else for while repeat break next return TRUE FALSE NULL NA library print data',
};
KEYWORDS.cpp = KEYWORDS.c + ' class namespace using public private protected new delete template typename this true false bool cout cin endl std string vector';

const KEYWORD_SETS = Object.fromEntries(
  Object.entries(KEYWORDS).map(([lang, words]) => [lang, new Set(words.split(' '))]),
);

/** Returns safe HTML (everything is escaped) with <span class="t-..."> tokens. */
export function highlight(code, lang) {
  const parts = [];
  if (lang === 'python') parts.push(['"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'', 'str']);
  if (lang === 'python' || lang === 'r') parts.push(['#[^\\n]*', 'com']);
  else if (lang === 'sql') parts.push(['--[^\\n]*', 'com']);
  else if (lang !== 'text') parts.push(['\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/', 'com']);
  if (lang === 'c' || lang === 'cpp') {
    parts.push(['#\\s*(?:include|define|ifdef|ifndef|endif|if|else|pragma)\\b', 'kw']);
  }
  parts.push(['"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'', 'str']);
  parts.push(['\\b\\d+(?:\\.\\d+)?\\b', 'num']);
  parts.push(['\\b[A-Za-z_]\\w*\\b', 'id']);

  const re = new RegExp(parts.map((p) => `(${p[0]})`).join('|'), 'g');
  const words = KEYWORD_SETS[lang] || new Set();
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    if (m.index > last) out += esc(code.slice(last, m.index));
    const group = m.slice(1).findIndex((x) => x !== undefined);
    let cls = parts[group][1];
    const text = m[0];
    if (cls === 'id') cls = words.has(lang === 'sql' ? text.toLowerCase() : text) ? 'kw' : null;
    out += cls ? `<span class="t-${cls}">${esc(text)}</span>` : esc(text);
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}
