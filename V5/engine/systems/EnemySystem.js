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
  }

  init() {
    this.enemyTypeMap.clear();
    this.enemies = [];
    this.spawnClock = 0;
    this.wave = 0;

    for (const enemyType of this.config.enemyTypes ?? []) {
      this.enemyTypeMap.set(enemyType.id, enemyType);
    }

    this.spawnEnemy("spider");
    this.spawnEnemy("beetle");
  }

  getSpawnPoint() {
    const terrain = this.engine.getSystem("terrain");
    const x = Math.floor(Math.random() * terrain.width);
    const y = Math.floor(Math.random() * Math.max(1, terrain.surfaceBandHeight));
    return { x: x + 0.5, y: y + 0.5 };
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

    const enemy = new EnemyEntity(typeDef, position ?? this.getSpawnPoint());
    this.enemies.push(enemy);
    this.engine.events.emit("enemies:spawned", enemy);
    return enemy;
  }

  getAliveEnemies() {
    return this.enemies.filter((enemy) => enemy.alive);
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
    const weather = this.engine.getSystem("weather");
    const difficulty = this.engine.getSystem("difficulty");

    const speedModifier = Number(weather?.getModifier("enemySpeedMultiplier", 1) ?? 1);
    const powerModifier = Number(difficulty?.getMultiplier("enemyPowerMultiplier", 1) ?? 1);

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

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

    enemy.updateMovement(dt, speedModifier);

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

    for (const enemy of this.getAliveEnemies()) {
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
  }

  serialize() {
    return {
      enemies: this.enemies.map((enemy) => enemy.serialize()),
      spawnClock: this.spawnClock,
      wave: this.wave
    };
  }

  deserialize(state) {
    this.spawnClock = Number(state.spawnClock ?? 0);
    this.wave = Number(state.wave ?? 0);
    this.enemies = (state.enemies ?? [])
      .map((serialized) => {
        const typeDef = this.enemyTypeMap.get(serialized.typeId);
        if (!typeDef) {
          return null;
        }
        return EnemyEntity.deserialize(serialized, typeDef);
      })
      .filter(Boolean);
  }

  reset() {
    this.init();
  }
}
