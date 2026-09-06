import {
  MODULE_ID, SCOPE_SELECTORS, EXCLUDE_SELECTORS, BLOCK_TAGS, BLOCK_FALLBACK_SELECTORS
} from "./constants.js";
import { setting } from "./settings.js";
import { findTerms } from "./glossary.js";
import { translate, providerEnabled } from "./translator.js";
import { show, update, hide, isVisible } from "./tooltip.js";

/** Below this, a bare inline element is a UI label rather than prose. */
const LOOSE_MIN_CHARS = 25;
const MIN_CHARS = 6;

const KEY_NAMES = { alt: "Alt", ctrl: "Control", shift: "Shift" };

let timer = null;
let controller = null;
let hoveredBlock = null;
let shownBlock = null;
const pointer = { x: 0, y: 0 };

/* -------------------------------------------- */
/*  Element resolution                          */
/* -------------------------------------------- */

function hasOwnText(el) {
  for ( const node of el.childNodes ) {
    if ( (node.nodeType === Node.TEXT_NODE) && node.nodeValue.trim() ) return true;
  }
  return false;
}

/**
 * The block of prose the cursor is inside, or null when this spot is off limits.
 * Walking up to a block tag is what makes the whole paragraph the unit rather
 * than whichever <strong> happens to sit under the pointer.
 */
function resolveBlock(target) {
  if ( !(target instanceof Element) ) return null;
  if ( target.closest(EXCLUDE_SELECTORS) ) return null;

  const scope = target.closest(SCOPE_SELECTORS);
  if ( !scope ) return null;

  for ( let el = target; el && (el !== scope.parentElement); el = el.parentElement ) {
    if ( BLOCK_TAGS.has(el.tagName) ) return el;
  }

  const fallback = target.closest(BLOCK_FALLBACK_SELECTORS);
  if ( fallback && scope.contains(fallback) ) return fallback;

  // Nothing block-shaped above us: accept the hovered element only if it carries
  // enough text of its own to be worth a popup.
  if ( (target !== scope) && hasOwnText(target)
    && (target.textContent.trim().length >= LOOSE_MIN_CHARS) ) return target;
  return null;
}

function extractText(block) {
  const text = block.textContent.replace(/\s+/g, " ").trim();
  const max = setting("maxChars");
  return (text.length > max) ? text.slice(0, max) : text;
}

function isTranslatable(text) {
  if ( text.length < MIN_CHARS ) return false;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  return (latin >= 4) && (latin > cyrillic);
}

/* -------------------------------------------- */
/*  Trigger state                               */
/* -------------------------------------------- */

function triggerHeld(event) {
  const trigger = setting("trigger");
  if ( trigger === "hover" ) return true;
  if ( !event ) return false;
  if ( trigger === "alt" ) return event.altKey;
  if ( trigger === "ctrl" ) return event.ctrlKey;
  return event.shiftKey;
}

function cancel() {
  clearTimeout(timer);
  timer = null;
  controller?.abort();
  controller = null;
}

function dismiss() {
  cancel();
  shownBlock = null;
  hide();
}

/* -------------------------------------------- */
/*  Display                                     */
/* -------------------------------------------- */

async function run(block) {
  const text = extractText(block);
  if ( !isTranslatable(text) ) return dismiss();

  const terms = setting("glossary") ? findTerms(text) : [];

  if ( !providerEnabled() ) {
    // Glossary-only mode: a paragraph with no known terms has nothing to say.
    if ( !terms.length ) return dismiss();
    shownBlock = block;
    return show({ x: pointer.x, y: pointer.y, terms, state: "idle" });
  }

  shownBlock = block;
  show({
    x: pointer.x,
    y: pointer.y,
    terms,
    body: game.i18n.localize("LANCER_HT.Pending"),
    state: "pending"
  });

  controller = new AbortController();
  const request = controller;
  try {
    const result = await translate(text, { signal: request.signal });
    if ( request.signal.aborted || (shownBlock !== block) ) return;
    update({ body: result, state: "text" });
  }
  catch ( err ) {
    if ( request.signal.aborted || (shownBlock !== block) ) return;
    console.warn(`${MODULE_ID} | перевод не удался`, err);
    update({
      body: game.i18n.format("LANCER_HT.Error.Failed", { message: err.message }),
      state: "error"
    });
  }
}

function arm(block, immediate = false) {
  cancel();
  if ( immediate ) return run(block);
  timer = setTimeout(() => run(block), setting("delay"));
}

/* -------------------------------------------- */
/*  Listeners                                   */
/* -------------------------------------------- */

function onPointerMove(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if ( !setting("enabled") ) return;

  const block = resolveBlock(event.target);
  if ( block === hoveredBlock ) {
    // Same block, but the modifier may have just been released mid-move.
    if ( isVisible() && !triggerHeld(event) ) dismiss();
    return;
  }

  hoveredBlock = block;
  if ( isVisible() || timer ) dismiss();
  if ( block && triggerHeld(event) ) arm(block);
}

function onKeyDown(event) {
  if ( event.key === "Escape" ) return dismiss();
  if ( !setting("enabled") ) return;
  const wanted = KEY_NAMES[setting("trigger")];
  // Pressing the modifier over an already-hovered block is an explicit ask, so
  // skip the dwell delay.
  if ( wanted && (event.key === wanted) && hoveredBlock && !shownBlock ) arm(hoveredBlock, true);
}

function onKeyUp(event) {
  const wanted = KEY_NAMES[setting("trigger")];
  if ( wanted && (event.key === wanted) ) dismiss();
}

function onLeave(event) {
  if ( !event.relatedTarget ) dismiss();
}

export function activateHoverListeners() {
  // Switching off mid-hover must clear whatever is already on screen.
  Hooks.on(`${MODULE_ID}.toggled`, enabled => {
    if ( !enabled ) dismiss();
  });

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerout", onLeave, { passive: true });
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  // Capture phase: sheet bodies scroll without bubbling a scroll event to document.
  document.addEventListener("scroll", dismiss, { capture: true, passive: true });
  window.addEventListener("blur", dismiss);
}
