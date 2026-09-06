import { MODULE_ID } from "./constants.js";

export function setting(key) {
  return game.settings.get(MODULE_ID, key);
}

export function isEnabled() {
  return game.settings.get(MODULE_ID, "enabled");
}

/**
 * Flip the per-player switch. Everything that has to react — the scene control
 * button, a tooltip left on screen — hangs off the setting's onChange, so the
 * toggle behaves the same whether it came from the button, the hotkey or the
 * settings menu.
 */
export async function setEnabled(value) {
  const next = (value === undefined) ? !isEnabled() : !!value;
  if ( next === isEnabled() ) return next;
  await game.settings.set(MODULE_ID, "enabled", next);
  return next;
}

export function registerSettings() {
  game.settings.register(MODULE_ID, "enabled", {
    name: "LANCER_HT.Settings.Enabled.Name",
    hint: "LANCER_HT.Settings.Enabled.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: value => {
      ui.controls?.render();
      Hooks.callAll(`${MODULE_ID}.toggled`, value);
    }
  });

  game.settings.register(MODULE_ID, "trigger", {
    name: "LANCER_HT.Settings.Trigger.Name",
    hint: "LANCER_HT.Settings.Trigger.Hint",
    scope: "client",
    config: true,
    type: String,
    default: "hover",
    choices: {
      hover: "LANCER_HT.Settings.Trigger.Hover",
      alt: "LANCER_HT.Settings.Trigger.Alt",
      ctrl: "LANCER_HT.Settings.Trigger.Ctrl",
      shift: "LANCER_HT.Settings.Trigger.Shift"
    }
  });

  game.settings.register(MODULE_ID, "delay", {
    name: "LANCER_HT.Settings.Delay.Name",
    hint: "LANCER_HT.Settings.Delay.Hint",
    scope: "client",
    config: true,
    type: Number,
    default: 350,
    range: { min: 0, max: 2000, step: 50 }
  });

  game.settings.register(MODULE_ID, "glossary", {
    name: "LANCER_HT.Settings.Glossary.Name",
    hint: "LANCER_HT.Settings.Glossary.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "keepTerms", {
    name: "LANCER_HT.Settings.KeepTerms.Name",
    hint: "LANCER_HT.Settings.KeepTerms.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "provider", {
    name: "LANCER_HT.Settings.Provider.Name",
    hint: "LANCER_HT.Settings.Provider.Hint",
    scope: "world",
    config: true,
    type: String,
    // MyMemory out of the box: it needs no key, so a fresh install translates
    // immediately instead of looking broken.
    default: "mymemory",
    choices: {
      none: "LANCER_HT.Settings.Provider.None",
      mymemory: "LANCER_HT.Settings.Provider.MyMemory",
      libretranslate: "LANCER_HT.Settings.Provider.LibreTranslate",
      google: "LANCER_HT.Settings.Provider.Google"
    }
  });

  game.settings.register(MODULE_ID, "email", {
    name: "LANCER_HT.Settings.Email.Name",
    hint: "LANCER_HT.Settings.Email.Hint",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "endpoint", {
    name: "LANCER_HT.Settings.Endpoint.Name",
    hint: "LANCER_HT.Settings.Endpoint.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "https://libretranslate.com"
  });

  // World scope so one setup serves the table — which also means every connected
  // client can read the key. The hint says so; use a keyless self-hosted endpoint
  // if that matters.
  game.settings.register(MODULE_ID, "apiKey", {
    name: "LANCER_HT.Settings.ApiKey.Name",
    hint: "LANCER_HT.Settings.ApiKey.Hint",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "targetLang", {
    name: "LANCER_HT.Settings.TargetLang.Name",
    hint: "LANCER_HT.Settings.TargetLang.Hint",
    scope: "world",
    config: true,
    type: String,
    default: "ru"
  });

  game.settings.register(MODULE_ID, "maxChars", {
    name: "LANCER_HT.Settings.MaxChars.Name",
    hint: "LANCER_HT.Settings.MaxChars.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: 1200,
    range: { min: 200, max: 5000, step: 100 }
  });
}
