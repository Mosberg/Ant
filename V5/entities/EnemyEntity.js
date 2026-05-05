import { clamp, distance, uuid } from "../engine/utils.js";

export class EnemyEntity {
  constructor(typeDef, position) {
    this.id = uuid("enemy");
    this.typeId = typeDef.id;
    this.name = typeDef.name;
    this.behavior = typeDef.behavior;
    this.hp = typeDef.stats.health;
    this.maxHp = typeDef.stats.health;
    this.speed = typeDef.stats.speed;
    this.attackDamage = typeDef.stats.attackDamage;
    this.attackRate = typeDef.stats.attackRate;
    this.armor = typeDef.stats.armor;
    this.visionRadius = typeDef.stats.visionRadius;
    this.x = position.x;
    this.y = position.y;
    this.target = { x: position.x, y: position.y };
    this.state = "Patrol";
    this.attackCooldown = 0;
    this.alive = true;
  }

  setState(state, target = null) {
    this.state = state;
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

    const step = this.speed * speedMultiplier * dt;
    if (step >= dist) {
      this.x = this.target.x;
      this.y = this.target.y;
      return true;
    }

    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    return false;
  }

  applyDamage(rawDamage) {
    const dealt = Math.max(0.2, rawDamage - this.armor * 0.4);
    this.hp = clamp(this.hp - dealt, 0, this.maxHp);
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  distanceTo(point) {
    return distance(this, point);
  }

  serialize() {
    return {
      id: this.id,
      typeId: this.typeId,
      name: this.name,
      behavior: this.behavior,
      hp: this.hp,
      maxHp: this.maxHp,
      speed: this.speed,
      attackDamage: this.attackDamage,
      attackRate: this.attackRate,
      armor: this.armor,
      visionRadius: this.visionRadius,
      x: this.x,
      y: this.y,
      target: this.target,
      state: this.state,
      attackCooldown: this.attackCooldown,
      alive: this.alive
    };
  }

  static deserialize(serialized, typeDef) {
    const enemy = new EnemyEntity(typeDef, { x: serialized.x, y: serialized.y });
    enemy.id = serialized.id;
    enemy.hp = serialized.hp;
    enemy.maxHp = serialized.maxHp;
    enemy.speed = serialized.speed;
    enemy.attackDamage = serialized.attackDamage;
    enemy.attackRate = serialized.attackRate;
    enemy.armor = serialized.armor;
    enemy.visionRadius = serialized.visionRadius;
    enemy.target = { ...serialized.target };
    enemy.state = serialized.state;
    enemy.attackCooldown = serialized.attackCooldown;
    enemy.alive = serialized.alive;
    return enemy;
  }
}
