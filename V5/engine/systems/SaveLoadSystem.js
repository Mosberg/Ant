import { BaseSystem } from "../BaseSystem.js";

const SAVE_KEY_PREFIX = "ant.colony.v5.save";

function slotKey(slotName) {
  return `${SAVE_KEY_PREFIX}.${slotName}`;
}

export class SaveLoadSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "saveLoad", config);
    this.version = Number(config.version ?? 1);
    this.autoSaveTimer = 0;
    this.lastSavedAt = 0;
    this.slotMeta = {};
  }

  init() {
    this.refreshSlotMeta();
  }

  refreshSlotMeta() {
    this.slotMeta = {};
    const slots = this.config.slots ?? ["autosave", "slot1", "slot2", "slot3"];
    for (const slot of slots) {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        this.slotMeta[slot] = {
          savedAt: parsed.savedAt ?? 0,
          version: parsed.version ?? 0
        };
      } catch {
        // Ignore malformed slots.
      }
    }
  }

  save(slot = "autosave") {
    const payload = {
      version: this.version,
      savedAt: Date.now(),
      slot,
      data: this.engine.serializeState(["saveLoad"])
    };

    localStorage.setItem(slotKey(slot), JSON.stringify(payload));
    this.lastSavedAt = payload.savedAt;
    this.slotMeta[slot] = {
      savedAt: payload.savedAt,
      version: payload.version
    };

    this.engine.events.emit("save:completed", {
      slot,
      savedAt: payload.savedAt
    });
  }

  load(slot = "autosave") {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) {
      return false;
    }

    const payload = JSON.parse(raw);
    if (!payload?.data) {
      return false;
    }

    this.engine.deserializeState(payload.data);
    this.lastSavedAt = Number(payload.savedAt ?? Date.now());

    this.engine.events.emit("save:loaded", {
      slot,
      savedAt: this.lastSavedAt,
      version: payload.version
    });

    return true;
  }

  delete(slot = "slot1") {
    localStorage.removeItem(slotKey(slot));
    delete this.slotMeta[slot];
  }

  getSlots() {
    return { ...this.slotMeta };
  }

  update(dt) {
    this.autoSaveTimer += dt;

    const settings = this.engine.getSystem("settings");
    const autosaveEnabled = settings?.get("gameplay.autosaveEnabled", true) ?? true;
    const autosaveSeconds = Number(settings?.get("gameplay.autosaveSeconds", 45) ?? 45);

    if (autosaveEnabled && this.autoSaveTimer >= autosaveSeconds) {
      this.autoSaveTimer = 0;
      this.save("autosave");
    }
  }

  serialize() {
    return {
      version: this.version,
      autoSaveTimer: this.autoSaveTimer,
      lastSavedAt: this.lastSavedAt,
      slotMeta: this.slotMeta
    };
  }

  deserialize(state) {
    this.version = Number(state.version ?? this.version);
    this.autoSaveTimer = Number(state.autoSaveTimer ?? this.autoSaveTimer);
    this.lastSavedAt = Number(state.lastSavedAt ?? this.lastSavedAt);
    this.slotMeta = { ...this.slotMeta, ...(state.slotMeta ?? {}) };
  }

  reset() {
    this.autoSaveTimer = 0;
    this.lastSavedAt = 0;
    this.refreshSlotMeta();
  }
}
