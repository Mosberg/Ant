import { AIBehaviorSystem } from "./systems/AIBehaviorSystem.js";
import { AntSystem } from "./systems/AntSystem.js";
import { ColonyMoraleSystem } from "./systems/ColonyMoraleSystem.js";
import { DebugSystem } from "./systems/DebugSystem.js";
import { DifficultyScalingSystem } from "./systems/DifficultyScalingSystem.js";
import { EnemySystem } from "./systems/EnemySystem.js";
import { EventSystem } from "./systems/EventSystem.js";
import { FogOfWarSystem } from "./systems/FogOfWarSystem.js";
import { PathfindingSystem } from "./systems/PathfindingSystem.js";
import { PheromoneSystem } from "./systems/PheromoneSystem.js";
import { ResourceSystem } from "./systems/ResourceSystem.js";
import { RoomSystem } from "./systems/RoomSystem.js";
import { SaveLoadSystem } from "./systems/SaveLoadSystem.js";
import { SettingsSystem } from "./systems/SettingsSystem.js";
import { SurfaceEcologySystem } from "./systems/SurfaceEcologySystem.js";
import { TechTreeSystem } from "./systems/TechTreeSystem.js";
import { UndergroundTerrainSystem } from "./systems/UndergroundTerrainSystem.js";
import { WeatherSystem } from "./systems/WeatherSystem.js";

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, handler) {
    const list = this.listeners.get(eventName) ?? [];
    list.push(handler);
    this.listeners.set(eventName, list);
    return () => this.off(eventName, handler);
  }

  off(eventName, handler) {
    const list = this.listeners.get(eventName) ?? [];
    this.listeners.set(
      eventName,
      list.filter((entry) => entry !== handler)
    );
  }

  emit(eventName, payload) {
    const list = this.listeners.get(eventName) ?? [];
    for (const handler of list) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Event handler failed for ${eventName}:`, error);
      }
    }
  }
}

export class GameEngine {
  constructor(scene, configBundle) {
    this.scene = scene;
    this.configBundle = configBundle;
    this.events = new EventBus();
    this.systems = new Map();
    this.time = 0;

    this.updateOrder = [
      "settings",
      "difficulty",
      "weather",
      "terrain",
      "pathfinding",
      "pheromones",
      "resources",
      "rooms",
      "surface",
      "tech",
      "ants",
      "ai",
      "enemies",
      "fog",
      "events",
      "morale",
      "debug",
      "saveLoad"
    ];

    this.registerSystem("settings", new SettingsSystem(this, configBundle.settings));
    this.registerSystem(
      "difficulty",
      new DifficultyScalingSystem(this, configBundle.settings?.difficulty ?? {})
    );
    this.registerSystem("weather", new WeatherSystem(this, configBundle.weather));
    this.registerSystem("terrain", new UndergroundTerrainSystem(this, configBundle.weather));
    this.registerSystem(
      "pathfinding",
      new PathfindingSystem(this, configBundle.weather?.pathfinding ?? {})
    );
    this.registerSystem(
      "pheromones",
      new PheromoneSystem(this, configBundle.weather?.pheromones ?? {})
    );
    this.registerSystem("resources", new ResourceSystem(this, configBundle.resources));
    this.registerSystem("rooms", new RoomSystem(this, configBundle.rooms));
    this.registerSystem("surface", new SurfaceEcologySystem(this, configBundle.weather));
    this.registerSystem("tech", new TechTreeSystem(this, configBundle.tech));
    this.registerSystem("ants", new AntSystem(this, configBundle.ants));
    this.registerSystem("ai", new AIBehaviorSystem(this, configBundle.ants?.ai ?? {}));
    this.registerSystem("enemies", new EnemySystem(this, configBundle.enemies));
    this.registerSystem("fog", new FogOfWarSystem(this, configBundle.weather?.fog ?? {}));
    this.registerSystem("events", new EventSystem(this, configBundle.events));
    this.registerSystem(
      "morale",
      new ColonyMoraleSystem(this, configBundle.settings?.morale ?? {})
    );
    this.registerSystem("debug", new DebugSystem(this, configBundle.settings?.debug ?? {}));
    this.registerSystem(
      "saveLoad",
      new SaveLoadSystem(this, configBundle.settings?.saveLoad ?? {})
    );
  }

  registerSystem(key, system) {
    this.systems.set(key, system);
  }

  getSystem(key) {
    return this.systems.get(key);
  }

  init() {
    for (const key of this.updateOrder) {
      this.systems.get(key)?.init();
    }
  }

  update(dt) {
    this.time += dt;
    const settings = this.getSystem("settings");
    const gameSpeed = Number(settings?.getGameSpeed?.() ?? 1);

    for (const key of this.updateOrder) {
      const system = this.getSystem(key);
      if (!system || !system.enabled) {
        continue;
      }

      const isMetaSystem = key === "settings" || key === "saveLoad" || key === "debug";
      const systemDt = isMetaSystem ? dt : dt * gameSpeed;
      system.update(systemDt);
    }
  }

  serializeState(excludedSystems = []) {
    const excluded = new Set(excludedSystems);
    const payload = {
      meta: {
        time: this.time
      },
      systems: {}
    };

    for (const [key, system] of this.systems.entries()) {
      if (excluded.has(key)) {
        continue;
      }
      payload.systems[key] = system.serialize();
    }

    return payload;
  }

  deserializeState(payload) {
    this.time = Number(payload?.meta?.time ?? 0);

    const systemPayload = payload?.systems ?? {};
    for (const [key, state] of Object.entries(systemPayload)) {
      const system = this.getSystem(key);
      system?.deserialize(state);
    }
  }

  reset() {
    this.time = 0;
    for (const key of this.updateOrder) {
      this.getSystem(key)?.reset();
    }
  }
}
