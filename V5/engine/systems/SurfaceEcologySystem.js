import { BaseSystem } from "../BaseSystem.js";
import { randomChoice, uuid } from "../utils.js";

const ECOLOGY_TYPES = ["plants", "seeds", "fruits", "dead_insects", "water_droplets"];

export class SurfaceEcologySystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "surface", config);
    this.nodes = [];
    this.spawnClock = 0;
  }

  init() {
    const terrain = this.engine.getSystem("terrain");
    const width = terrain?.width ?? 96;
    const maxY = Math.max(1, terrain?.surfaceBandHeight ?? 10);

    this.nodes = [];
    for (let i = 0; i < 35; i += 1) {
      const nodeType = randomChoice(ECOLOGY_TYPES, "plants");
      this.nodes.push(
        this.createNode(nodeType, {
          x: Math.floor(Math.random() * width),
          y: Math.floor(Math.random() * maxY)
        })
      );
    }
  }

  createNode(type, position) {
    const defs = this.config.surfaceFeatures ?? {};
    const def = defs[type] ?? { quantity: [2, 6], decayPerSecond: 0.01 };
    const minQty = Number(def.quantity?.[0] ?? 1);
    const maxQty = Number(def.quantity?.[1] ?? 8);

    return {
      id: uuid("eco"),
      type,
      x: position.x,
      y: position.y,
      quantity: minQty + Math.random() * (maxQty - minQty),
      decayPerSecond: Number(def.decayPerSecond ?? 0.02),
      nutrition: Number(def.nutrition ?? 1)
    };
  }

  spawnNode() {
    const terrain = this.engine.getSystem("terrain");
    const weather = this.engine.getSystem("weather");
    const season = weather?.getCurrentSeason()?.id ?? "spring";
    const width = terrain?.width ?? 96;
    const maxY = Math.max(1, terrain?.surfaceBandHeight ?? 10);

    const seasonalBias = this.config.seasonalBias?.[season] ?? {};
    const weighted = ECOLOGY_TYPES.map((type) => ({
      type,
      weight: Number(seasonalBias[type] ?? 1)
    }));

    let roll = Math.random() * weighted.reduce((sum, item) => sum + item.weight, 0);
    let selected = "plants";
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        selected = item.type;
        break;
      }
    }

    this.nodes.push(
      this.createNode(selected, {
        x: Math.floor(Math.random() * width),
        y: Math.floor(Math.random() * maxY)
      })
    );
  }

  findNearestCollectible(origin, preferredTypes = []) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const node of this.nodes) {
      if (node.quantity <= 0.05) {
        continue;
      }
      if (preferredTypes.length > 0 && !preferredTypes.includes(node.type)) {
        continue;
      }

      const dx = node.x - origin.x;
      const dy = node.y - origin.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDist) {
        bestDist = distSq;
        best = node;
      }
    }

    return best;
  }

  collectFromNode(nodeId, amount) {
    const node = this.nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      return 0;
    }

    const collected = Math.min(node.quantity, amount);
    node.quantity -= collected;
    return collected * node.nutrition;
  }

  update(dt) {
    const weather = this.engine.getSystem("weather");
    const weatherId = weather?.getCurrentWeather()?.id ?? "clear";
    const isDay = weather?.state?.isDay ?? true;

    this.spawnClock += dt;

    const spawnBase = isDay ? 6 : 10;
    const weatherSpawnModifier = weatherId === "storm" ? 0.5 : weatherId === "rain" ? 0.9 : 1;

    if (this.spawnClock >= spawnBase / weatherSpawnModifier) {
      this.spawnClock = 0;
      if (this.nodes.length < 95) {
        this.spawnNode();
      }
    }

    const weatherDecayModifier =
      weatherId === "heatwave" ? 1.9 : weatherId === "cold_snap" ? 0.65 : 1;
    for (const node of this.nodes) {
      node.quantity -= node.decayPerSecond * weatherDecayModifier * dt;
    }

    this.nodes = this.nodes.filter((node) => node.quantity > 0.05);
  }

  serialize() {
    return {
      nodes: this.nodes,
      spawnClock: this.spawnClock
    };
  }

  deserialize(state) {
    this.nodes = Array.isArray(state.nodes) ? [...state.nodes] : [];
    this.spawnClock = Number(state.spawnClock ?? 0);
  }

  reset() {
    this.nodes = [];
    this.spawnClock = 0;
    this.init();
  }
}
