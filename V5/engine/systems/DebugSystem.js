import { BaseSystem } from "../BaseSystem.js";

export class DebugSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "debug", config);
    this.toggles = {
      showFps: true,
      showEntityCount: true,
      showPathfindingGrid: false,
      showAiStateViewer: false,
      showPheromoneHeatmap: false,
      showRoomStats: false,
      showResourceFlowGraph: false,
      showEventLog: false,
      enableManualSpawnTools: true,
      freeCamera: false,
      ...(config.defaults ?? {})
    };
    this.metrics = {
      fps: 0,
      ants: 0,
      enemies: 0,
      rooms: 0,
      pathfindingQueries: 0,
      pathfindingAvgVisited: 0,
      pathfindingCacheHits: 0,
      pathfindingCacheMisses: 0,
      pathfindingFailedQueries: 0,
      aiStateCounts: {},
      aiQueues: {
        haul: 0,
        intercept: 0,
        frontier: 0
      },
      pheromoneTiles: 0,
      roomCounts: {},
      recentEvents: [],
      resourceFlow: []
    };
    this.metricClock = 0;
  }

  init() {}

  toggle(name) {
    if (!(name in this.toggles)) {
      return;
    }
    this.toggles[name] = !this.toggles[name];
  }

  set(name, value) {
    if (!(name in this.toggles)) {
      return;
    }
    this.toggles[name] = Boolean(value);
  }

  spawnAnt(typeId) {
    const ants = this.engine.getSystem("ants");
    const terrain = this.engine.getSystem("terrain");
    ants?.spawnAnt(typeId, {
      x: terrain.colonyOrigin.x + (Math.random() * 2 - 1),
      y: terrain.colonyOrigin.y + (Math.random() * 2 - 1)
    });
  }

  spawnEnemy(typeId) {
    const enemies = this.engine.getSystem("enemies");
    enemies?.spawnEnemy(typeId);
  }

  updateMetrics() {
    const scene = this.engine.scene;
    const ants = this.engine.getSystem("ants");
    const enemies = this.engine.getSystem("enemies");
    const rooms = this.engine.getSystem("rooms");
    const pathfinding = this.engine.getSystem("pathfinding");
    const pheromones = this.engine.getSystem("pheromones");
    const events = this.engine.getSystem("events");
    const resources = this.engine.getSystem("resources");
    const ai = this.engine.getSystem("ai");

    this.metrics.fps = Number(scene?.game?.loop?.actualFps ?? 0);
    this.metrics.ants = ants?.getAliveAnts().length ?? 0;
    this.metrics.enemies = enemies?.getAliveEnemies().length ?? 0;
    this.metrics.rooms = rooms?.rooms?.length ?? 0;
    this.metrics.pathfindingQueries = Number(pathfinding?.metrics?.queries ?? 0);
    this.metrics.pathfindingAvgVisited = Number(pathfinding?.metrics?.averageVisited ?? 0);
    this.metrics.pathfindingCacheHits = Number(pathfinding?.metrics?.cacheHits ?? 0);
    this.metrics.pathfindingCacheMisses = Number(pathfinding?.metrics?.cacheMisses ?? 0);
    this.metrics.pathfindingFailedQueries = Number(pathfinding?.metrics?.failedQueries ?? 0);

    const stateCounts = {};
    for (const ant of ants.getAliveAnts()) {
      stateCounts[ant.state] = (stateCounts[ant.state] ?? 0) + 1;
    }
    this.metrics.aiStateCounts = stateCounts;
    this.metrics.aiQueues = ai?.getQueueSnapshot?.() ?? this.metrics.aiQueues;

    this.metrics.pheromoneTiles = pheromones?.trails?.size ?? 0;
    this.metrics.roomCounts = rooms?.getRoomCounts() ?? {};
    this.metrics.recentEvents = (events?.eventLog ?? []).slice(-8);
    this.metrics.resourceFlow = (resources?.flowHistory ?? []).slice(-40);
  }

  update(dt) {
    this.metricClock += dt;
    if (this.metricClock >= 0.25) {
      this.metricClock = 0;
      this.updateMetrics();
    }
  }

  getSnapshot() {
    return {
      toggles: { ...this.toggles },
      metrics: { ...this.metrics }
    };
  }

  serialize() {
    return {
      toggles: this.toggles,
      metrics: this.metrics,
      metricClock: this.metricClock
    };
  }

  deserialize(state) {
    this.toggles = { ...this.toggles, ...(state.toggles ?? {}) };
    this.metrics = { ...this.metrics, ...(state.metrics ?? {}) };
    this.metricClock = Number(state.metricClock ?? 0);
  }

  reset() {
    this.metricClock = 0;
    this.updateMetrics();
  }
}
