import { BaseSystem } from "../BaseSystem.js";

export class FogOfWarSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "fog", config);
    this.visible = [];
    this.discovered = [];
    this.updateClock = 0;
  }

  init() {
    const terrain = this.engine.getSystem("terrain");
    this.visible = [];
    this.discovered = [];

    for (let y = 0; y < terrain.height; y += 1) {
      const rowVisible = [];
      const rowDiscovered = [];
      for (let x = 0; x < terrain.width; x += 1) {
        rowVisible.push(false);
        rowDiscovered.push(false);
      }
      this.visible.push(rowVisible);
      this.discovered.push(rowDiscovered);
    }
  }

  revealCircle(cx, cy, radius) {
    const terrain = this.engine.getSystem("terrain");
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(terrain.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(terrain.height - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > radius * radius) {
          continue;
        }
        this.visible[y][x] = true;
        this.discovered[y][x] = true;
      }
    }
  }

  update(dt) {
    this.updateClock += dt;
    if (this.updateClock < 0.2) {
      return;
    }
    this.updateClock = 0;

    for (let y = 0; y < this.visible.length; y += 1) {
      this.visible[y].fill(false);
    }

    const ants = this.engine.getSystem("ants");
    for (const ant of ants.getAliveAnts()) {
      const bonus = ant.role.includes("scout") ? 2.5 : 0;
      this.revealCircle(ant.x, ant.y, ant.stats.visionRadius + bonus);
    }
  }

  isVisible(x, y) {
    if (!this.visible[y] || typeof this.visible[y][x] !== "boolean") {
      return false;
    }
    return this.visible[y][x];
  }

  isDiscovered(x, y) {
    if (!this.discovered[y] || typeof this.discovered[y][x] !== "boolean") {
      return false;
    }
    return this.discovered[y][x];
  }

  serialize() {
    return {
      visible: this.visible,
      discovered: this.discovered,
      updateClock: this.updateClock
    };
  }

  deserialize(state) {
    this.visible = Array.isArray(state.visible) ? state.visible : [];
    this.discovered = Array.isArray(state.discovered) ? state.discovered : [];
    this.updateClock = Number(state.updateClock ?? 0);
  }

  reset() {
    this.init();
  }
}
