const MARGIN = 14;
const EDGE = 8;

let root = null;
let termsEl = null;
let bodyEl = null;

function build() {
  if ( root ) return root;
  root = document.createElement("div");
  root.className = "lht-tooltip";
  root.setAttribute("role", "tooltip");
  root.hidden = true;
  root.innerHTML = `<dl class="lht-terms"></dl><div class="lht-body"></div>`;
  termsEl = root.querySelector(".lht-terms");
  bodyEl = root.querySelector(".lht-body");
  document.body.append(root);
  return root;
}

/**
 * Anchor the panel to the cursor, flipping across the pointer when it would
 * overflow. Measured after content is in place, so the flip uses the real size.
 */
function position(x, y) {
  root.style.left = "0px";
  root.style.top = "0px";
  const { width, height } = root.getBoundingClientRect();

  let left = x + MARGIN;
  if ( left + width > window.innerWidth - EDGE ) left = Math.max(EDGE, x - MARGIN - width);

  let top = y + MARGIN;
  if ( top + height > window.innerHeight - EDGE ) top = Math.max(EDGE, y - MARGIN - height);

  root.style.left = `${Math.round(left)}px`;
  root.style.top = `${Math.round(top)}px`;
}

/**
 * @param {{x: number, y: number, terms: {term: string, translation: string}[], body: string, state: "text"|"pending"|"error"|"idle"}} data
 */
export function show({ x, y, terms = [], body = "", state = "text" }) {
  build();

  termsEl.replaceChildren();
  for ( const { term, translation } of terms ) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = translation;
    termsEl.append(dt, dd);
  }
  termsEl.hidden = !terms.length;

  bodyEl.className = `lht-body lht-${state}`;
  bodyEl.textContent = body;
  bodyEl.hidden = !body;

  root.hidden = false;
  position(x, y);
}

/** Swap only the lower section, leaving the glossary hits and position untouched. */
export function update({ body, state = "text" }) {
  if ( !root || root.hidden ) return;
  bodyEl.className = `lht-body lht-${state}`;
  bodyEl.textContent = body;
  bodyEl.hidden = !body;
}

export function hide() {
  if ( root ) root.hidden = true;
}

export function isVisible() {
  return !!root && !root.hidden;
}
