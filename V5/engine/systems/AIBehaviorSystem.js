import { BaseSystem } from "../BaseSystem.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

function stableHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export class AIBehaviorSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "ai", config);
    this.decisionClock = 0;
    this.decisionInterval = Number(config.decisionIntervalSeconds ?? 0.35);
    this.defaultStateHoldSeconds = Number(config.stateHoldSeconds ?? 0.55);
    this.defaultMaxDecisionsPerTick = Number(config.maxDecisionsPerTick ?? 28);
    this.defaultDangerThreshold = Number(config.dangerThreshold ?? 0.95);
    this.defaultUseJobQueues = Boolean(config.useJobQueues ?? true);
    this.defaultJobQueueRefreshSeconds = Number(config.jobQueueRefreshSeconds ?? 0.45);
    this.defaultJobClaimTtlSeconds = Number(config.jobClaimTtlSeconds ?? 4);
    this.defaultMaxHaulJobs = Number(config.maxHaulJobs ?? 22);
    this.defaultMaxInterceptJobs = Number(config.maxInterceptJobs ?? 16);
    this.defaultMaxFrontierJobs = Number(config.maxFrontierJobs ?? 20);
    this.nextDecisionIndex = 0;
    this.queueRefreshClock = 0;
    this.jobQueues = {
      haul: [],
      intercept: [],
      frontier: []
    };
  }

  init() {
    this.nextDecisionIndex = 0;
    this.queueRefreshClock = 0;
    this.jobQueues.haul = [];
    this.jobQueues.intercept = [];
    this.jobQueues.frontier = [];
  }

  getSetting(path, fallback) {
    return this.engine.getSystem("settings")?.get(path, fallback) ?? fallback;
  }

  getDecisionInterval() {
    return Math.max(
      0.06,
      Number(this.getSetting("ai.decisionIntervalSeconds", this.decisionInterval))
    );
  }

  getMaxDecisionsPerTick() {
    return Math.max(
      4,
      Math.floor(Number(this.getSetting("ai.maxDecisionsPerTick", this.defaultMaxDecisionsPerTick)))
    );
  }

  getStateHoldSeconds() {
    return Math.max(
      0,
      Number(this.getSetting("ai.stateHoldSeconds", this.defaultStateHoldSeconds))
    );
  }

  getDangerThreshold() {
    return Math.max(
      0.2,
      Number(this.getSetting("ai.dangerPheromoneThreshold", this.defaultDangerThreshold))
    );
  }

  isJobQueuesEnabled() {
    return Boolean(this.getSetting("ai.useJobQueues", this.defaultUseJobQueues));
  }

  getQueueRefreshSeconds() {
    return Math.max(
      0.15,
      Number(this.getSetting("ai.jobQueueRefreshSeconds", this.defaultJobQueueRefreshSeconds))
    );
  }

  getClaimTtlSeconds() {
    return Math.max(
      0.5,
      Number(this.getSetting("ai.jobClaimTtlSeconds", this.defaultJobClaimTtlSeconds))
    );
  }

  getQueueLimit(queueName) {
    if (queueName === "haul") {
      return Math.max(2, Number(this.getSetting("ai.maxHaulJobs", this.defaultMaxHaulJobs)));
    }
    if (queueName === "intercept") {
      return Math.max(
        2,
        Number(this.getSetting("ai.maxInterceptJobs", this.defaultMaxInterceptJobs))
      );
    }
    return Math.max(2, Number(this.getSetting("ai.maxFrontierJobs", this.defaultMaxFrontierJobs)));
  }

  getQueueSnapshot() {
    return {
      haul: this.jobQueues.haul.length,
      intercept: this.jobQueues.intercept.length,
      frontier: this.jobQueues.frontier.length
    };
  }

  clearJobQueues() {
    this.jobQueues.haul = [];
    this.jobQueues.intercept = [];
    this.jobQueues.frontier = [];
  }

  releaseExpiredClaims() {
    const now = this.engine.time;
    for (const queue of Object.values(this.jobQueues)) {
      for (const job of queue) {
        if (job.claimedBy && job.claimExpiresAt <= now) {
          job.claimedBy = "";
          job.claimExpiresAt = 0;
        }
      }
    }
  }

  claimBestJob(queueName, ant, predicate = () => true) {
    const queue = this.jobQueues[queueName] ?? [];
    if (queue.length === 0) {
      return null;
    }

    const now = this.engine.time;
    const ttl = this.getClaimTtlSeconds();
    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const job of queue) {
      const claimAvailable =
        !job.claimedBy || job.claimedBy === ant.id || Number(job.claimExpiresAt ?? 0) <= now;
      if (!claimAvailable || !predicate(job)) {
        continue;
      }

      const dx = job.x - ant.x;
      const dy = job.y - ant.y;
      const distanceCost = Math.sqrt(dx * dx + dy * dy);
      const stickyBonus = job.claimedBy === ant.id ? 1.2 : 0;
      const score = Number(job.priority ?? 0) + stickyBonus - distanceCost * 0.28;

      if (score > bestScore) {
        bestScore = score;
        best = job;
      }
    }

    if (!best) {
      return null;
    }

    best.claimedBy = ant.id;
    best.claimExpiresAt = now + ttl;
    return best;
  }

  shouldHoldState(ant, threat) {
    if (threat) {
      return false;
    }

    const stickyStates = new Set([
      "Forage",
      "ReturnHome",
      "CarryFood",
      "Dig",
      "Build",
      "Fight",
      "RespondToThreat",
      "Heal",
      "TendBrood",
      "FollowPheromone",
      "Flee"
    ]);
    if (!stickyStates.has(ant.state)) {
      return false;
    }

    const holdSeconds = this.getStateHoldSeconds();
    const age = this.engine.time - Number(ant.lastStateChange ?? 0);
    return age < holdSeconds;
  }

  getFoodNeed(resources) {
    if (!resources) {
      return 0;
    }
    const value = Number(resources.getValue("food") ?? 0);
    const capacity = Math.max(1, Number(resources.getCapacity("food") ?? 1));
    return clamp(1 - value / capacity, 0, 1);
  }

  getDangerSignal(ant, pheromones) {
    const reading = pheromones.getBestNeighbor(
      "Danger",
      { x: Math.floor(ant.x), y: Math.floor(ant.y) },
      2
    );
    if (!reading) {
      return null;
    }

    if (reading.value < this.getDangerThreshold()) {
      return null;
    }
    return reading;
  }

  computeFleeTarget(ant, dangerPoint, terrain) {
    const threatX = dangerPoint.x + 0.5;
    const threatY = dangerPoint.y + 0.5;
    const awayX = ant.x - (threatX - ant.x) * 1.9;
    const awayY = ant.y - (threatY - ant.y) * 1.9;
    const x = clamp(awayX, 0.5, terrain.width - 0.5);
    const y = clamp(awayY, 0.5, terrain.height - 0.5);

    if (terrain.isPassable(Math.floor(x), Math.floor(y))) {
      return { x, y };
    }

    return randomTileTarget(terrain);
  }

  findScoutTarget(systems) {
    const { fog, terrain } = systems;
    if (!fog) {
      return randomTileTarget(terrain);
    }

    for (let i = 0; i < 36; i += 1) {
      const x = Math.floor(Math.random() * terrain.width);
      const y = Math.floor(Math.random() * terrain.height);
      if (!terrain.isPassable(x, y)) {
        continue;
      }
      if (!fog.isDiscovered(x, y)) {
        return { x: x + 0.5, y: y + 0.5 };
      }
    }

    return randomTileTarget(terrain);
  }

  buildHaulJobs(systems) {
    const { ecology, terrain, resources } = systems;
    if (!ecology || !terrain) {
      return [];
    }

    const limit = this.getQueueLimit("haul");
    const foodNeed = this.getFoodNeed(resources);
    const origin = terrain.colonyOrigin ?? { x: 48, y: 20 };

    const candidates = (ecology.nodes ?? [])
      .filter((node) => Number(node.quantity ?? 0) > 0.2)
      .map((node) => {
        const dx = node.x - origin.x;
        const dy = node.y - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const richness = Number(node.quantity ?? 0) * Number(node.nutrition ?? 1);
        const priority = richness * (1.2 + foodNeed * 2.1) - dist * 0.08;
        return {
          id: `haul:${node.id}`,
          type: "haul",
          x: node.x + 0.5,
          y: node.y + 0.5,
          priority,
          claimedBy: "",
          claimExpiresAt: 0
        };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

    return candidates;
  }

  buildInterceptJobs(systems) {
    const { enemies, terrain } = systems;
    if (!enemies || !terrain) {
      return [];
    }

    const limit = this.getQueueLimit("intercept");
    const origin = terrain.colonyOrigin ?? { x: 48, y: 20 };

    return enemies
      .getAliveEnemies()
      .map((enemy) => {
        const dx = enemy.x - origin.x;
        const dy = enemy.y - origin.y;
        const colonyDistance = Math.sqrt(dx * dx + dy * dy);
        const approachPressure = Math.max(0, 24 - colonyDistance) * 0.33;
        const priority =
          Number(enemy.attackDamage ?? 1) +
          Number(enemy.hp ?? 1) * 0.06 +
          approachPressure +
          (enemy.state === "Raid" ? 1.5 : 0);

        return {
          id: `intercept:${enemy.id}`,
          type: "intercept",
          x: enemy.x,
          y: enemy.y,
          priority,
          claimedBy: "",
          claimExpiresAt: 0
        };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  buildFrontierJobs(systems) {
    const { fog, terrain } = systems;
    if (!fog || !terrain) {
      return [];
    }

    const limit = this.getQueueLimit("frontier");
    const origin = terrain.colonyOrigin ?? { x: 48, y: 20 };
    const jobs = [];
    const stride = 2;

    const neighborOffsets = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    for (let y = 0; y < terrain.height; y += stride) {
      for (let x = 0; x < terrain.width; x += stride) {
        if (!terrain.isPassable(x, y) || fog.isDiscovered(x, y)) {
          continue;
        }

        let adjacentDiscovered = false;
        for (const offset of neighborOffsets) {
          const nx = x + offset.x;
          const ny = y + offset.y;
          if (!terrain.inBounds(nx, ny)) {
            continue;
          }
          if (fog.isDiscovered(nx, ny)) {
            adjacentDiscovered = true;
            break;
          }
        }

        if (!adjacentDiscovered) {
          continue;
        }

        const dx = x - origin.x;
        const dy = y - origin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const priority = 7.5 - dist * 0.08;

        jobs.push({
          id: `frontier:${x},${y}`,
          type: "frontier",
          x: x + 0.5,
          y: y + 0.5,
          priority,
          claimedBy: "",
          claimExpiresAt: 0
        });
      }
    }

    jobs.sort((a, b) => b.priority - a.priority);
    return jobs.slice(0, limit);
  }

  mergeWithExistingClaims(newJobs, existingQueue) {
    const claimMap = new Map();
    for (const existingJob of existingQueue) {
      claimMap.set(existingJob.id, {
        claimedBy: existingJob.claimedBy,
        claimExpiresAt: existingJob.claimExpiresAt
      });
    }

    for (const job of newJobs) {
      const claim = claimMap.get(job.id);
      if (!claim) {
        continue;
      }
      job.claimedBy = claim.claimedBy;
      job.claimExpiresAt = claim.claimExpiresAt;
    }

    return newJobs;
  }

  refreshJobQueues(systems) {
    const nextHaul = this.buildHaulJobs(systems);
    const nextIntercept = this.buildInterceptJobs(systems);
    const nextFrontier = this.buildFrontierJobs(systems);

    this.jobQueues.haul = this.mergeWithExistingClaims(nextHaul, this.jobQueues.haul);
    this.jobQueues.intercept = this.mergeWithExistingClaims(
      nextIntercept,
      this.jobQueues.intercept
    );
    this.jobQueues.frontier = this.mergeWithExistingClaims(nextFrontier, this.jobQueues.frontier);
    this.releaseExpiredClaims();
  }

  assignState(ant, state, target = null) {
    ant.setState(state, this.engine.time, target);
  }

  getThreatNearby(ant, enemies) {
    const huntBonus = ant.role.includes("soldier")
      ? Math.max(0, Number(this.getSetting("ai.soldierHuntRangeBonus", 4.5)))
      : 0;
    return enemies.findNearestEnemy(ant, ant.stats.visionRadius + 1.5 + huntBonus);
  }

  getSharedInterceptTarget() {
    if (!this.isJobQueuesEnabled() || this.jobQueues.intercept.length === 0) {
      return null;
    }

    const primary = this.jobQueues.intercept[0];
    if (!primary) {
      return null;
    }

    return {
      x: primary.x,
      y: primary.y,
      priority: Number(primary.priority ?? 0)
    };
  }

  getCombatFormationTarget(ant, baseTarget) {
    const ringRadius = Math.max(0.25, Number(this.getSetting("ai.combatPackRadiusOffset", 0.75)));
    const slotCount = Math.max(4, Math.floor(Number(this.getSetting("ai.combatPackSlots", 8))));
    const slot = stableHash(String(ant.id ?? "ant")) % slotCount;
    const angle = (slot / slotCount) * Math.PI * 2;

    return {
      x: baseTarget.x + Math.cos(angle) * ringRadius,
      y: baseTarget.y + Math.sin(angle) * ringRadius
    };
  }

  handleWorkerFamily(ant, systems) {
    const { terrain, ecology, rooms, pheromones, resources } = systems;

    const dangerSignal = this.getDangerSignal(ant, pheromones);
    if (dangerSignal) {
      this.assignState(ant, "Flee", this.computeFleeTarget(ant, dangerSignal, terrain));
      return;
    }

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
      const digOrder = terrain.findDigOrderNear(Math.floor(ant.x), Math.floor(ant.y), 22);
      if (digOrder) {
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

    if (this.isJobQueuesEnabled()) {
      const haulJob = this.claimBestJob("haul", ant, (job) => Number(job.priority ?? 0) > -8);
      if (haulJob) {
        this.assignState(ant, "Forage", { x: haulJob.x, y: haulJob.y });
        return;
      }
    }

    const foodTrail = pheromones.getBestNeighbor(
      "FoodTrail",
      { x: Math.floor(ant.x), y: Math.floor(ant.y) },
      2
    );
    const foodNeed = this.getFoodNeed(resources);
    const foodTrailThreshold = ant.stats.pheromoneSensitivity * (0.6 - foodNeed * 0.25);
    if (foodTrail && foodTrail.value > foodTrailThreshold) {
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
    const { rooms, ants, terrain, pheromones } = systems;

    const dangerSignal = this.getDangerSignal(ant, pheromones);
    if (dangerSignal && !ant.role.includes("medic")) {
      this.assignState(ant, "Flee", this.computeFleeTarget(ant, dangerSignal, terrain));
      return;
    }

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
      if (this.isJobQueuesEnabled()) {
        const frontierJob = this.claimBestJob(
          "frontier",
          ant,
          (job) => Number(job.priority ?? 0) > -12
        );
        if (frontierJob) {
          const mode = Math.random() > 0.26 ? "Explore" : "LayPheromone";
          this.assignState(ant, mode, { x: frontierJob.x, y: frontierJob.y });
          return;
        }
      }

      const mode = Math.random() > 0.35 ? "Explore" : "LayPheromone";
      this.assignState(ant, mode, this.findScoutTarget(systems));
      return;
    }

    this.assignState(ant, "Patrol", randomTileTarget(terrain));
  }

  handleCombatFamily(ant, systems, threat) {
    const { rooms, terrain, pheromones } = systems;

    const sharedIntercept = this.getSharedInterceptTarget();
    const focusTarget = threat
      ? { x: threat.x, y: threat.y }
      : sharedIntercept
        ? { x: sharedIntercept.x, y: sharedIntercept.y }
        : null;

    if (focusTarget) {
      const formationTarget = this.getCombatFormationTarget(ant, focusTarget);
      pheromones?.lay("Rally", Math.floor(focusTarget.x), Math.floor(focusTarget.y), 1.1);
      if (threat) {
        pheromones?.lay("Danger", Math.floor(threat.x), Math.floor(threat.y), 1.3);
      }

      const nextState = ant.role.includes("guardian") ? "RespondToThreat" : "Fight";
      this.assignState(ant, nextState, formationTarget);
      return;
    }

    if (threat) {
      pheromones?.lay("Danger", Math.floor(threat.x), Math.floor(threat.y), 1.3);
      const nextState = ant.role.includes("guardian") ? "RespondToThreat" : "Fight";
      this.assignState(ant, nextState, { x: threat.x, y: threat.y });
      return;
    }

    if (this.isJobQueuesEnabled()) {
      const interceptJob = this.claimBestJob(
        "intercept",
        ant,
        (job) => Number(job.priority ?? 0) > -20
      );
      if (interceptJob) {
        const nextState = ant.role.includes("guardian") ? "RespondToThreat" : "Fight";
        this.assignState(ant, nextState, { x: interceptJob.x, y: interceptJob.y });
        return;
      }
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
    const interval = this.getDecisionInterval();
    if (this.decisionClock < interval) {
      if (this.isJobQueuesEnabled()) {
        this.queueRefreshClock += _dt;
      }
      return;
    }

    this.decisionClock = 0;

    const systems = {
      ants: this.engine.getSystem("ants"),
      enemies: this.engine.getSystem("enemies"),
      terrain: this.engine.getSystem("terrain"),
      ecology: this.engine.getSystem("surface"),
      rooms: this.engine.getSystem("rooms"),
      pheromones: this.engine.getSystem("pheromones"),
      resources: this.engine.getSystem("resources"),
      fog: this.engine.getSystem("fog")
    };

    const ants = systems.ants.getAliveAnts();
    if (ants.length === 0) {
      this.clearJobQueues();
      return;
    }

    if (this.isJobQueuesEnabled()) {
      this.queueRefreshClock += _dt;
      if (this.queueRefreshClock >= this.getQueueRefreshSeconds()) {
        this.queueRefreshClock = 0;
        this.refreshJobQueues(systems);
      } else {
        this.releaseExpiredClaims();
      }
    } else if (
      this.jobQueues.haul.length > 0 ||
      this.jobQueues.intercept.length > 0 ||
      this.jobQueues.frontier.length > 0
    ) {
      this.clearJobQueues();
    }

    const decisionsPerTick = Math.min(ants.length, this.getMaxDecisionsPerTick());
    for (let i = 0; i < decisionsPerTick; i += 1) {
      const index = (this.nextDecisionIndex + i) % ants.length;
      const ant = ants[index];
      const threat = this.getThreatNearby(ant, systems.enemies);
      const healthRatio = ant.hp / Math.max(1, ant.stats.health);

      if (this.shouldHoldState(ant, threat)) {
        continue;
      }

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

    this.nextDecisionIndex = (this.nextDecisionIndex + decisionsPerTick) % ants.length;
  }

  serialize() {
    return {
      decisionClock: this.decisionClock,
      decisionInterval: this.decisionInterval,
      nextDecisionIndex: this.nextDecisionIndex,
      queueRefreshClock: this.queueRefreshClock
    };
  }

  deserialize(state) {
    this.decisionClock = Number(state.decisionClock ?? 0);
    this.decisionInterval = Number(state.decisionInterval ?? this.decisionInterval);
    this.nextDecisionIndex = Number(state.nextDecisionIndex ?? this.nextDecisionIndex);
    this.queueRefreshClock = Number(state.queueRefreshClock ?? 0);
    this.clearJobQueues();
  }

  reset() {
    this.decisionClock = 0;
    this.nextDecisionIndex = 0;
    this.queueRefreshClock = 0;
    this.clearJobQueues();
  }
}
