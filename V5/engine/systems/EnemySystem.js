import { EnemyEntity } from "../../entities/EnemyEntity.js";
import { BaseSystem } from "../BaseSystem.js";
import { distance, randomChoice } from "../utils.js";

export class EnemySystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "enemies", config);
    this.enemyTypeMap = new Map();
    this.enemies = [];
    this.spawnClock = 0;
    this.wave = 0;
    this.navigation = new Map();
    this.spawnLaneIndex = 0;
    this.defaultRepathIntervalSeconds = Number(config.pathing?.repathIntervalSeconds ?? 0.45);
    this.defaultMaxVisitedNodes = Number(config.pathing?.maxVisitedNodes ?? 1700);
    this.defaultWaypointReachDistance = Number(config.pathing?.waypointReachDistance ?? 0.19);
  }

  init() {
    this.enemyTypeMap.clear();
    this.enemies = [];
    this.spawnClock = 0;
    this.wave = 0;
    this.navigation.clear();
    this.spawnLaneIndex = 0;

    for (const enemyType of this.config.enemyTypes ?? []) {
      this.enemyTypeMap.set(enemyType.id, enemyType);
    }

    this.spawnEnemy("spider");
    this.spawnEnemy("beetle");
  }

  getSpawnPoint() {
    const terrain = this.engine.getSystem("terrain");
    const lanes = terrain?.getEnemyEntryLanes?.() ?? [];
    if (lanes.length > 0) {
      const lane = lanes[this.spawnLaneIndex % lanes.length];
      this.spawnLaneIndex += 1;
      return {
        x: lane.x + 0.5 + (Math.random() * 0.5 - 0.25),
        y: Math.max(0.5, Number(lane.surfaceY ?? 0) + 0.5),
        entryLane: lane
      };
    }

    const x = Math.floor(Math.random() * terrain.width);
    return { x: x + 0.5, y: 0.5, entryLane: null };
  }

  resolveEntryLane(enemy, terrain) {
    if (enemy.entryLane) {
      return enemy.entryLane;
    }

    const lanes = terrain?.getEnemyEntryLanes?.() ?? [];
    if (lanes.length === 0) {
      return null;
    }

    let best = lanes[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const lane of lanes) {
      const dx = enemy.x - (lane.x + 0.5);
      const distSq = dx * dx;
      if (distSq < bestDist) {
        bestDist = distSq;
        best = lane;
      }
    }

    enemy.entryLane = { ...best };
    return enemy.entryLane;
  }

  spawnEnemy(typeId = null, position = null) {
    let selectedTypeId = typeId;
    if (!selectedTypeId) {
      const all = Array.from(this.enemyTypeMap.keys());
      selectedTypeId = randomChoice(all, "spider");
    }

    const typeDef = this.enemyTypeMap.get(selectedTypeId);
    if (!typeDef) {
      return null;
    }

    const spawnData = position ?? this.getSpawnPoint();
    const enemy = new EnemyEntity(typeDef, { x: spawnData.x, y: spawnData.y });
    enemy.entryLane = spawnData.entryLane ? { ...spawnData.entryLane } : null;
    enemy.hasEnteredColony = !enemy.entryLane;

    if (enemy.entryLane) {
      enemy.setState("Ingress", {
        x: enemy.entryLane.x + 0.5,
        y: Number(enemy.entryLane.connectorY ?? enemy.entryLane.entryY ?? 0) + 0.5
      });
    }

    this.enemies.push(enemy);
    this.engine.events.emit("enemies:spawned", enemy);
    return enemy;
  }

  getAliveEnemies() {
    return this.enemies.filter((enemy) => enemy.alive);
  }

  getSetting(path, fallback) {
    return this.engine.getSystem("settings")?.get(path, fallback) ?? fallback;
  }

  isPathingEnabled() {
    return Boolean(this.getSetting("pathfinding.enableEnemyPathing", true));
  }

  resolvePathProfile(enemy) {
    if (!Boolean(this.getSetting("pathfinding.useRoleProfiles", true))) {
      return "default";
    }

    if (enemy.state === "Hunt") {
      return "soldier_intercept";
    }

    return "enemy_raider";
  }

  getNavigation(enemy) {
    if (!this.navigation.has(enemy.id)) {
      this.navigation.set(enemy.id, {
        goalKey: "",
        waypoints: [],
        waypointIndex: 0,
        hasRoute: false,
        repathClock: 0,
        stuckSeconds: 0,
        lastX: enemy.x,
        lastY: enemy.y
      });
    }
    return this.navigation.get(enemy.id);
  }

  moveEnemyTowardsTarget(enemy, dt, speedMultiplier) {
    if (!enemy.target) {
      return true;
    }

    if (!this.isPathingEnabled()) {
      return enemy.updateMovement(dt, speedMultiplier);
    }

    const terrain = this.engine.getSystem("terrain");
    const pathfinding = this.engine.getSystem("pathfinding");
    if (!terrain || !pathfinding) {
      return enemy.updateMovement(dt, speedMultiplier);
    }

    const nav = this.getNavigation(enemy);
    const repathInterval = Math.max(
      0.08,
      Number(
        this.getSetting("pathfinding.repathIntervalSeconds", this.defaultRepathIntervalSeconds)
      )
    );
    const maxVisitedNodes = Math.max(
      120,
      Number(this.getSetting("pathfinding.maxVisitedNodes", this.defaultMaxVisitedNodes))
    );
    const waypointReachDistance = Math.max(
      0.08,
      Number(
        this.getSetting("pathfinding.waypointReachDistance", this.defaultWaypointReachDistance)
      )
    );
    const allowDiagonal = Boolean(this.getSetting("pathfinding.allowDiagonal", true));
    const profile = this.resolvePathProfile(enemy);

    const startTile = {
      x: Math.floor(enemy.x),
      y: Math.floor(enemy.y)
    };
    const goalTile = {
      x: Math.floor(enemy.target.x),
      y: Math.floor(enemy.target.y)
    };
    const goalKey = `${goalTile.x},${goalTile.y}`;

    nav.repathClock -= dt;
    if (
      nav.goalKey !== goalKey ||
      nav.repathClock <= 0 ||
      nav.waypointIndex >= nav.waypoints.length
    ) {
      const path = pathfinding.findPath(startTile, goalTile, maxVisitedNodes, {
        allowDiagonal,
        profile
      });

      nav.goalKey = goalKey;
      nav.repathClock = repathInterval;
      nav.stuckSeconds = 0;

      if (path.length > 1) {
        nav.waypoints = path.map((tile) => ({ x: tile.x + 0.5, y: tile.y + 0.5 }));
        nav.waypointIndex = 1;
        nav.hasRoute = true;
      } else {
        nav.waypoints = [];
        nav.waypointIndex = 0;
        nav.hasRoute = startTile.x === goalTile.x && startTile.y === goalTile.y;
      }
    }

    if (!nav.hasRoute && nav.waypoints.length === 0) {
      return false;
    }

    let moveTarget = enemy.target;
    while (nav.waypointIndex < nav.waypoints.length) {
      const waypoint = nav.waypoints[nav.waypointIndex];
      const dx = waypoint.x - enemy.x;
      const dy = waypoint.y - enemy.y;
      if (dx * dx + dy * dy <= waypointReachDistance * waypointReachDistance) {
        nav.waypointIndex += 1;
        continue;
      }
      moveTarget = waypoint;
      break;
    }

    const finalTarget = enemy.target;
    enemy.target = moveTarget;
    const reachedWaypoint = enemy.updateMovement(dt, speedMultiplier);
    enemy.target = finalTarget;

    if (reachedWaypoint && nav.waypointIndex < nav.waypoints.length) {
      nav.waypointIndex += 1;
    }

    const movedDx = enemy.x - nav.lastX;
    const movedDy = enemy.y - nav.lastY;
    if (movedDx * movedDx + movedDy * movedDy < 0.0004) {
      nav.stuckSeconds += dt;
    } else {
      nav.stuckSeconds = 0;
    }
    nav.lastX = enemy.x;
    nav.lastY = enemy.y;

    if (nav.stuckSeconds > 1.2) {
      nav.repathClock = 0;
      nav.stuckSeconds = 0;
    }

    const finalDx = finalTarget.x - enemy.x;
    const finalDy = finalTarget.y - enemy.y;
    return finalDx * finalDx + finalDy * finalDy < 0.03;
  }

  advanceThroughEntry(enemy, dt, speedModifier, terrain) {
    const lane = this.resolveEntryLane(enemy, terrain);
    if (!lane) {
      enemy.hasEnteredColony = true;
      return true;
    }

    const ingressTarget = {
      x: lane.x + 0.5,
      y: Number(lane.connectorY ?? lane.entryY ?? terrain.surfaceBandHeight) + 0.5
    };

    enemy.setState("Ingress", ingressTarget);
    this.moveEnemyTowardsTarget(enemy, dt, speedModifier);

    if (enemy.y >= ingressTarget.y - 0.35 || distance(enemy, ingressTarget) <= 0.75) {
      enemy.hasEnteredColony = true;
      return true;
    }

    return false;
  }

  findNearestEnemy(point, maxDistance = 999) {
    let best = null;
    let bestDistance = maxDistance;

    for (const enemy of this.getAliveEnemies()) {
      const d = distance(enemy, point);
      if (d < bestDistance) {
        bestDistance = d;
        best = enemy;
      }
    }

    return best;
  }

  updateSpawn(dt) {
    this.spawnClock += dt;

    const difficulty = this.engine.getSystem("difficulty");
    const weather = this.engine.getSystem("weather");

    const spawnInterval = Number(this.config.spawnRules?.baseIntervalSeconds ?? 18);
    const spawnMultiplier = Number(difficulty?.getMultiplier("enemySpawnMultiplier", 1) ?? 1);
    const weatherModifier = Number(weather?.getModifier("enemySpawnMultiplier", 1) ?? 1);

    const interval = Math.max(
      3.5,
      spawnInterval / Math.max(0.2, spawnMultiplier * weatherModifier)
    );

    if (this.spawnClock >= interval) {
      this.spawnClock = 0;
      this.wave += 1;

      const enemyPool = (this.config.spawnRules?.waves ?? []).flatMap((waveRule) => {
        if (this.wave >= Number(waveRule.minWave ?? 1)) {
          return waveRule.enemyTypes ?? [];
        }
        return [];
      });

      const fallbackPool = Array.from(this.enemyTypeMap.keys());
      const chosen = randomChoice(enemyPool.length > 0 ? enemyPool : fallbackPool, "spider");
      this.spawnEnemy(chosen);
    }
  }

  updateEnemyBehavior(enemy, dt) {
    const ants = this.engine.getSystem("ants");
    const rooms = this.engine.getSystem("rooms");
    const resources = this.engine.getSystem("resources");
    const pheromones = this.engine.getSystem("pheromones");
    const weather = this.engine.getSystem("weather");
    const difficulty = this.engine.getSystem("difficulty");
    const terrain = this.engine.getSystem("terrain");

    const speedModifier = Number(weather?.getModifier("enemySpeedMultiplier", 1) ?? 1);
    const powerModifier = Number(difficulty?.getMultiplier("enemyPowerMultiplier", 1) ?? 1);

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    if (!enemy.hasEnteredColony) {
      const entered = this.advanceThroughEntry(enemy, dt, speedModifier, terrain);
      if (pheromones) {
        pheromones.lay("Danger", Math.floor(enemy.x), Math.floor(enemy.y), 0.42 * dt * 60);
      }
      if (!entered) {
        return;
      }
    }

    const nearestAnt = ants.findNearestAnt(enemy);
    const queenRoom = rooms.getClosestRoom("queen_chamber", enemy.x, enemy.y);

    if (nearestAnt && distance(enemy, nearestAnt) < enemy.visionRadius) {
      enemy.setState("Hunt", { x: nearestAnt.x, y: nearestAnt.y });
    } else if (queenRoom) {
      enemy.setState("Raid", {
        x: queenRoom.tilePosition.x + 0.5,
        y: queenRoom.tilePosition.y + 0.5
      });
    }

    this.moveEnemyTowardsTarget(enemy, dt, speedModifier);

    if (pheromones) {
      pheromones.lay("Danger", Math.floor(enemy.x), Math.floor(enemy.y), 0.55 * dt * 60);
    }

    if (nearestAnt && distance(enemy, nearestAnt) <= 1.1 && enemy.attackCooldown <= 0) {
      const killed = nearestAnt.applyDamage(enemy.attackDamage * powerModifier);
      enemy.attackCooldown = Math.max(0.2, 1 / Math.max(0.1, enemy.attackRate));
      if (killed) {
        this.engine.events.emit("ants:killedByEnemy", {
          antId: nearestAnt.id,
          enemyId: enemy.id
        });
      }
      return;
    }

    if (queenRoom && distance(enemy, queenRoom.tilePosition) <= 1.2 && enemy.attackCooldown <= 0) {
      const morale = this.engine.getSystem("morale");
      morale?.addInstant(-2.5 * powerModifier, `${enemy.name} struck the queen chamber`);
      enemy.attackCooldown = Math.max(0.45, 1 / Math.max(0.1, enemy.attackRate));
    }

    if (enemy.behavior.includes("steal") && Math.random() < 0.001 * dt * 60) {
      resources.consume("food", 1);
    }

    if (enemy.behavior.includes("layEggs") && Math.random() < 0.0007 * dt * 60) {
      this.spawnEnemy("mite_swarm", { x: enemy.x + 0.4, y: enemy.y + 0.4 });
    }
  }

  update(dt) {
    this.updateSpawn(dt);

    const aliveEnemies = this.getAliveEnemies();
    for (const enemy of aliveEnemies) {
      this.updateEnemyBehavior(enemy, dt);
    }

    const resources = this.engine.getSystem("resources");
    const aliveBefore = this.enemies.length;
    this.enemies = this.enemies.filter((enemy) => {
      if (enemy.alive) {
        return true;
      }
      resources?.add("biomass", 3);
      return false;
    });

    const removed = aliveBefore - this.enemies.length;
    if (removed > 0) {
      this.engine.events.emit("enemies:cleared", { count: removed });
    }

    const aliveSet = new Set(this.enemies.filter((entry) => entry.alive).map((entry) => entry.id));
    for (const enemyId of this.navigation.keys()) {
      if (!aliveSet.has(enemyId)) {
        this.navigation.delete(enemyId);
      }
    }
  }

  serialize() {
    return {
      enemies: this.enemies.map((enemy) => ({
        ...enemy.serialize(),
        entryLane: enemy.entryLane ? { ...enemy.entryLane } : null,
        hasEnteredColony: Boolean(enemy.hasEnteredColony)
      })),
      spawnClock: this.spawnClock,
      wave: this.wave,
      spawnLaneIndex: this.spawnLaneIndex
    };
  }

  deserialize(state) {
    this.spawnClock = Number(state.spawnClock ?? 0);
    this.wave = Number(state.wave ?? 0);
    this.spawnLaneIndex = Number(state.spawnLaneIndex ?? 0);
    this.enemies = (state.enemies ?? [])
      .map((serialized) => {
        const typeDef = this.enemyTypeMap.get(serialized.typeId);
        if (!typeDef) {
          return null;
        }
        const enemy = EnemyEntity.deserialize(serialized, typeDef);
        enemy.entryLane = serialized.entryLane ? { ...serialized.entryLane } : null;
        enemy.hasEnteredColony =
          typeof serialized.hasEnteredColony === "boolean"
            ? serialized.hasEnteredColony
            : !enemy.entryLane;
        return enemy;
      })
      .filter(Boolean);
    this.navigation.clear();
  }

  reset() {
    this.navigation.clear();
    this.init();
  }
}
