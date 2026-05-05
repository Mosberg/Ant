import { clamp, distance, randomChoice, uuid } from "../engine/utils.js";

export class AntEntity {
  constructor(typeDef, position, traitsPool = []) {
    this.id = uuid("ant");
    this.typeId = typeDef.id;
    this.name = typeDef.name;
    this.role = typeDef.role;
    this.stats = {
      health: typeDef.stats.health,
      speed: typeDef.stats.speed,
      carryCapacity: typeDef.stats.carryCapacity,
      visionRadius: typeDef.stats.visionRadius,
      attackDamage: typeDef.stats.attackDamage,
      attackSpeed: typeDef.stats.attackSpeed,
      armor: typeDef.stats.armor,
      moraleContribution: typeDef.stats.moraleContribution,
      pheromoneSensitivity: typeDef.stats.pheromoneSensitivity
    };
    this.hp = this.stats.health;
    this.x = position.x;
    this.y = position.y;
    this.target = { x: position.x, y: position.y };
    this.state = "Idle";
    this.level = 1;
    this.xp = 0;
    this.inventory = { food: 0, biomass: 0 };
    this.abilities = [...(typeDef.abilities ?? [])];
    this.traits = [];
    this.lastStateChange = 0;
    this.attackCooldown = 0;
    this.taskCooldown = 0;
    this.alive = true;

    const startingTrait = randomChoice(traitsPool, null);
    if (startingTrait) {
      this.traits.push(startingTrait);
      this.applyTrait(startingTrait);
    }
  }

  applyTrait(trait) {
    if (!trait || typeof trait !== "object") {
      return;
    }

    const modifiers = trait.modifiers ?? {};
    for (const [key, modifier] of Object.entries(modifiers)) {
      if (key in this.stats && typeof modifier === "number") {
        this.stats[key] = Math.max(0.1, this.stats[key] * modifier);
      }
    }

    if (trait.newAbility) {
      this.abilities.push(trait.newAbility);
    }

    this.hp = Math.min(this.hp, this.stats.health);
  }

  setState(nextState, nowSeconds, target = null) {
    if (this.state !== nextState) {
      this.state = nextState;
      this.lastStateChange = nowSeconds;
    }
    if (target) {
      this.target = { x: target.x, y: target.y };
    }
  }

  updateMovement(dt, speedMultiplier = 1) {
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.01) {
      return true;
    }

    const step = this.stats.speed * speedMultiplier * dt;
    if (step >= dist) {
      this.x = this.target.x;
      this.y = this.target.y;
      return true;
    }

    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    return false;
  }

  gainXp(amount, leveling, traitsPool) {
    if (!this.alive) {
      return;
    }

    this.xp += amount;
    const base = Number(leveling?.xpPerLevelBase ?? 25);
    const curve = Number(leveling?.xpCurve ?? 1.2);
    const maxLevel = Number(leveling?.maxLevel ?? 20);
    const traitEvery = Number(leveling?.randomTraitEvery ?? 3);

    while (this.level < maxLevel) {
      const threshold = Math.floor(base * Math.pow(curve, this.level - 1));
      if (this.xp < threshold) {
        break;
      }

      this.xp -= threshold;
      this.level += 1;
      this.levelUp(leveling);

      if (traitEvery > 0 && this.level % traitEvery === 0) {
        const trait = randomChoice(traitsPool, null);
        if (trait) {
          this.traits.push(trait);
          this.applyTrait(trait);
        }
      }
    }
  }

  levelUp(leveling) {
    const gains = leveling?.statGains ?? {};
    this.stats.health += Number(gains.health ?? 3);
    this.stats.speed += Number(gains.speed ?? 0.03);
    this.stats.attackDamage += Number(gains.attackDamage ?? 0.3);
    this.stats.armor += Number(gains.armor ?? 0.1);
    this.stats.visionRadius += Number(gains.visionRadius ?? 0.05);
    this.hp = this.stats.health;
  }

  applyDamage(rawDamage) {
    if (!this.alive) {
      return false;
    }

    const mitigated = Math.max(0.2, rawDamage - this.stats.armor * 0.35);
    this.hp = clamp(this.hp - mitigated, 0, this.stats.health);
    if (this.hp <= 0) {
      this.alive = false;
      this.state = "Dead";
      return true;
    }
    return false;
  }

  heal(amount) {
    if (!this.alive) {
      return;
    }
    this.hp = clamp(this.hp + amount, 0, this.stats.health);
  }

  distanceTo(point) {
    return distance(this, point);
  }

  isAlive() {
    return this.alive;
  }

  serialize() {
    return {
      id: this.id,
      typeId: this.typeId,
      name: this.name,
      role: this.role,
      stats: this.stats,
      hp: this.hp,
      x: this.x,
      y: this.y,
      target: this.target,
      state: this.state,
      level: this.level,
      xp: this.xp,
      inventory: this.inventory,
      abilities: this.abilities,
      traits: this.traits,
      lastStateChange: this.lastStateChange,
      attackCooldown: this.attackCooldown,
      taskCooldown: this.taskCooldown,
      alive: this.alive
    };
  }

  static deserialize(serialized, typeDef, traitsPool = []) {
    const ant = new AntEntity(typeDef, { x: serialized.x, y: serialized.y }, traitsPool);
    ant.id = serialized.id;
    ant.name = serialized.name;
    ant.role = serialized.role;
    ant.stats = { ...serialized.stats };
    ant.hp = serialized.hp;
    ant.target = { ...serialized.target };
    ant.state = serialized.state;
    ant.level = serialized.level;
    ant.xp = serialized.xp;
    ant.inventory = { ...serialized.inventory };
    ant.abilities = [...serialized.abilities];
    ant.traits = [...serialized.traits];
    ant.lastStateChange = serialized.lastStateChange;
    ant.attackCooldown = serialized.attackCooldown;
    ant.taskCooldown = serialized.taskCooldown;
    ant.alive = serialized.alive;
    return ant;
  }
}
