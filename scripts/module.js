import { MODULE_ID } from "./constants.js";
import { registerSettings, isEnabled, setEnabled } from "./settings.js";
import { loadGlossary, extendGlossary, glossarySize, findTerms } from "./glossary.js";
import { loadCache, clearCache, cacheSize, translate } from "./translator.js";
import { activateHoverListeners } from "./hover.js";

/**
 * Flip the switch and tell the player what happened — without feedback the
 * hotkey is indistinguishable from a key that did nothing.
 */
async function toggle(value) {
  const next = await setEnabled(value);
  ui.notifications.info(game.i18n.localize(next ? "LANCER_HT.Toggle.On" : "LANCER_HT.Toggle.Off"));
  return next;
}

/**
 * Foundry has moved the toggle argument around between versions: v12 passed the
 * new state to onClick, v13 passes (event, active) to onChange. Take whichever
 * boolean turns up and fall back to inverting the current state.
 */
function resolveToggle(args) {
  const flag = [...args].reverse().find(a => typeof a === "boolean");
  return flag ?? !isEnabled();
}

Hooks.once("init", () => {
  registerSettings();

  game.keybindings.register(MODULE_ID, "toggle", {
    name: "LANCER_HT.Keybind.Toggle.Name",
    hint: "LANCER_HT.Keybind.Toggle.Hint",
    editable: [{ key: "KeyT", modifiers: ["Alt"] }],
    onDown: () => {
      toggle();
      return true;
    },
    restricted: false
  });

  game.modules.get(MODULE_ID).api = {
    toggle,
    isEnabled,
    translate,
    findTerms,
    extendGlossary,
    clearCache,
    stats: () => ({ glossary: glossarySize(), cache: cacheSize() })
  };
});

Hooks.once("ready", async () => {
  const terms = await loadGlossary();
  const cached = loadCache();
  activateHoverListeners();
  console.log(`${MODULE_ID} | готов: ${terms} терминов в словаре, ${cached} переводов в кэше`);
});

/* -------------------------------------------- */
/*  Scene controls                              */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", controls => {
  const tool = {
    name: MODULE_ID,
    title: "LANCER_HT.Toggle.Tool",
    icon: "fa-solid fa-language",
    visible: true,
    toggle: true,
    active: isEnabled(),
    order: 91,
    onClick: (...args) => toggle(resolveToggle(args)),
    onChange: (...args) => toggle(resolveToggle(args))
  };

  // v13 hands over records keyed by name; v12 handed over arrays.
  if ( Array.isArray(controls) ) {
    const group = controls.find(c => ["token", "tokens"].includes(c.name));
    if ( group ) (group.tools ??= []).push(tool);
    return;
  }

  const group = controls.tokens ?? controls.token;
  if ( !group ) return;
  group.tools ??= {};
  group.tools[tool.name] = tool;
});
