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
  }

  init() {
    this.antTypes.clear();
    this.ants = [];
    this.deathCount = 0;
    this.hatchClock = 0;
    this.lastSpawnTypeIndex = 0;

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
    const reached = ant.updateMovement(dt, speedModifier);

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
        const order = terrain?.consumeDigOrderNear(tileX, tileY, 2);
        if (order) {
          ant.target = toWorldFromTile(terrain, order);
          ant.taskCooldown = 0.15;
          pheromones?.lay("DigHere", order.x, order.y, 1.2);
        } else {
          const digResult = terrain?.digTile(tileX, tileY, ant.role.includes("excavator") ? 2 : 1);
          if (digResult) {
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
          const damage = ant.stats.attackDamage * (1 + ant.level * 0.08);
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
          target.heal(1.8 + ant.level * 0.15);
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

    for (const ant of this.getAliveAnts()) {
      this.updateAntTask(ant, dt);
    }

    const aliveBefore = this.ants.length;
    this.ants = this.ants.filter((ant) => ant.isAlive());
    this.deathCount += aliveBefore - this.ants.length;
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
  }

  reset() {
    this.init();
  }
}
