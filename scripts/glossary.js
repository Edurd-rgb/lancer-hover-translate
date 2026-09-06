import { MODULE_ID } from "./constants.js";

/** Lower-cased term -> translation. */
let entries = new Map();
let matcher = null;

/** Longest-first, so "Lock On" wins over a bare "Lock" that happens to be listed too. */
function compile() {
  matcher = null;
  if ( !entries.size ) return;
  const pattern = [...entries.keys()]
    .sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  // Lookaround instead of \b: Lancer terms contain hyphens and slashes, where \b
  // sits in the middle of the term rather than at its edges.
  matcher = new RegExp(`(?<![\\p{L}\\d])(?:${pattern})(?![\\p{L}\\d])`, "giu");
}

export async function loadGlossary() {
  entries = new Map();
  const path = `modules/${MODULE_ID}/data/glossary.json`;
  try {
    const res = await fetch(path);
    if ( !res.ok ) throw new Error(`${res.status} ${res.statusText}`);
    const raw = await res.json();
    for ( const [term, translation] of Object.entries(raw) ) {
      if ( term && translation ) entries.set(term.toLowerCase(), translation);
    }
  }
  catch ( err ) {
    console.error(`${MODULE_ID} | не удалось загрузить словарь`, err);
  }
  compile();
  return entries.size;
}

/** Merge extra terms at runtime — lets a table keep its own house glossary. */
export function extendGlossary(extra = {}) {
  for ( const [term, translation] of Object.entries(extra) ) {
    if ( term && translation ) entries.set(term.toLowerCase(), translation);
  }
  compile();
  return entries.size;
}

export function glossarySize() {
  return entries.size;
}

/**
 * Hide Lancer jargon from the translator behind placeholders, then drop the
 * glossary's own wording into the result. Machine translation renders "hard cover"
 * as "твёрдая оболочка"; this way the sentence comes back fully Russian but with
 * the terminology the table actually uses.
 *
 * `#0#` was picked by testing which markers survive a round trip intact — it does,
 * and it never occurs in Lancer text.
 */
export function maskTerms(text) {
  const identity = { masked: text, restore: translated => translated };
  if ( !matcher || !text ) return identity;

  const slots = [];
  const index = new Map();
  const masked = text.replace(matcher, match => {
    const key = match.toLowerCase();
    if ( !index.has(key) ) {
      index.set(key, slots.length);
      // The approved translation, not the English surface form.
      slots.push(entries.get(key) ?? match);
    }
    return `#${index.get(key)}#`;
  });

  if ( !slots.length ) return identity;
  return {
    masked,
    // A marker the service mangled anyway is left as-is rather than crashing.
    restore: translated => translated.replace(/#(\d+)#/g, (whole, n) => slots[Number(n)] ?? whole)
  };
}

/**
 * Terms found in `text`, in order of first appearance and deduplicated.
 * @returns {{term: string, translation: string}[]}
 */
export function findTerms(text, limit = 8) {
  if ( !matcher || !text ) return [];
  matcher.lastIndex = 0;
  const found = [];
  const seen = new Set();
  for ( const match of text.matchAll(matcher) ) {
    const key = match[0].toLowerCase();
    if ( seen.has(key) ) continue;
    seen.add(key);
    found.push({ term: match[0], translation: entries.get(key) });
    if ( found.length >= limit ) break;
  }
  return found;
}
