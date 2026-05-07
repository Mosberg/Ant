import { AntEntity } from "../../entities/AntEntity.js";
import { BaseSystem } from "../BaseSystem.js";
import { distance } from "../utils.js";

function toWorldFromTile(terrain, tilePos) {
  return {
    x: tilePos.x + 0.5,
    y: tilePos.y + 0.5
  };
}

export class AntSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "ants", config);
    this.antTypes = new Map();
    this.traitsPool = [...(config.traitsPool ?? [])];
    this.leveling = config.leveling ?? {};
    this.ants = [];
    this.deathCount = 0;
    this.hatchClock = 0;
    this.lastSpawnTypeIndex = 0;
    this.navigation = new Map();
    this.defaultRepathIntervalSeconds = Number(config.pathing?.repathIntervalSeconds ?? 0.5);
    this.defaultMaxVisitedNodes = Number(config.pathing?.maxVisitedNodes ?? 1700);
    this.defaultWaypointReachDistance = Number(config.pathing?.waypointReachDistance ?? 0.17);
    this.defaultMorphFoodCost = Number(config.morphing?.foodCostPerAnt ?? 4);
    this.defaultMorphBiomassCost = Number(config.morphing?.biomassCostPerAnt ?? 1);
    this.defaultMorphRoyalJellyCost = Number(config.morphing?.royalJellyCostPerAnt ?? 1);
  }

  init() {
    this.antTypes.clear();
    this.ants = [];
    this.deathCount = 0;
    this.hatchClock = 0;
    this.lastSpawnTypeIndex = 0;
    this.navigation.clear();

    for (const type of this.config.types ?? []) {
      this.antTypes.set(type.id, type);
    }

    const terrain = this.engine.getSystem("terrain");
    const origin = terrain?.colonyOrigin ?? { x: 48, y: 20 };

    for (const spawn of this.config.startingColony ?? []) {
      for (let i = 0; i < Number(spawn.count ?? 0); i += 1) {
        this.spawnAnt(spawn.typeId, {
          x: origin.x + (Math.random() * 4 - 2),
          y: origin.y + (Math.random() * 4 - 2)
        });
      }
    }
  }

  canUnlock(typeDef) {
    const unlock = typeDef.unlock ?? { type: "start" };
    if (unlock.type === "start") {
      return true;
    }

    if (unlock.type === "day") {
      const weather = this.engine.getSystem("weather");
      return (weather?.state?.dayCount ?? 0) >= Number(unlock.value ?? 0);
    }

    if (unlock.type === "resource") {
      const resources = this.engine.getSystem("resources");
      return (resources?.getValue(unlock.resource) ?? 0) >= Number(unlock.value ?? 0);
    }

    if (unlock.type === "tech") {
      const tech = this.engine.getSystem("tech");
      return tech?.isResearched(unlock.value) ?? false;
    }

    return false;
  }

  getUnlockedTypeIds() {
    const output = [];
    for (const type of this.antTypes.values()) {
      if (this.canUnlock(type)) {
        output.push(type.id);
      }
    }
    return output;
  }

  spawnAnt(typeId, position) {
    const typeDef = this.antTypes.get(typeId);
    if (!typeDef) {
      return null;
    }

    if (!this.canUnlock(typeDef)) {
      return null;
    }

    const ant = new AntEntity(typeDef, position, this.traitsPool);
    this.ants.push(ant);
    this.engine.events.emit("ants:spawned", ant);
    return ant;
  }

  getAliveAnts() {
    return this.ants.filter((ant) => ant.isAlive());
  }

  getAntById(antId) {
    return this.ants.find((ant) => ant.id === antId) ?? null;
  }

  getTypeDef(typeId) {
    return this.antTypes.get(typeId) ?? null;
  }

  getSetting(path, fallback) {
    return this.engine.getSystem("settings")?.get(path, fallback) ?? fallback;
  }

  getTechMultiplier(path, fallback = 1) {
    return Number(this.engine.getSystem("tech")?.getEffect(path, fallback) ?? fallback);
  }

  getMorphCostPerAnt() {
    const jellyEfficiency = Math.max(
      0.1,
      this.getTechMultiplier("resources.royalJellyUseMultiplier", 1)
    );

    return {
      food: Math.max(
        0,
        Number(this.getSetting("gameplay.antMorphFoodCost", this.defaultMorphFoodCost))
      ),
      biomass: Math.max(
        0,
        Number(this.getSetting("gameplay.antMorphBiomassCost", this.defaultMorphBiomassCost))
      ),
      royal_jelly: Math.max(
        0,
        Math.ceil(
          Number(
            this.getSetting("gameplay.antMorphRoyalJellyCost", this.defaultMorphRoyalJellyCost)
          ) * jellyEfficiency
        )
      )
    };
  }

  morphAnt(ant, targetTypeId) {
    const typeDef = this.getTypeDef(targetTypeId);
    if (!ant || !typeDef || !this.canUnlock(typeDef)) {
      return false;
    }

    const hpRatio = ant.hp / Math.max(1, ant.stats.health);
    const targetPosition = { x: ant.x, y: ant.y };
    const replaced = new AntEntity(typeDef, targetPosition, []);

    replaced.id = ant.id;
    replaced.level = Math.max(1, Number(ant.level ?? 1));
    replaced.xp = Number(ant.xp ?? 0);
    replaced.inventory = { ...ant.inventory };
    replaced.traits = [...(ant.traits ?? [])];
    replaced.abilities = [...(typeDef.abilities ?? [])];
    replaced.state = "Idle";
    replaced.target = { x: ant.x, y: ant.y };
    replaced.lastStateChange = this.engine.time;
    replaced.attackCooldown = 0;
    replaced.taskCooldown = Math.min(0.5, Number(ant.taskCooldown ?? 0));

    for (const trait of replaced.traits) {
      replaced.applyTrait(trait);
    }

    for (let level = 1; level < replaced.level; level += 1) {
      replaced.levelUp(this.leveling);
    }

    replaced.hp = Math.max(1, replaced.stats.health * hpRatio);

    const index = this.ants.findIndex((entry) => entry.id === ant.id);
    if (index < 0) {
      return false;
    }

    this.ants[index] = replaced;
    this.navigation.delete(replaced.id);
    return true;
  }

  morphAnts(antIds, targetTypeId) {
    if (!Array.isArray(antIds) || antIds.length === 0 || !targetTypeId) {
      return 0;
    }

    const targets = antIds
      .map((antId) => this.getAntById(antId))
      .filter((ant) => ant?.isAlive() && ant.typeId !== targetTypeId);

    if (targets.length === 0) {
      return 0;
    }

    const costPerAnt = this.getMorphCostPerAnt();
    const totalCost = {
      food: costPerAnt.food * targets.length,
      biomass: costPerAnt.biomass * targets.length,
      royal_jelly: costPerAnt.royal_jelly * targets.length
    };

    const resources = this.engine.getSystem("resources");
    if (!resources?.canAfford(totalCost)) {
      return 0;
    }

    if (!resources.applyCost(totalCost)) {
      return 0;
    }

    let changed = 0;
    for (const ant of targets) {
      if (this.morphAnt(ant, targetTypeId)) {
        changed += 1;
      }
    }

    return changed;
  }

  isPathingEnabled() {
    return Boolean(this.getSetting("pathfinding.enableAntPathing", true));
  }

  getCombatFormationMultiplier(ant) {
    const role = String(ant.role ?? "");
    if (!role.includes("soldier") && !role.includes("guardian") && !role.includes("spitter")) {
      return 1;
    }

    const radius = Math.max(1.2, Number(this.getSetting("ai.combatPackRadius", 4.4)));
    const perMate = Math.max(0, Number(this.getSetting("ai.combatPackDamagePerMate", 0.07)));
    const maxBonus = Math.max(0, Number(this.getSetting("ai.combatPackMaxBonus", 0.45)));

    let nearbyFighters = 0;
    for (const candidate of this.getAliveAnts()) {
      if (candidate.id === ant.id) {
        continue;
      }

      const candidateRole = String(candidate.role ?? "");
      if (!candidateRole.includes("soldier") && !candidateRole.includes("guardian")) {
        continue;
      }

      if (distance(candidate, ant) <= radius) {
        nearbyFighters += 1;
      }
    }

    const formationTech = this.getTechMultiplier("combat.formationBonus", 1);
    const formationBonus = Math.min(maxBonus, nearbyFighters * perMate);
    return (1 + formationBonus) * formationTech;
  }

  getAttackDamage(ant) {
    const base = ant.stats.attackDamage * (1 + ant.level * 0.08);
    const tech = this.getTechMultiplier("ant.attackDamageMultiplier", 1);
    return base * tech * this.getCombatFormationMultiplier(ant);
  }

  getDigPower(ant) {
    const rolePower = ant.role.includes("excavator") ? 2 : 1;
    const techMultiplier = this.getTechMultiplier("dig.powerMultiplier", 1);
    const gameplayScale = Math.max(0.2, Number(this.getSetting("gameplay.digPowerScale", 1)));
    return rolePower * techMultiplier * gameplayScale;
  }

  getHealAmount(ant) {
    const base = 1.8 + ant.level * 0.15;
    return base * this.getTechMultiplier("ant.healPowerMultiplier", 1);
  }

  resolvePathProfile(ant) {
    if (!Boolean(this.getSetting("pathfinding.useRoleProfiles", true))) {
      return "default";
    }

    const state = String(ant.state ?? "");
    const role = String(ant.role ?? "");

    if (state === "Fight" || state === "RespondToThreat" || role.includes("soldier")) {
      return "soldier_intercept";
    }

    if (state === "Explore" || state === "LayPheromone" || role.includes("scout")) {
      return "scout_frontier";
    }

    if (
      state === "Forage" ||
      state === "CarryFood" ||
      state === "ReturnHome" ||
      state === "FollowPheromone" ||
      role.includes("worker") ||
      role.includes("harvester") ||
      role.includes("builder") ||
      role.includes("excavator")
    ) {
      return "worker_hauler";
    }

    return "default";
  }

  getNavigation(ant) {
    if (!this.navigation.has(ant.id)) {
      this.navigation.set(ant.id, {
        goalKey: "",
        waypoints: [],
        waypointIndex: 0,
        hasRoute: false,
        repathClock: 0,
        stuckSeconds: 0,
        lastX: ant.x,
        lastY: ant.y
      });
    }
    return this.navigation.get(ant.id);
  }

  moveAntTowardsTarget(ant, dt, speedModifier) {
    if (!ant.target) {
      return true;
    }

    if (!this.isPathingEnabled()) {
      return ant.updateMovement(dt, speedModifier);
    }

    const terrain = this.engine.getSystem("terrain");
    const pathfinding = this.engine.getSystem("pathfinding");
    if (!terrain || !pathfinding) {
      return ant.updateMovement(dt, speedModifier);
    }

    const nav = this.getNavigation(ant);
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
    const profile = this.resolvePathProfile(ant);

    const startTile = {
      x: Math.floor(ant.x),
      y: Math.floor(ant.y)
    };
    const goalTile = {
      x: Math.floor(ant.target.x),
      y: Math.floor(ant.target.y)
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

    let moveTarget = ant.target;
    while (nav.waypointIndex < nav.waypoints.length) {
      const waypoint = nav.waypoints[nav.waypointIndex];
      const dx = waypoint.x - ant.x;
      const dy = waypoint.y - ant.y;
      if (dx * dx + dy * dy <= waypointReachDistance * waypointReachDistance) {
        nav.waypointIndex += 1;
        continue;
      }
      moveTarget = waypoint;
      break;
    }

    const finalTarget = ant.target;
    ant.target = moveTarget;
    const reachedWaypoint = ant.updateMovement(dt, speedModifier);
    ant.target = finalTarget;

    if (reachedWaypoint && nav.waypointIndex < nav.waypoints.length) {
      nav.waypointIndex += 1;
    }

    const movedDx = ant.x - nav.lastX;
    const movedDy = ant.y - nav.lastY;
    if (movedDx * movedDx + movedDy * movedDy < 0.0004) {
      nav.stuckSeconds += dt;
    } else {
      nav.stuckSeconds = 0;
    }
    nav.lastX = ant.x;
    nav.lastY = ant.y;

    if (nav.stuckSeconds > 1.2) {
      nav.repathClock = 0;
      nav.stuckSeconds = 0;
    }

    const finalDx = finalTarget.x - ant.x;
    const finalDy = finalTarget.y - ant.y;
    return finalDx * finalDx + finalDy * finalDy < 0.03;
  }

  getAntCounts() {
    const counts = {};
    for (const ant of this.getAliveAnts()) {
      counts[ant.typeId] = (counts[ant.typeId] ?? 0) + 1;
    }
    return counts;
  }

  findNearestAnt(point, predicate = () => true) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const ant of this.getAliveAnts()) {
      if (!predicate(ant)) {
        continue;
      }
      const dist = distance(ant, point);
      if (dist < bestDist) {
        bestDist = dist;
        best = ant;
      }
    }

    return best;
  }

  depositCargo(ant) {
    if (!ant.inventory.food && !ant.inventory.biomass) {
      return;
    }

    const resources = this.engine.getSystem("resources");
    if (ant.inventory.food > 0) {
      resources?.add("food", ant.inventory.food);
      ant.inventory.food = 0;
    }
    if (ant.inventory.biomass > 0) {
      resources?.add("biomass", ant.inventory.biomass);
      ant.inventory.biomass = 0;
    }
    ant.gainXp(2.5, this.leveling, this.traitsPool);
  }

  updateAntTask(ant, dt) {
    const terrain = this.engine.getSystem("terrain");
    const rooms = this.engine.getSystem("rooms");
    const resources = this.engine.getSystem("resources");
    const ecology = this.engine.getSystem("surface");
    const enemies = this.engine.getSystem("enemies");
    const pheromones = this.engine.getSystem("pheromones");
    const weather = this.engine.getSystem("weather");

    const speedModifier = Number(weather?.getModifier("antSpeedMultiplier", 1) ?? 1);
    const reached = this.moveAntTowardsTarget(ant, dt, speedModifier);

    ant.attackCooldown = Math.max(0, ant.attackCooldown - dt);
    ant.taskCooldown = Math.max(0, ant.taskCooldown - dt);

    if (!reached || ant.taskCooldown > 0) {
      return;
    }

    const tileX = Math.floor(ant.x);
    const tileY = Math.floor(ant.y);

    switch (ant.state) {
      case "Forage": {
        const node = ecology?.findNearestCollectible({ x: ant.x, y: ant.y });
        if (node) {
          const amount = Math.min(ant.stats.carryCapacity, 4);
          const collected = ecology.collectFromNode(node.id, amount);
          ant.inventory.food += collected;
          ant.gainXp(2, this.leveling, this.traitsPool);
          ant.taskCooldown = 0.35;
          pheromones?.lay("FoodTrail", Math.floor(node.x), Math.floor(node.y), 1.4);
        }
        break;
      }
      case "ReturnHome":
      case "CarryFood": {
        const home =
          rooms?.getClosestRoom("food_storage", tileX, tileY) ??
          rooms?.getClosestRoom("queen_chamber", tileX, tileY);
        if (home && distance(ant, home.tilePosition) <= 1.4) {
          this.depositCargo(ant);
          ant.taskCooldown = 0.2;
          pheromones?.lay("FoodTrail", tileX, tileY, 0.8);
        }
        break;
      }
      case "Dig": {
        const digPower = this.getDigPower(ant);
        const targetTile = {
          x: Math.floor(ant.target?.x ?? ant.x),
          y: Math.floor(ant.target?.y ?? ant.y)
        };

        const atTarget = distance(ant, { x: targetTile.x + 0.5, y: targetTile.y + 0.5 }) <= 1.25;
        if (atTarget && terrain?.isDiggable(targetTile.x, targetTile.y)) {
          const digResult = terrain.digTile(targetTile.x, targetTile.y, digPower);
          if (digResult) {
            terrain.removeDigOrder?.(targetTile.x, targetTile.y);
            resources?.add(digResult.resource, digResult.amount);
            ant.gainXp(3.5, this.leveling, this.traitsPool);
            ant.taskCooldown = 0.35;
          }
          break;
        }

        const pending = terrain?.findDigOrderNear(tileX, tileY, 20);
        if (pending) {
          ant.target = toWorldFromTile(terrain, pending);
          ant.taskCooldown = 0.08;
          pheromones?.lay("DigHere", pending.x, pending.y, 1.2);
          break;
        }

        if (terrain?.isDiggable(tileX, tileY)) {
          const digResult = terrain.digTile(tileX, tileY, digPower);
          if (digResult) {
            terrain.removeDigOrder?.(tileX, tileY);
            resources?.add(digResult.resource, digResult.amount);
            ant.gainXp(3.5, this.leveling, this.traitsPool);
            ant.taskCooldown = 0.4;
          }
        }
        break;
      }
      case "Build": {
        const room = rooms?.rooms.find((entry) => !entry.isComplete);
        if (room && distance(ant, room.tilePosition) <= 2) {
          room.buildTimeRemaining = Math.max(
            0,
            room.buildTimeRemaining - (ant.role.includes("builder") ? 2.4 : 1.2) * dt
          );
          ant.gainXp(2.2, this.leveling, this.traitsPool);
          pheromones?.lay("BuildHere", room.tilePosition.x, room.tilePosition.y, 1);
        }
        break;
      }
      case "Fight":
      case "RespondToThreat": {
        const enemy = enemies?.findNearestEnemy(
          { x: ant.x, y: ant.y },
          ant.stats.visionRadius + 1.2
        );
        if (enemy && ant.attackCooldown <= 0) {
          const damage = this.getAttackDamage(ant);
          const killed = enemy.applyDamage(damage);
          ant.attackCooldown = Math.max(0.2, 1 / Math.max(0.1, ant.stats.attackSpeed));
          ant.gainXp(3.2, this.leveling, this.traitsPool);
          if (killed) {
            resources?.add("biomass", 2);
          }
        }
        break;
      }
      case "TendBrood": {
        resources?.add("larvae", 0.25);
        ant.gainXp(1.3, this.leveling, this.traitsPool);
        ant.taskCooldown = 0.6;
        break;
      }
      case "Heal": {
        const target = this.findNearestAnt(
          ant,
          (candidate) => candidate.hp < candidate.stats.health * 0.7
        );
        if (target && target.id !== ant.id && distance(ant, target) <= 1.3) {
          target.heal(this.getHealAmount(ant));
          ant.gainXp(2, this.leveling, this.traitsPool);
          ant.taskCooldown = 0.4;
        }
        break;
      }
      case "LayPheromone": {
        pheromones?.lay("Explore", tileX, tileY, 0.85);
        ant.taskCooldown = 0.2;
        break;
      }
      case "FollowPheromone": {
        const best = pheromones?.getBestNeighbor("FoodTrail", { x: tileX, y: tileY }, 1);
        if (best) {
          ant.target = { x: best.x + 0.5, y: best.y + 0.5 };
          ant.taskCooldown = 0.1;
        }
        break;
      }
      default:
        break;
    }
  }

  hatchNewAnt(dt) {
    this.hatchClock += dt;
    if (this.hatchClock < Number(this.config.hatchIntervalSeconds ?? 18)) {
      return;
    }

    this.hatchClock = 0;
    const resources = this.engine.getSystem("resources");
    const rooms = this.engine.getSystem("rooms");
    const effects = rooms?.getAggregateEffects() ?? {};
    const hatchRate = Number(effects.hatchRateMultiplier ?? 1);

    if (Math.random() > 0.4 * hatchRate) {
      return;
    }

    if (!resources?.canAfford({ food: 6, larvae: 2 })) {
      return;
    }

    const unlocked = this.getUnlockedTypeIds();
    if (unlocked.length === 0) {
      return;
    }

    const nextType = unlocked[this.lastSpawnTypeIndex % unlocked.length];
    this.lastSpawnTypeIndex += 1;

    resources.applyCost({ food: 6, larvae: 2 });
    const terrain = this.engine.getSystem("terrain");
    const origin = terrain?.colonyOrigin ?? { x: 48, y: 20 };
    this.spawnAnt(nextType, {
      x: origin.x + (Math.random() * 2 - 1),
      y: origin.y + (Math.random() * 2 - 1)
    });
  }

  update(dt) {
    this.hatchNewAnt(dt);

    const aliveAnts = this.getAliveAnts();
    for (const ant of aliveAnts) {
      this.updateAntTask(ant, dt);
    }

    const aliveBefore = this.ants.length;
    this.ants = this.ants.filter((ant) => ant.isAlive());
    this.deathCount += aliveBefore - this.ants.length;

    const aliveSet = new Set(aliveAnts.map((ant) => ant.id));
    for (const antId of this.navigation.keys()) {
      if (!aliveSet.has(antId)) {
        this.navigation.delete(antId);
      }
    }
  }

  serialize() {
    return {
      ants: this.ants.map((ant) => ant.serialize()),
      deathCount: this.deathCount,
      hatchClock: this.hatchClock,
      lastSpawnTypeIndex: this.lastSpawnTypeIndex
    };
  }

  deserialize(state) {
    this.deathCount = Number(state.deathCount ?? 0);
    this.hatchClock = Number(state.hatchClock ?? 0);
    this.lastSpawnTypeIndex = Number(state.lastSpawnTypeIndex ?? 0);
    this.ants = (state.ants ?? [])
      .map((serialized) => {
        const typeDef = this.antTypes.get(serialized.typeId);
        if (!typeDef) {
          return null;
        }
        return AntEntity.deserialize(serialized, typeDef, this.traitsPool);
      })
      .filter(Boolean);
    this.navigation.clear();
  }

  reset() {
    this.navigation.clear();
    this.init();
  }
}
