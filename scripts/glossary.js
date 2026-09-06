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
