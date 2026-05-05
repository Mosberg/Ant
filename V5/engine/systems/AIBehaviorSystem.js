import { BaseSystem } from "../BaseSystem.js";

function randomTileTarget(terrain) {
  for (let i = 0; i < 40; i += 1) {
    const x = Math.floor(Math.random() * terrain.width);
    const y = Math.floor(Math.random() * terrain.height);
    if (terrain.isPassable(x, y)) {
      return { x: x + 0.5, y: y + 0.5 };
    }
  }
  return { x: terrain.colonyOrigin.x + 0.5, y: terrain.colonyOrigin.y + 0.5 };
}

export class AIBehaviorSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "ai", config);
    this.decisionClock = 0;
    this.decisionInterval = Number(config.decisionIntervalSeconds ?? 0.35);
  }

  init() {}

  assignState(ant, state, target = null) {
    ant.setState(state, this.engine.time, target);
  }

  getThreatNearby(ant, enemies) {
    return enemies.findNearestEnemy(ant, ant.stats.visionRadius + 1.5);
  }

  handleWorkerFamily(ant, systems) {
    const { terrain, ecology, rooms, pheromones } = systems;

    if (ant.inventory.food > 0 || ant.inventory.biomass > 0) {
      const home =
        rooms.getClosestRoom("food_storage", ant.x, ant.y) ??
        rooms.getClosestRoom("queen_chamber", ant.x, ant.y);
      if (home) {
        this.assignState(ant, "ReturnHome", {
          x: home.tilePosition.x + 0.5,
          y: home.tilePosition.y + 0.5
        });
        return;
      }
    }

    if (ant.role.includes("excavator")) {
      const digOrder = terrain.consumeDigOrderNear(Math.floor(ant.x), Math.floor(ant.y), 18);
      if (digOrder) {
        terrain.queueDigOrder(digOrder.x, digOrder.y);
        this.assignState(ant, "Dig", { x: digOrder.x + 0.5, y: digOrder.y + 0.5 });
        return;
      }
    }

    if (ant.role.includes("builder")) {
      const unfinished = rooms.rooms.find((room) => !room.isComplete);
      if (unfinished) {
        this.assignState(ant, "Build", {
          x: unfinished.tilePosition.x + 0.5,
          y: unfinished.tilePosition.y + 0.5
        });
        return;
      }
    }

    const foodTrail = pheromones.getBestNeighbor(
      "FoodTrail",
      { x: Math.floor(ant.x), y: Math.floor(ant.y) },
      2
    );
    if (foodTrail && foodTrail.value > ant.stats.pheromoneSensitivity * 0.5) {
      this.assignState(ant, "FollowPheromone", {
        x: foodTrail.x + 0.5,
        y: foodTrail.y + 0.5
      });
      return;
    }

    const targetNode = ecology.findNearestCollectible(
      { x: ant.x, y: ant.y },
      ant.role.includes("harvester") ? ["fruits", "dead_insects"] : []
    );
    if (targetNode) {
      this.assignState(ant, "Forage", { x: targetNode.x + 0.5, y: targetNode.y + 0.5 });
      return;
    }

    this.assignState(ant, "Wander", randomTileTarget(terrain));
  }

  handleSupportFamily(ant, systems) {
    const { rooms, ants, terrain } = systems;

    if (ant.role.includes("nurse")) {
      const brood =
        rooms.getClosestRoom("brood_chamber", ant.x, ant.y) ??
        rooms.getClosestRoom("nursery", ant.x, ant.y);
      if (brood) {
        this.assignState(ant, "TendBrood", {
          x: brood.tilePosition.x + 0.5,
          y: brood.tilePosition.y + 0.5
        });
        return;
      }
    }

    if (ant.role.includes("medic")) {
      const injured = ants.findNearestAnt(ant, (entry) => entry.hp < entry.stats.health * 0.7);
      if (injured && injured.id !== ant.id) {
        this.assignState(ant, "Heal", { x: injured.x, y: injured.y });
        return;
      }
    }

    if (ant.role.includes("scout")) {
      this.assignState(
        ant,
        Math.random() > 0.4 ? "Explore" : "LayPheromone",
        randomTileTarget(terrain)
      );
      return;
    }

    this.assignState(ant, "Patrol", randomTileTarget(terrain));
  }

  handleCombatFamily(ant, systems, threat) {
    const { rooms, terrain } = systems;

    if (threat) {
      const nextState = ant.role.includes("guardian") ? "RespondToThreat" : "Fight";
      this.assignState(ant, nextState, { x: threat.x, y: threat.y });
      return;
    }

    if (ant.role.includes("guardian")) {
      const queen = rooms.getClosestRoom("queen_chamber", ant.x, ant.y);
      if (queen) {
        this.assignState(ant, "Patrol", {
          x: queen.tilePosition.x + 0.5,
          y: queen.tilePosition.y + 0.5
        });
        return;
      }
    }

    this.assignState(ant, "Patrol", randomTileTarget(terrain));
  }

  update(_dt) {
    this.decisionClock += _dt;
    if (this.decisionClock < this.decisionInterval) {
      return;
    }

    this.decisionClock = 0;

    const systems = {
      ants: this.engine.getSystem("ants"),
      enemies: this.engine.getSystem("enemies"),
      terrain: this.engine.getSystem("terrain"),
      ecology: this.engine.getSystem("surface"),
      rooms: this.engine.getSystem("rooms"),
      pheromones: this.engine.getSystem("pheromones")
    };

    for (const ant of systems.ants.getAliveAnts()) {
      const threat = this.getThreatNearby(ant, systems.enemies);
      const healthRatio = ant.hp / Math.max(1, ant.stats.health);

      if (
        threat &&
        healthRatio < 0.3 &&
        !ant.role.includes("soldier") &&
        !ant.role.includes("guardian")
      ) {
        const fleeX = ant.x - (threat.x - ant.x);
        const fleeY = ant.y - (threat.y - ant.y);
        this.assignState(ant, "Flee", { x: fleeX, y: fleeY });
        continue;
      }

      if (
        ant.role.includes("worker") ||
        ant.role.includes("harvester") ||
        ant.role.includes("excavator") ||
        ant.role.includes("builder")
      ) {
        this.handleWorkerFamily(ant, systems);
        continue;
      }

      if (ant.role.includes("nurse") || ant.role.includes("medic") || ant.role.includes("scout")) {
        this.handleSupportFamily(ant, systems);
        continue;
      }

      this.handleCombatFamily(ant, systems, threat);
    }
  }

  serialize() {
    return {
      decisionClock: this.decisionClock,
      decisionInterval: this.decisionInterval
    };
  }

  deserialize(state) {
    this.decisionClock = Number(state.decisionClock ?? 0);
    this.decisionInterval = Number(state.decisionInterval ?? this.decisionInterval);
  }

  reset() {
    this.decisionClock = 0;
  }
}
