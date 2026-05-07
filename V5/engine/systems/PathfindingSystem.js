import { BaseSystem } from "../BaseSystem.js";

function key(x, y) {
  return `${x},${y}`;
}

class MinHeap {
  constructor(compareFn) {
    this.compareFn = compareFn;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return null;
    }

    const first = this.items[0];
    const end = this.items.pop();
    if (this.items.length > 0 && end) {
      this.items[0] = end;
      this.bubbleDown(0);
    }
    return first;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compareFn(this.items[index], this.items[parentIndex]) >= 0) {
        break;
      }
      [this.items[index], this.items[parentIndex]] = [this.items[parentIndex], this.items[index]];
      index = parentIndex;
    }
  }

  bubbleDown(index) {
    const length = this.items.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = left + 1;

      if (left < length && this.compareFn(this.items[left], this.items[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compareFn(this.items[right], this.items[smallest]) < 0) {
        smallest = right;
      }

      if (smallest === index) {
        return;
      }

      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function clonePath(path) {
  return path.map((node) => ({ x: node.x, y: node.y }));
}

const BASE_PROFILE = {
  tileMultipliers: {
    tunnel: 1,
    room: 1,
    surface: 1
  },
  dangerWeight: 0,
  foodTrailWeight: 0,
  frontierBonus: 0,
  exploredPenalty: 0,
  floodedPenalty: 3.5
};

const DEFAULT_ROLE_PROFILES = {
  default: {
    tileMultipliers: {
      tunnel: 1,
      room: 0.95,
      surface: 1.15
    },
    dangerWeight: 0.08,
    foodTrailWeight: 0,
    frontierBonus: 0,
    exploredPenalty: 0,
    floodedPenalty: 4.5
  },
  worker_hauler: {
    tileMultipliers: {
      tunnel: 0.88,
      room: 0.82,
      surface: 1.35
    },
    dangerWeight: 0.22,
    foodTrailWeight: 0.1,
    frontierBonus: 0,
    exploredPenalty: 0,
    floodedPenalty: 6
  },
  soldier_intercept: {
    tileMultipliers: {
      tunnel: 1,
      room: 0.95,
      surface: 0.95
    },
    dangerWeight: -0.04,
    foodTrailWeight: 0,
    frontierBonus: 0,
    exploredPenalty: 0,
    floodedPenalty: 3.2
  },
  scout_frontier: {
    tileMultipliers: {
      tunnel: 1,
      room: 1,
      surface: 0.92
    },
    dangerWeight: 0.04,
    foodTrailWeight: 0,
    frontierBonus: 0.22,
    exploredPenalty: 0.04,
    floodedPenalty: 2.8
  },
  enemy_raider: {
    tileMultipliers: {
      tunnel: 0.95,
      room: 0.82,
      surface: 0.98
    },
    dangerWeight: -0.06,
    foodTrailWeight: 0,
    frontierBonus: 0,
    exploredPenalty: 0,
    floodedPenalty: 3.2
  }
};

function normalizeProfile(rawProfile = {}) {
  const merged = {
    ...BASE_PROFILE,
    ...rawProfile
  };

  merged.tileMultipliers = {
    ...BASE_PROFILE.tileMultipliers,
    ...(rawProfile.tileMultipliers ?? {})
  };

  return {
    tileMultipliers: {
      tunnel: Number(merged.tileMultipliers.tunnel ?? 1),
      room: Number(merged.tileMultipliers.room ?? 1),
      surface: Number(merged.tileMultipliers.surface ?? 1)
    },
    dangerWeight: Number(merged.dangerWeight ?? 0),
    foodTrailWeight: Number(merged.foodTrailWeight ?? 0),
    frontierBonus: Number(merged.frontierBonus ?? 0),
    exploredPenalty: Number(merged.exploredPenalty ?? 0),
    floodedPenalty: Number(merged.floodedPenalty ?? 3.5)
  };
}

export class PathfindingSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "pathfinding", config);
    this.maxNodes = Math.max(80, Number(config.maxNodes ?? 1600));
    this.cacheTtlSeconds = Math.max(0, Number(config.cacheTtlSeconds ?? 4));
    this.cacheMaxEntries = Math.max(64, Number(config.cacheMaxEntries ?? 1200));
    this.allowDiagonalDefault = Boolean(config.allowDiagonal ?? true);
    this.tileCosts = {
      tunnel: Number(config.tileCosts?.tunnel ?? 1),
      room: Number(config.tileCosts?.room ?? 0.92),
      surface: Number(config.tileCosts?.surface ?? 1.18)
    };
    this.roleProfiles = this.buildRoleProfiles(config.roleProfiles ?? {});
    this.neighbors4 = [
      { x: 1, y: 0, diagonal: false },
      { x: -1, y: 0, diagonal: false },
      { x: 0, y: 1, diagonal: false },
      { x: 0, y: -1, diagonal: false }
    ];
    this.neighbors8 = [
      ...this.neighbors4,
      { x: 1, y: 1, diagonal: true },
      { x: 1, y: -1, diagonal: true },
      { x: -1, y: 1, diagonal: true },
      { x: -1, y: -1, diagonal: true }
    ];
    this.cache = new Map();
    this.cachePruneClock = 0;
    this.metrics = {
      queries: 0,
      totalVisited: 0,
      averageVisited: 0,
      lastVisited: 0,
      lastDurationMs: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failedQueries: 0,
      cacheSize: 0
    };
  }

  init() {
    this.cache.clear();
    this.cachePruneClock = 0;
  }

  getNeighbors(allowDiagonal) {
    return allowDiagonal ? this.neighbors8 : this.neighbors4;
  }

  getSetting(path, fallback) {
    return this.engine.getSystem("settings")?.get(path, fallback) ?? fallback;
  }

  getMaxVisited(overrideValue) {
    const configured = Number(this.getSetting("pathfinding.maxVisitedNodes", this.maxNodes));
    const source =
      overrideValue == null || Number.isNaN(Number(overrideValue))
        ? configured
        : Number(overrideValue);
    return Math.max(80, Math.floor(source));
  }

  buildRoleProfiles(customProfiles = {}) {
    const output = {};
    const profileNames = new Set([
      ...Object.keys(DEFAULT_ROLE_PROFILES),
      ...Object.keys(customProfiles)
    ]);

    for (const profileName of profileNames) {
      const defaultProfile = DEFAULT_ROLE_PROFILES[profileName] ?? DEFAULT_ROLE_PROFILES.default;
      const customProfile = customProfiles[profileName] ?? {};
      output[profileName] = normalizeProfile({
        ...defaultProfile,
        ...customProfile,
        tileMultipliers: {
          ...(defaultProfile.tileMultipliers ?? {}),
          ...(customProfile.tileMultipliers ?? {})
        }
      });
    }

    if (!output.default) {
      output.default = normalizeProfile(DEFAULT_ROLE_PROFILES.default);
    }

    return output;
  }

  roleProfilesEnabled() {
    return Boolean(this.getSetting("pathfinding.useRoleProfiles", true));
  }

  resolveProfile(requestedProfile) {
    if (!this.roleProfilesEnabled()) {
      return {
        name: "default",
        ...this.roleProfiles.default
      };
    }

    const profileName =
      typeof requestedProfile === "string" && requestedProfile in this.roleProfiles
        ? requestedProfile
        : "default";

    return {
      name: profileName,
      ...this.roleProfiles[profileName]
    };
  }

  getDangerCostScale() {
    return Math.max(0, Number(this.getSetting("pathfinding.dangerCostScale", 1)));
  }

  isCacheEnabled() {
    return Boolean(this.getSetting("pathfinding.enableCache", true));
  }

  allowsDiagonalRouting(explicit) {
    if (typeof explicit === "boolean") {
      return explicit;
    }
    return Boolean(this.getSetting("pathfinding.allowDiagonal", this.allowDiagonalDefault));
  }

  canTraverse(terrain, x, y, goal) {
    return terrain.isPassable(x, y) || (x === goal.x && y === goal.y);
  }

  traversalCost(
    terrain,
    pheromones,
    fog,
    x,
    y,
    diagonal = false,
    profile = BASE_PROFILE,
    dangerCostScale = 1
  ) {
    const tile = terrain.getTile(x, y);
    if (!tile) {
      return Number.POSITIVE_INFINITY;
    }

    const tileWeight = Number(this.tileCosts[tile.type] ?? 1.05);
    const profileMultiplier = Number(profile.tileMultipliers?.[tile.type] ?? 1);
    let cost = tileWeight * profileMultiplier;

    if (tile.flooded) {
      cost += Number(profile.floodedPenalty ?? 3.5);
    }

    if (pheromones) {
      const danger = Number(pheromones.sample("Danger", x, y) ?? 0);
      cost += danger * Number(profile.dangerWeight ?? 0) * dangerCostScale;

      const foodTrail = Number(pheromones.sample("FoodTrail", x, y) ?? 0);
      if (foodTrail > 0 && Number(profile.foodTrailWeight ?? 0) > 0) {
        const reduction = Math.min(cost * 0.6, foodTrail * Number(profile.foodTrailWeight));
        cost -= reduction;
      }
    }

    if (fog) {
      if (!fog.isDiscovered(x, y) && Number(profile.frontierBonus ?? 0) > 0) {
        cost -= Number(profile.frontierBonus);
      } else if (fog.isDiscovered(x, y) && Number(profile.exploredPenalty ?? 0) > 0) {
        cost += Number(profile.exploredPenalty);
      }
    }

    cost = Math.max(0.12, cost);
    return cost * (diagonal ? Math.SQRT2 : 1);
  }

  heuristic(a, b, allowDiagonal) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    if (!allowDiagonal) {
      return dx + dy;
    }
    // Octile distance avoids overestimating when diagonals are allowed.
    const diagonal = Math.min(dx, dy);
    const straight = Math.max(dx, dy) - diagonal;
    return diagonal * Math.SQRT2 + straight;
  }

  makeCacheKey(
    start,
    goal,
    maxVisited,
    allowDiagonal,
    profileName,
    dangerCostScale,
    terrainRevision
  ) {
    const dangerToken = Math.round(dangerCostScale * 100);
    return `${start.x},${start.y}>${goal.x},${goal.y}|m${maxVisited}|d${allowDiagonal ? 1 : 0}|p${profileName}|g${dangerToken}|r${terrainRevision}`;
  }

  readCachedPath(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      this.metrics.cacheMisses += 1;
      return null;
    }

    if (entry.expiresAt < this.engine.time) {
      this.cache.delete(cacheKey);
      this.metrics.cacheMisses += 1;
      return null;
    }

    this.metrics.cacheHits += 1;
    return clonePath(entry.path);
  }

  writeCachedPath(cacheKey, path) {
    if (this.cacheTtlSeconds <= 0) {
      return;
    }

    this.cache.set(cacheKey, {
      path: clonePath(path),
      expiresAt: this.engine.time + this.cacheTtlSeconds
    });

    if (this.cache.size > this.cacheMaxEntries) {
      const overflow = this.cache.size - this.cacheMaxEntries;
      const keys = this.cache.keys();
      for (let i = 0; i < overflow; i += 1) {
        const next = keys.next();
        if (next.done) {
          break;
        }
        this.cache.delete(next.value);
      }
    }

    this.metrics.cacheSize = this.cache.size;
  }

  updateMetrics(durationMs, visited, failed = false) {
    this.metrics.lastVisited = visited;
    this.metrics.lastDurationMs = durationMs;
    this.metrics.totalVisited += visited;
    this.metrics.averageVisited = this.metrics.totalVisited / Math.max(1, this.metrics.queries);
    this.metrics.cacheSize = this.cache.size;
    if (failed) {
      this.metrics.failedQueries += 1;
    }
  }

  findPath(start, goal, maxVisited = undefined, options = {}) {
    const terrain = this.engine.getSystem("terrain");
    const pheromones = this.engine.getSystem("pheromones");
    const fog = this.engine.getSystem("fog");
    if (!terrain || !terrain.inBounds(start.x, start.y) || !terrain.inBounds(goal.x, goal.y)) {
      return [];
    }

    const startNode = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const goalNode = { x: Math.floor(goal.x), y: Math.floor(goal.y) };
    const maxVisitedLimit = this.getMaxVisited(maxVisited);
    const allowDiagonal = this.allowsDiagonalRouting(options.allowDiagonal);
    const profile = this.resolveProfile(options.profile);
    const dangerCostScale = this.getDangerCostScale();
    const terrainRevision = Number(terrain.revision ?? 0);
    const cacheKey = this.makeCacheKey(
      startNode,
      goalNode,
      maxVisitedLimit,
      allowDiagonal,
      profile.name,
      dangerCostScale,
      terrainRevision
    );

    if (startNode.x === goalNode.x && startNode.y === goalNode.y) {
      return [startNode];
    }

    this.metrics.queries += 1;
    const startedAt = nowMs();

    if (this.isCacheEnabled()) {
      const cached = this.readCachedPath(cacheKey);
      if (cached) {
        this.updateMetrics(0, cached.length);
        return cached;
      }
    }

    const open = new MinHeap((a, b) => {
      if (a.f !== b.f) {
        return a.f - b.f;
      }
      return a.h - b.h;
    });

    const startKey = key(startNode.x, startNode.y);
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);
    const closed = new Set();
    let visited = 0;

    const startRecord = {
      x: startNode.x,
      y: startNode.y,
      g: 0,
      h: this.heuristic(startNode, goalNode, allowDiagonal)
    };
    startRecord.f = startRecord.g + startRecord.h;
    open.push(startRecord);

    while (open.size > 0 && visited < maxVisitedLimit) {
      const current = open.pop();
      if (!current) {
        break;
      }

      const currentKey = key(current.x, current.y);
      if (closed.has(currentKey)) {
        continue;
      }

      visited += 1;

      if (current.x === goalNode.x && current.y === goalNode.y) {
        const path = this.reconstructPath(cameFrom, current);
        if (this.isCacheEnabled()) {
          this.writeCachedPath(cacheKey, path);
        }
        this.updateMetrics(nowMs() - startedAt, visited, false);
        return path;
      }

      closed.add(currentKey);

      for (const offset of this.getNeighbors(allowDiagonal)) {
        const neighbor = {
          x: current.x + offset.x,
          y: current.y + offset.y
        };
        if (!terrain.inBounds(neighbor.x, neighbor.y)) {
          continue;
        }

        const neighborKey = key(neighbor.x, neighbor.y);
        if (closed.has(neighborKey)) {
          continue;
        }

        const tilePassable = this.canTraverse(terrain, neighbor.x, neighbor.y, goalNode);

        if (!tilePassable) {
          continue;
        }

        if (offset.diagonal) {
          // Prevent clipping diagonally through blocked corner tiles.
          const horizontalPassable = this.canTraverse(
            terrain,
            current.x + offset.x,
            current.y,
            goalNode
          );
          const verticalPassable = this.canTraverse(
            terrain,
            current.x,
            current.y + offset.y,
            goalNode
          );
          if (!horizontalPassable || !verticalPassable) {
            continue;
          }
        }

        const moveCost = this.traversalCost(
          terrain,
          pheromones,
          fog,
          neighbor.x,
          neighbor.y,
          offset.diagonal,
          profile,
          dangerCostScale
        );
        if (!Number.isFinite(moveCost)) {
          continue;
        }

        const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + moveCost;
        const existing = gScore.get(neighborKey);

        if (existing != null && tentative >= existing) {
          continue;
        }

        cameFrom.set(neighborKey, { x: current.x, y: current.y });
        gScore.set(neighborKey, tentative);

        const h = this.heuristic(neighbor, goalNode, allowDiagonal);
        open.push({
          x: neighbor.x,
          y: neighbor.y,
          g: tentative,
          h,
          f: tentative + h
        });
      }
    }

    this.updateMetrics(nowMs() - startedAt, visited, true);
    return [];
  }

  reconstructPath(cameFrom, current) {
    const path = [{ x: current.x, y: current.y }];
    let cursorKey = key(current.x, current.y);

    while (cameFrom.has(cursorKey)) {
      const previous = cameFrom.get(cursorKey);
      path.push({ x: previous.x, y: previous.y });
      cursorKey = key(previous.x, previous.y);
    }

    return path.reverse();
  }

  pruneCache() {
    if (this.cache.size === 0) {
      this.metrics.cacheSize = 0;
      return;
    }

    const now = this.engine.time;
    for (const [cacheKey, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(cacheKey);
      }
    }

    this.metrics.cacheSize = this.cache.size;
  }

  update(dt) {
    this.cachePruneClock += dt;
    if (this.cachePruneClock < 0.8) {
      return;
    }
    this.cachePruneClock = 0;
    this.pruneCache();
  }

  serialize() {
    return {
      metrics: { ...this.metrics }
    };
  }

  deserialize(state) {
    this.metrics = {
      ...this.metrics,
      ...(state.metrics ?? {})
    };
  }

  reset() {
    this.cache.clear();
    this.cachePruneClock = 0;
    this.metrics = {
      queries: 0,
      totalVisited: 0,
      averageVisited: 0,
      lastVisited: 0,
      lastDurationMs: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failedQueries: 0,
      cacheSize: 0
    };
  }
}
