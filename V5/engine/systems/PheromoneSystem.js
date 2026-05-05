import { BaseSystem } from "../BaseSystem.js";
import { clamp } from "../utils.js";

const PHEROMONE_TYPES = [
  "FoodTrail",
  "Danger",
  "Explore",
  "Rally",
  "Avoid",
  "BuildHere",
  "DigHere"
];

function key(x, y) {
  return `${x},${y}`;
}

export class PheromoneSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "pheromones", config);
    this.trails = new Map();
    this.defaultDecayPerSecond = Number(config.defaultDecayPerSecond ?? 0.25);
  }

  init() {}

  lay(type, x, y, intensity = 1) {
    if (!PHEROMONE_TYPES.includes(type)) {
      return;
    }

    const tileKey = key(x, y);
    const current = this.trails.get(tileKey) ?? {};
    current[type] = clamp((current[type] ?? 0) + intensity, 0, 12);
    this.trails.set(tileKey, current);
  }

  sample(type, x, y) {
    const tileKey = key(x, y);
    const current = this.trails.get(tileKey);
    if (!current) {
      return 0;
    }
    return Number(current[type] ?? 0);
  }

  getBestNeighbor(type, origin, radius = 1) {
    let best = null;
    let bestValue = 0;

    for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
      for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
        const value = this.sample(type, x, y);
        if (value > bestValue) {
          bestValue = value;
          best = { x, y, value };
        }
      }
    }

    return best;
  }

  update(dt) {
    const weather = this.engine.getSystem("weather");
    const rainFactor = weather?.getCurrentWeather()?.id === "rain" ? 1.8 : 1;
    const stormFactor = weather?.getCurrentWeather()?.id === "storm" ? 2.6 : 1;
    const decay = this.defaultDecayPerSecond * rainFactor * stormFactor * dt;

    for (const [tileKey, payload] of this.trails.entries()) {
      let total = 0;
      for (const type of PHEROMONE_TYPES) {
        if (!(type in payload)) {
          continue;
        }
        payload[type] = Math.max(0, payload[type] - decay);
        total += payload[type];
      }

      if (total < 0.02) {
        this.trails.delete(tileKey);
      } else {
        this.trails.set(tileKey, payload);
      }
    }
  }

  serialize() {
    return {
      trails: Array.from(this.trails.entries())
    };
  }

  deserialize(state) {
    this.trails = new Map(Array.isArray(state.trails) ? state.trails : []);
  }

  reset() {
    this.trails.clear();
  }
}
