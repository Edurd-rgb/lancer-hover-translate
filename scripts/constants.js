export const MODULE_ID = "lancer-hover-translate";

/**
 * Roots the tooltip is allowed to fire inside. Chat, sidebar and UI chrome are
 * deliberately absent: those are short labels where a popup is pure noise.
 */
export const SCOPE_SELECTORS = [
  ".app.sheet",
  ".application.sheet",
  ".journal-sheet",
  ".journal-entry-page",
  ".compendium",
  ".directory .compendium-view"
].join(", ");

/** Elements whose text is either editable or machine-readable — never translate these. */
export const EXCLUDE_SELECTORS = [
  "input",
  "textarea",
  "select",
  "option",
  "[contenteditable='true']",
  ".ProseMirror",
  ".editor",
  "code",
  "pre",
  "kbd",
  ".lht-tooltip"
].join(", ");

/**
 * Tags that count as a self-contained block of prose. Hovering anywhere inside
 * one of these translates the whole element rather than the span under the cursor.
 */
export const BLOCK_TAGS = new Set([
  "P", "LI", "TD", "TH", "DD", "DT", "BLOCKQUOTE", "FIGCAPTION", "SUMMARY",
  "H1", "H2", "H3", "H4", "H5", "H6"
]);

/** Fallback containers used when a hovered node sits outside any block tag. */
export const BLOCK_FALLBACK_SELECTORS = [
  ".description",
  ".effect-text",
  ".item-description",
  ".journal-page-content > *",
  ".editor-content > *"
].join(", ");
