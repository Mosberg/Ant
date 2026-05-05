import { BaseSystem } from "../BaseSystem.js";
import { clamp } from "../utils.js";

const DIFFICULTY_INDEX = {
  Tranquil: 0,
  Forgiving: 1,
  Balanced: 2,
  Harsh: 3,
  Nightmare: 4
};

export class DifficultyScalingSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "difficulty", config);
    this.state = {
      elapsedSeconds: 0,
      difficultyIndex: 2,
      enemySpawnMultiplier: 1,
      enemyPowerMultiplier: 1,
      resourceAbundanceMultiplier: 1,
      moraleDrainMultiplier: 1,
      eventIntensityMultiplier: 1
    };
  }

  init() {
    this.syncDifficultyFromSettings();
  }

  syncDifficultyFromSettings() {
    const settings = this.engine.getSystem("settings");
    const difficultyName = settings?.get("gameplay.difficulty", "Balanced");
    this.state.difficultyIndex = DIFFICULTY_INDEX[difficultyName] ?? 2;
  }

  update(dt) {
    this.state.elapsedSeconds += dt;
    this.syncDifficultyFromSettings();

    const progression = clamp(this.state.elapsedSeconds / 2100, 0, 1.8);
    const base = 0.78 + this.state.difficultyIndex * 0.22;

    this.state.enemySpawnMultiplier = clamp(base + progression * 0.7, 0.4, 3.6);
    this.state.enemyPowerMultiplier = clamp(base + progression * 0.45, 0.5, 3.3);
    this.state.resourceAbundanceMultiplier = clamp(
      1.35 - this.state.difficultyIndex * 0.1,
      0.65,
      1.5
    );
    this.state.moraleDrainMultiplier = clamp(0.85 + this.state.difficultyIndex * 0.16, 0.7, 2);
    this.state.eventIntensityMultiplier = clamp(base + progression * 0.55, 0.6, 3.4);
  }

  getMultiplier(key, fallback = 1) {
    if (key in this.state) {
      return this.state[key];
    }
    return fallback;
  }

  serialize() {
    return { ...this.state };
  }

  deserialize(state) {
    this.state = {
      ...this.state,
      ...state
    };
  }

  reset() {
    this.state.elapsedSeconds = 0;
    this.syncDifficultyFromSettings();
    this.update(0);
  }
}
