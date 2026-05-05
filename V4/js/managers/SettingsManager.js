import {
  BALANCE_CONFIG,
  DEFAULT_SETTINGS,
  DIFFICULTY_SETTINGS,
  GAME_SPEED_STEPS,
  TOOL_MODE,
  clamp
} from "../core/constants.js";

export class SettingsManager {
  constructor() {
    this.data = { ...DEFAULT_SETTINGS };
    this.load();
    this.sanitize();
  }

  load() {
    try {
      const raw = localStorage.getItem("ant-colony-manager-settings");
      if (!raw) return;
      this.data = { ...this.data, ...JSON.parse(raw) };
    } catch (e) {
      console.warn("Settings load failed", e);
    }
  }

  save() {
    try {
      localStorage.setItem("ant-colony-manager-settings", JSON.stringify(this.data));
    } catch (e) {
      console.warn("Settings save failed", e);
    }
  }

  sanitize() {
    if (!DIFFICULTY_SETTINGS[this.data.difficulty]) {
      this.data.difficulty = DEFAULT_SETTINGS.difficulty;
    }

    const validTools = Object.values(TOOL_MODE);
    if (!validTools.includes(this.data.defaultTool)) {
      this.data.defaultTool = DEFAULT_SETTINGS.defaultTool;
    }

    this.data.musicVolume = clamp(
      Number(this.data.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
      0,
      1
    );
    this.data.sfxVolume = clamp(Number(this.data.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume), 0, 1);

    const nearestSpeed = GAME_SPEED_STEPS.reduce((best, current) => {
      return Math.abs(current - this.data.gameSpeed) < Math.abs(best - this.data.gameSpeed)
        ? current
        : best;
    }, DEFAULT_SETTINGS.gameSpeed);
    this.data.gameSpeed = nearestSpeed;

    this.data.graphicsDetail = Boolean(this.data.graphicsDetail);
    this.data.compactHud = Boolean(this.data.compactHud);
    this.data.showControlHints = Boolean(this.data.showControlHints);
    this.data.pauseOnBlur = Boolean(this.data.pauseOnBlur);
    this.data.autoSaveEnabled = Boolean(this.data.autoSaveEnabled);
    this.data.dynamicEvents = Boolean(this.data.dynamicEvents);
    this.data.showDigMarkers = Boolean(this.data.showDigMarkers);
    this.data.singleClickSelect = Boolean(this.data.singleClickSelect);
    this.data.smartWorkerDistribution = Boolean(this.data.smartWorkerDistribution);
    this.data.autoSelectNewAnt = Boolean(this.data.autoSelectNewAnt);

    this.data.uiScale = clamp(Number(this.data.uiScale ?? DEFAULT_SETTINGS.uiScale), 0.8, 1.2);
    this.data.minimapOpacity = clamp(
      Number(this.data.minimapOpacity ?? DEFAULT_SETTINGS.minimapOpacity),
      0.25,
      1
    );
    this.data.minimapScale = clamp(
      Math.round(Number(this.data.minimapScale ?? DEFAULT_SETTINGS.minimapScale)),
      BALANCE_CONFIG.minimapScaleMin,
      BALANCE_CONFIG.minimapScaleMax
    );
    this.data.autoSaveIntervalSec = Math.max(
      BALANCE_CONFIG.autoSaveMinimumIntervalSec,
      Math.round(Number(this.data.autoSaveIntervalSec ?? DEFAULT_SETTINGS.autoSaveIntervalSec))
    );
  }

  set(key, value) {
    if (!(key in this.data)) return;
    this.data[key] = value;
    this.sanitize();
    this.save();
  }

  setMany(patch) {
    this.data = { ...this.data, ...patch };
    this.sanitize();
    this.save();
  }

  get(key) {
    return this.data[key];
  }

  reset() {
    this.data = { ...DEFAULT_SETTINGS };
    this.save();
  }
}
