import { ENEMY_TYPE, MAP_HEIGHT, MAP_WIDTH, ROOM_KIND, TILE_SIZE } from "../core/constants.js";

export class EnemyUnit {
  constructor(scene, tx, ty, type = ENEMY_TYPE.SPIDER) {
    this.scene = scene;
    this.type = type;
    this.tx = tx;
    this.ty = ty;
    this.x = tx * TILE_SIZE + TILE_SIZE / 2;
    this.y = ty * TILE_SIZE + TILE_SIZE / 2;
    this.speed = type === ENEMY_TYPE.SPIDER ? 40 : 28;
    this.health = type === ENEMY_TYPE.SPIDER ? 110 : 170;
    this.maxHealth = this.health;
    this.damage = type === ENEMY_TYPE.SPIDER ? 14 : 9;
    this.attackCooldown = 0;
    this.path = [];
    this.pathIndex = 0;

    const color = type === ENEMY_TYPE.SPIDER ? 0x1e1b1b : 0x5b4635;
    const radius = type === ENEMY_TYPE.SPIDER ? 11 : 13;
    this.sprite = scene.add.circle(this.x, this.y, radius, color, 1).setDepth(35);
    this.sprite.setStrokeStyle(2, type === ENEMY_TYPE.SPIDER ? 0xcd5674 : 0xc7a36d, 1);
    this.healthBarBg = scene.add.rectangle(this.x, this.y - 14, 20, 4, 0x000000, 0.7).setDepth(36);
    this.healthBar = scene.add
      .rectangle(this.x - 10, this.y - 14, 20, 4, 0xde5a5a, 1)
      .setOrigin(0, 0.5)
      .setDepth(37);
  }

  getTilePos() {
    return {
      tx: Phaser.Math.Clamp(Math.floor(this.x / TILE_SIZE), 0, MAP_WIDTH - 1),
      ty: Phaser.Math.Clamp(Math.floor(this.y / TILE_SIZE), 0, MAP_HEIGHT - 1)
    };
  }

  update(dt) {
    if (this.health <= 0) {
      this.destroy();
      return;
    }

    this.attackCooldown -= dt;

    const ant = this.scene.antManager.findNearestAnt(this.x, this.y, 42);
    if (ant && this.attackCooldown <= 0) {
      ant.takeDamage(this.damage);
      this.scene.audio.hit();
      this.scene.spawnCombatParticles(this.x, this.y);
      this.attackCooldown = 0.9;
      return;
    }

    if (this.type === ENEMY_TYPE.BEETLE) {
      const room = this.scene.findNearestRoomTarget(this.x, this.y);
      if (room) {
        const center = room.center();
        this.moveTowardTile(center.tx, center.ty, dt);
        const roomCenter = {
          x: center.tx * TILE_SIZE + TILE_SIZE / 2,
          y: center.ty * TILE_SIZE + TILE_SIZE / 2
        };
        if (
          Phaser.Math.Distance.Between(this.x, this.y, roomCenter.x, roomCenter.y) < 16 &&
          this.attackCooldown <= 0
        ) {
          room.health -= this.damage;
          this.attackCooldown = 1.2;
          this.scene.spawnCombatParticles(this.x, this.y);
          if (room.health <= 0 && room.type === ROOM_KIND.QUEEN) {
            this.scene.triggerLose("The queen chamber was destroyed.");
          }
        }
      }
    } else {
      const queen = this.scene.roomManager.getQueenRoom();
      const center = queen.center();
      this.moveTowardTile(center.tx, center.ty, dt);
    }

    this.sprite.setPosition(this.x, this.y);
    this.healthBarBg.setPosition(this.x, this.y - 14);
    this.healthBar.setPosition(this.x - 10, this.y - 14);
    this.healthBar.width = 20 * (this.health / this.maxHealth);
  }

  moveTowardTile(tx, ty, dt) {
    const from = this.getTilePos();
    if (this.path.length === 0 || this.scene.time.now % 30 < 1) {
      this.path = this.scene.pathfinder.findPath(from.tx, from.ty, tx, ty);
      this.pathIndex = 0;
    }
    if (this.path.length <= 1 || this.pathIndex >= this.path.length) return;

    const node = this.path[this.pathIndex];
    const targetX = node.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = node.y * TILE_SIZE + TILE_SIZE / 2;
    const ang = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const move = this.speed * this.scene.getGameSpeed() * dt;
    this.x += Math.cos(ang) * move;
    this.y += Math.sin(ang) * move;

    if (Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY) < 5) {
      this.pathIndex++;
    }
  }

  takeDamage(amount) {
    this.health -= amount;
  }

  destroy() {
    this.sprite.destroy();
    this.healthBar.destroy();
    this.healthBarBg.destroy();
    this.dead = true;
    this.scene.enemyManager.onEnemyKilled(this);
  }
}
