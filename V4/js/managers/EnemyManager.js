import { DIFFICULTY_SETTINGS, ENEMY_TYPE, MAP_WIDTH } from "../core/constants.js";
import { EnemyUnit } from "../entities/EnemyUnit.js";

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.wave = 0;
    this.waveTimer = 0;
  }

  update(dt) {
    this.enemies = this.enemies.filter((e) => !e.dead);
    for (const enemy of this.enemies) enemy.update(dt);

    this.waveTimer += dt;
    const diff = DIFFICULTY_SETTINGS[this.scene.settings.get("difficulty")];
    const nextWaveIn = Math.max(8, diff.enemyInterval - this.wave * 0.8);

    if (this.waveTimer >= nextWaveIn) {
      this.waveTimer = 0;
      this.spawnWave();
    }
  }

  spawnEnemy(type, tx, ty) {
    const e = new EnemyUnit(this.scene, tx, ty, type);
    this.enemies.push(e);
  }

  spawnWave() {
    this.wave += 1;
    const diff = DIFFICULTY_SETTINGS[this.scene.settings.get("difficulty")];
    const scale = diff.waveScale;
    const spiders = Math.ceil((1 + this.wave * 0.6) * scale);
    const beetles = this.wave >= 2 ? Math.ceil(this.wave * 0.35 * scale) : 0;

    for (let i = 0; i < spiders; i++) {
      const tx = Phaser.Math.Between(2, MAP_WIDTH - 3);
      const ty = Phaser.Math.Between(1, 3);
      this.spawnEnemy(ENEMY_TYPE.SPIDER, tx, ty);
    }

    for (let i = 0; i < beetles; i++) {
      const tx = Phaser.Math.Between(2, MAP_WIDTH - 3);
      const ty = Phaser.Math.Between(1, 3);
      this.spawnEnemy(ENEMY_TYPE.BEETLE, tx, ty);
    }

    if (this.scene.resources.unlocks.bossWaveReady && this.wave === 8) {
      this.spawnEnemy(ENEMY_TYPE.BEETLE, Phaser.Math.Between(4, MAP_WIDTH - 4), 1);
      this.spawnEnemy(ENEMY_TYPE.BEETLE, Phaser.Math.Between(4, MAP_WIDTH - 4), 2);
      this.scene.announce("Boss wave incoming!");
    } else {
      this.scene.announce(`Enemy wave ${this.wave} approaching`);
    }
  }

  findNearestEnemy(x, y, maxDist = 9999) {
    let best = null;
    let bestD = maxDist;
    for (const enemy of this.enemies) {
      const d = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (d < bestD) {
        best = enemy;
        bestD = d;
      }
    }
    return best;
  }

  onEnemyKilled() {
    this.scene.resources.addMorale(1.2);
  }
}
