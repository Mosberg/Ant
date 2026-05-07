import { BaseSystem } from "../BaseSystem.js";
import { clamp } from "../utils.js";

export class ResourceSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "resources", config);
    this.definitions = new Map();
    this.values = {};
    this.capacities = {};
    this.flowHistory = [];
    this.lastDelta = {};
  }

  init() {
    const resources = this.config.resources ?? [];
    for (const resource of resources) {
      this.definitions.set(resource.id, resource);
      this.values[resource.id] = Number(
        this.config.starting?.[resource.id] ?? resource.starting ?? 0
      );
      this.capacities[resource.id] = Number(resource.storage?.base ?? 200);
      this.lastDelta[resource.id] = 0;
    }
  }

  getValue(id) {
    return Number(this.values[id] ?? 0);
  }

  getCapacity(id) {
    return Number(this.capacities[id] ?? 0);
  }

  add(id, amount) {
    if (!(id in this.values)) {
      return;
    }
    const current = this.values[id];
    this.values[id] = clamp(current + amount, 0, this.capacities[id]);
  }

  consume(id, amount) {
    if (!(id in this.values)) {
      return false;
    }
    if (this.values[id] < amount) {
      return false;
    }
    this.values[id] -= amount;
    return true;
  }

  canAfford(cost = {}) {
    for (const [id, amount] of Object.entries(cost)) {
      if (this.getValue(id) < Number(amount)) {
        return false;
      }
    }
    return true;
  }

  applyCost(cost = {}) {
    if (!this.canAfford(cost)) {
      return false;
    }
    for (const [id, amount] of Object.entries(cost)) {
      this.consume(id, Number(amount));
    }
    return true;
  }

  applyDelta(delta = {}) {
    for (const [id, amount] of Object.entries(delta)) {
      if (!(id in this.values)) {
        continue;
      }
      this.add(id, Number(amount));
    }
  }

  update(dt) {
    const roomSystem = this.engine.getSystem("rooms");
    const weather = this.engine.getSystem("weather");
    const difficulty = this.engine.getSystem("difficulty");
    const tech = this.engine.getSystem("tech");

    const effects = roomSystem?.getAggregateEffects() ?? {};
    const abundance = Number(difficulty?.getMultiplier("resourceAbundanceMultiplier", 1) ?? 1);
    const weatherFoodModifier = Number(weather?.getModifier("foodProductionMultiplier", 1) ?? 1);
    const weatherBroodModifier = Number(weather?.getModifier("broodSpeedMultiplier", 1) ?? 1);
    const globalEfficiency = Number(tech?.getEffect("colony.globalEfficiency", 1) ?? 1);
    const storageTechMultiplier = Number(tech?.getEffect("storage.capacityMultiplier", 1) ?? 1);

    const frameDelta = {};

    for (const [id, def] of this.definitions.entries()) {
      const storageBonus = Number(effects.storageBonus?.[id] ?? 0);
      const multiplier = Number(effects.productionMultiplier?.[id] ?? 1);
      const passiveConsumption = Number(effects.consumptionMultiplier?.[id] ?? 1);

      const baseProduction = Number(def.production?.base ?? 0);
      const baseConsumption = Number(def.consumption?.base ?? 0);
      const decayPerMinute = Number(def.decay?.perMinute ?? 0);

      const resourceProductionTechMultiplier = Number(
        tech?.getEffect(`resources.${id}Production`, 1) ?? 1
      );
      const resourceConsumptionTechMultiplier = Number(
        tech?.getEffect(`resources.${id}Consumption`, 1) ?? 1
      );

      this.capacities[id] =
        (Number(def.storage?.base ?? 200) + storageBonus) * storageTechMultiplier;

      let production =
        baseProduction *
        dt *
        multiplier *
        abundance *
        resourceProductionTechMultiplier *
        globalEfficiency;
      if (id === "food" || id === "fungus") {
        production *= weatherFoodModifier;
      }
      if (id === "larvae") {
        production *= weatherBroodModifier;
      }

      const consumption =
        (baseConsumption * dt * passiveConsumption * resourceConsumptionTechMultiplier) /
        Math.max(0.1, globalEfficiency);
      const decay =
        this.values[id] *
        (decayPerMinute / 60) *
        dt *
        Number(this.config.globalDecayMultiplier ?? 1);

      const before = this.values[id];
      this.values[id] = clamp(before + production - consumption - decay, 0, this.capacities[id]);
      frameDelta[id] = this.values[id] - before;
      this.lastDelta[id] = frameDelta[id];
    }

    this.flowHistory.push({
      t: this.engine.time,
      ...frameDelta
    });
    if (this.flowHistory.length > 240) {
      this.flowHistory.shift();
    }
  }

  getSummary() {
    const output = [];
    for (const [id, value] of Object.entries(this.values)) {
      output.push({
        id,
        value,
        capacity: this.capacities[id],
        delta: this.lastDelta[id]
      });
    }
    return output;
  }

  serialize() {
    return {
      values: this.values,
      capacities: this.capacities,
      flowHistory: this.flowHistory,
      lastDelta: this.lastDelta
    };
  }

  deserialize(state) {
    this.values = { ...this.values, ...(state.values ?? {}) };
    this.capacities = { ...this.capacities, ...(state.capacities ?? {}) };
    this.flowHistory = Array.isArray(state.flowHistory) ? [...state.flowHistory] : [];
    this.lastDelta = { ...this.lastDelta, ...(state.lastDelta ?? {}) };
  }

  reset() {
    this.definitions.clear();
    this.values = {};
    this.capacities = {};
    this.flowHistory = [];
    this.lastDelta = {};
    this.init();
  }
}
