import { BaseSystem } from "../BaseSystem.js";
import { deepClone, getByPath, setByPath } from "../utils.js";

const SETTINGS_STORAGE_KEY = "ant.colony.v5.settings";

function collectSchemaPaths(node, prefix = "", output = []) {
  if (!node || typeof node !== "object") {
    return output;
  }

  const hasRule =
    Array.isArray(node.options) ||
    typeof node.min === "number" ||
    typeof node.max === "number" ||
    typeof node.step === "number" ||
    typeof node.type === "string";

  if (hasRule) {
    output.push(prefix);
    return output;
  }

  for (const [key, value] of Object.entries(node)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    collectSchemaPaths(value, nextPrefix, output);
  }
  return output;
}

export class SettingsSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "settings", config);
    this.defaults = deepClone(config.defaults ?? {});
    this.schema = deepClone(config.schema ?? {});
    this.state = deepClone(this.defaults);
  }

  init() {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      this.deserialize(parsed);
    } catch (error) {
      console.warn("Failed to load settings:", error);
      this.state = deepClone(this.defaults);
    }
  }

  sanitizeValue(path, value) {
    const rule = getByPath(this.schema, path, null);
    if (!rule || typeof rule !== "object") {
      return value;
    }

    if (rule.type === "boolean") {
      return Boolean(value);
    }

    if (rule.type === "number") {
      const min = Number(rule.min ?? value);
      const max = Number(rule.max ?? value);
      const step = Number(rule.step ?? 1);
      let numeric = Number(value);
      if (Number.isNaN(numeric)) {
        numeric = Number(getByPath(this.defaults, path, min));
      }
      numeric = Math.max(min, Math.min(max, numeric));
      return Math.round(numeric / step) * step;
    }

    if (Array.isArray(rule.options)) {
      if (rule.options.includes(value)) {
        return value;
      }
      return rule.options[0];
    }

    return value;
  }

  get(path, fallback = undefined) {
    return getByPath(this.state, path, fallback);
  }

  set(path, value, persist = true) {
    const sanitized = this.sanitizeValue(path, value);
    setByPath(this.state, path, sanitized);

    if (persist) {
      this.persist();
    }

    this.engine.events.emit("settings:changed", {
      path,
      value: sanitized
    });
  }

  toggle(path) {
    this.set(path, !this.get(path, false));
  }

  getGameSpeed() {
    return Number(this.get("gameplay.gameSpeed", 1));
  }

  persist() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.warn("Failed to persist settings:", error);
    }
  }

  update(_dt) {}

  serialize() {
    return deepClone(this.state);
  }

  deserialize(state) {
    this.state = deepClone(this.defaults);
    const schemaPaths = collectSchemaPaths(this.schema);

    for (const path of schemaPaths) {
      const nextValue = getByPath(state, path, getByPath(this.defaults, path));
      this.set(path, nextValue, false);
    }

    this.persist();
  }

  reset() {
    this.state = deepClone(this.defaults);
    this.persist();
  }
}
