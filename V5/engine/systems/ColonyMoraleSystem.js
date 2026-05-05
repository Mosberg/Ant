import { BaseSystem } from "../BaseSystem.js";
import { clamp } from "../utils.js";

export class ColonyMoraleSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "morale", config);
    this.morale = Number(config.startingMorale ?? 75);
    this.history = [];
    this.lastEvaluation = 0;
    this.lastDeathCount = 0;
    this.lastReasons = [];
  }

  init() {
    this.morale = Number(this.config.startingMorale ?? 75);
    this.history = [];
    this.lastEvaluation = 0;
    this.lastDeathCount = 0;
    this.lastReasons = [];
  }

  addInstant(amount, reason = "") {
    this.morale = clamp(this.morale + amount, 0, 100);
    if (reason) {
      this.lastReasons.push({
        t: this.engine.time,
        reason,
        amount
      });
      this.lastReasons = this.lastReasons.slice(-20);
    }
  }

  evaluateMorale() {
    const resources = this.engine.getSystem("resources");
    const ants = this.engine.getSystem("ants");
    const enemies = this.engine.getSystem("enemies");
    const weather = this.engine.getSystem("weather");
    const rooms = this.engine.getSystem("rooms");
    const difficulty = this.engine.getSystem("difficulty");

    const foodRatio = (resources.getValue("food") + 1) / Math.max(1, resources.getCapacity("food"));
    const waterRatio =
      (resources.getValue("water") + 1) / Math.max(1, resources.getCapacity("water"));
    const threatCount = enemies.getAliveEnemies().length;

    const deathsSinceLast = Math.max(0, ants.deathCount - this.lastDeathCount);
    this.lastDeathCount = ants.deathCount;

    const roomEffects = rooms.getAggregateEffects();
    const moraleBonus = Number(roomEffects.moraleBonus ?? 0);

    let delta = 0;
    delta += (foodRatio - 0.55) * 2.4;
    delta += (waterRatio - 0.45) * 1.8;
    delta += moraleBonus * 0.18;
    delta -= threatCount * 0.24;
    delta -= deathsSinceLast * 2.1;

    const weatherId = weather.getCurrentWeather().id;
    if (weatherId === "storm") {
      delta -= 0.75;
    } else if (weatherId === "heatwave") {
      delta -= 0.55;
    } else if (weatherId === "clear") {
      delta += 0.2;
    }

    const drain = Number(difficulty.getMultiplier("moraleDrainMultiplier", 1));
    delta *= 1 / Math.max(0.4, drain);

    this.morale = clamp(this.morale + delta, 0, 100);

    if (this.morale <= 0) {
      this.engine.events.emit("colony:defeat", {
        reason: "Morale collapsed to zero."
      });
    }

    if (this.morale < 20) {
      this.engine.events.emit("colony:warning", {
        level: "critical",
        morale: this.morale
      });
    }

    this.history.push({
      t: this.engine.time,
      morale: this.morale,
      delta,
      deathsSinceLast,
      threatCount
    });

    this.history = this.history.slice(-240);
  }

  update(dt) {
    this.lastEvaluation += dt;
    if (this.lastEvaluation >= 1) {
      this.lastEvaluation = 0;
      this.evaluateMorale();
    }
  }

  serialize() {
    return {
      morale: this.morale,
      history: this.history,
      lastEvaluation: this.lastEvaluation,
      lastDeathCount: this.lastDeathCount,
      lastReasons: this.lastReasons
    };
  }

  deserialize(state) {
    this.morale = Number(state.morale ?? this.morale);
    this.history = Array.isArray(state.history) ? [...state.history] : [];
    this.lastEvaluation = Number(state.lastEvaluation ?? 0);
    this.lastDeathCount = Number(state.lastDeathCount ?? 0);
    this.lastReasons = Array.isArray(state.lastReasons) ? [...state.lastReasons] : [];
  }

  reset() {
    this.init();
  }
}
