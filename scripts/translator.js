import { MODULE_ID } from "./constants.js";
import { setting } from "./settings.js";

const CACHE_KEY = `${MODULE_ID}.cache`;
const CACHE_LIMIT = 1500;

/** cacheKey -> translated string. Insertion order doubles as the eviction order. */
const cache = new Map();
let saveTimer = null;

/* -------------------------------------------- */
/*  Cache                                       */
/* -------------------------------------------- */

function hash(text) {
  let h = 5381;
  for ( let i = 0; i < text.length; i++ ) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return h.toString(36);
}

function keyFor(text, target) {
  return `${target}:${text.length}:${hash(text)}`;
}

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if ( !raw ) return 0;
    for ( const [key, value] of Object.entries(JSON.parse(raw)) ) cache.set(key, value);
  }
  catch ( err ) {
    console.warn(`${MODULE_ID} | кэш переводов повреждён, начинаю с пустого`, err);
    localStorage.removeItem(CACHE_KEY);
  }
  return cache.size;
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    while ( cache.size > CACHE_LIMIT ) cache.delete(cache.keys().next().value);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
    }
    catch ( err ) {
      // Quota exceeded is the realistic failure here; drop half and let it refill.
      console.warn(`${MODULE_ID} | не удалось сохранить кэш, чищу половину`, err);
      const keep = [...cache.entries()].slice(Math.floor(cache.size / 2));
      cache.clear();
      for ( const [k, v] of keep ) cache.set(k, v);
    }
  }, 2000);
}

export function clearCache() {
  const size = cache.size;
  cache.clear();
  localStorage.removeItem(CACHE_KEY);
  return size;
}

export function cacheSize() {
  return cache.size;
}

/* -------------------------------------------- */
/*  Providers                                   */
/* -------------------------------------------- */

/**
 * Both providers report failures as JSON — Google as {error:{message}}, LibreTranslate
 * as {error:"..."}. Surface just the message: the raw blob is unreadable in a tooltip.
 */
async function failure(res, label) {
  let detail = "";
  try {
    const data = await res.json();
    if ( typeof data?.error === "string" ) detail = data.error;
    else detail = data?.error?.message ?? "";
  }
  catch {
    // Body was not JSON — a proxy error page, most likely.
  }
  return new Error(`${label} ${res.status}: ${detail || res.statusText}`);
}

/** Google returns HTML entities even for format:"text", so unescape before display. */
function decodeEntities(text) {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

async function libretranslate(text, target, signal) {
  const endpoint = String(setting("endpoint") || "").replace(/\/+$/, "");
  if ( !endpoint ) throw new Error(game.i18n.localize("LANCER_HT.Error.NoEndpoint"));
  const body = { q: text, source: "en", target, format: "text" };
  const apiKey = setting("apiKey");
  if ( apiKey ) body.api_key = apiKey;

  const res = await fetch(`${endpoint}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  if ( !res.ok ) throw await failure(res, "LibreTranslate");
  const data = await res.json();
  if ( !data?.translatedText ) throw new Error("LibreTranslate вернул пустой ответ");
  return data.translatedText;
}

/** MyMemory refuses anything past 500 characters, so long paragraphs go in pieces. */
const MYMEMORY_LIMIT = 450;

/** Split on sentence ends where possible, on a space otherwise, never mid-word. */
function chunk(text, limit) {
  if ( text.length <= limit ) return [text];
  const parts = [];
  let rest = text;
  while ( rest.length > limit ) {
    const window = rest.slice(0, limit);
    const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    let cut = (sentence > limit / 2) ? sentence + 1 : window.lastIndexOf(" ");
    if ( cut <= 0 ) cut = limit;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if ( rest ) parts.push(rest);
  return parts;
}

async function mymemory(text, target, signal) {
  const email = String(setting("email") || "").trim();
  const pieces = [];

  for ( const part of chunk(text, MYMEMORY_LIMIT) ) {
    const params = new URLSearchParams({ q: part, langpair: `en|${target}` });
    // Supplying an address raises the free daily allowance tenfold.
    if ( email ) params.set("de", email);

    const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, { signal });
    if ( !res.ok ) throw await failure(res, "MyMemory");
    const data = await res.json();

    // MyMemory answers 200 even for quota and length errors — the real code is in
    // the body, and the "translation" is then the error text itself.
    const status = Number(data?.responseStatus);
    if ( data?.quotaFinished || (status !== 200) ) {
      const detail = data?.responseDetails || data?.responseData?.translatedText || "";
      throw new Error(`MyMemory ${status || 429}: ${detail}`);
    }

    const piece = data?.responseData?.translatedText;
    if ( !piece ) throw new Error("MyMemory вернул пустой ответ");
    pieces.push(decodeEntities(piece));
  }

  return pieces.join(" ");
}

async function google(text, target, signal) {
  const apiKey = setting("apiKey");
  if ( !apiKey ) throw new Error(game.i18n.localize("LANCER_HT.Error.NoKey"));
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, source: "en", target, format: "text" }),
    signal
  });
  if ( !res.ok ) throw await failure(res, "Google Translate");
  const data = await res.json();
  const out = data?.data?.translations?.[0]?.translatedText;
  if ( !out ) throw new Error("Google Translate вернул пустой ответ");
  return decodeEntities(out);
}

const PROVIDERS = { mymemory, libretranslate, google };

export function providerEnabled() {
  return setting("provider") in PROVIDERS;
}

/* -------------------------------------------- */
/*  Entry point                                 */
/* -------------------------------------------- */

/**
 * @returns {Promise<string|null>} the translation, or null when no provider is configured.
 */
export async function translate(text, { signal } = {}) {
  const provider = PROVIDERS[setting("provider")];
  if ( !provider ) return null;

  const target = String(setting("targetLang") || "ru").trim();
  const key = keyFor(text, target);
  if ( cache.has(key) ) {
    // Refresh insertion order so hot entries survive eviction.
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const result = await provider(text, target, signal);
  cache.set(key, result);
  persist();
  return result;
}
