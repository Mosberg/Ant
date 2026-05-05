import { BaseSystem } from "../BaseSystem.js";
import { getByPath, setByPath } from "../utils.js";

export class TechTreeSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "tech", config);
    this.techMap = new Map();
    this.researched = new Set();
    this.researchPoints = 0;
    this.currentResearchId = null;
    this.currentProgress = 0;
    this.activeEffects = {};
  }

  init() {
    this.techMap.clear();
    for (const tech of this.config.techs ?? []) {
      this.techMap.set(tech.id, tech);
    }

    for (const starter of this.config.starterTech ?? []) {
      if (this.techMap.has(starter)) {
        this.completeResearch(starter, true);
      }
    }
  }

  isResearched(techId) {
    return this.researched.has(techId);
  }

  canResearch(techId) {
    const tech = this.techMap.get(techId);
    if (!tech || this.researched.has(techId)) {
      return false;
    }

    for (const required of tech.prerequisites ?? []) {
      if (!this.researched.has(required)) {
        return false;
      }
    }

    const unlock = tech.unlock ?? null;
    if (unlock?.resource) {
      const resources = this.engine.getSystem("resources");
      if ((resources?.getValue(unlock.resource) ?? 0) < Number(unlock.min ?? 0)) {
        return false;
      }
    }

    return true;
  }

  startResearch(techId) {
    if (!this.canResearch(techId)) {
      return false;
    }

    this.currentResearchId = techId;
    this.currentProgress = 0;
    this.engine.events.emit("tech:started", { techId });
    return true;
  }

  addResearchPoints(amount) {
    this.researchPoints += Math.max(0, amount);
  }

  applyTechEffects(tech) {
    for (const [path, value] of Object.entries(tech.effects ?? {})) {
      const current = getByPath(this.activeEffects, path, null);
      if (typeof value === "number") {
        const next = typeof current === "number" ? current * value : value;
        setByPath(this.activeEffects, path, next);
      } else {
        setByPath(this.activeEffects, path, value);
      }
    }
  }

  completeResearch(techId, silent = false) {
    const tech = this.techMap.get(techId);
    if (!tech || this.researched.has(techId)) {
      return;
    }

    this.researched.add(techId);
    this.applyTechEffects(tech);

    if (!silent) {
      this.engine.events.emit("tech:completed", {
        techId,
        name: tech.name
      });
    }
  }

  getAvailableTechs() {
    return [...this.techMap.values()].filter((tech) => this.canResearch(tech.id));
  }

  getEffect(path, fallback = 1) {
    return getByPath(this.activeEffects, path, fallback);
  }

  update(dt) {
    const rooms = this.engine.getSystem("rooms");
    const resources = this.engine.getSystem("resources");

    const roomEffects = rooms?.getAggregateEffects() ?? {};
    const labRate = Number(roomEffects.researchPerSecond ?? 0.4);
    const jellyBonus = Math.min(2.5, (resources?.getValue("royal_jelly") ?? 0) * 0.004);
    this.addResearchPoints((labRate + jellyBonus) * dt);

    if (!this.currentResearchId) {
      const available = this.getAvailableTechs();
      if (available.length > 0) {
        this.startResearch(available[0].id);
      }
      return;
    }

    const tech = this.techMap.get(this.currentResearchId);
    if (!tech) {
      this.currentResearchId = null;
      this.currentProgress = 0;
      return;
    }

    const pointsThisFrame = Math.min(this.researchPoints, dt * Number(tech.researchRate ?? 6));
    this.researchPoints -= pointsThisFrame;
    this.currentProgress += pointsThisFrame;

    if (this.currentProgress >= Number(tech.cost ?? 100)) {
      this.completeResearch(tech.id);
      this.currentResearchId = null;
      this.currentProgress = 0;
    }
  }

  serialize() {
    return {
      researched: [...this.researched],
      researchPoints: this.researchPoints,
      currentResearchId: this.currentResearchId,
      currentProgress: this.currentProgress,
      activeEffects: this.activeEffects
    };
  }

  deserialize(state) {
    this.researched = new Set(Array.isArray(state.researched) ? state.researched : []);
    this.researchPoints = Number(state.researchPoints ?? 0);
    this.currentResearchId = state.currentResearchId ?? null;
    this.currentProgress = Number(state.currentProgress ?? 0);
    this.activeEffects = state.activeEffects ?? {};
  }

  reset() {
    this.researched.clear();
    this.researchPoints = 0;
    this.currentResearchId = null;
    this.currentProgress = 0;
    this.activeEffects = {};
    this.init();
  }
}
