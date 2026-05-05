import {
    ENEMY_TYPE,
    EVENT_CONFIG,
    MAP_WIDTH,
    SURFACE_ROWS,
    TILE_SIZE,
    clamp
} from "../core/constants.js";

export class ColonyEventManager {
  constructor(scene) {
    this.scene = scene;
    this.timeToNext = 0;
    this.scheduleNext();
  }

  scheduleNext() {
    this.timeToNext = Phaser.Math.FloatBetween(
      EVENT_CONFIG.minIntervalSec,
      EVENT_CONFIG.maxIntervalSec
    );
  }

  update(dt) {
    if (!this.scene.settings.get("dynamicEvents")) return;
    this.timeToNext -= dt;
    if (this.timeToNext > 0) return;

    this.triggerRandomEvent();
    this.scheduleNext();
  }

  triggerRandomEvent() {
    const roll = Math.random();

    if (roll < 0.3) {
      this.foodBloom();
      return;
    }
    if (roll < 0.55) {
      this.moraleSurge();
      return;
    }
    if (roll < 0.78) {
      this.predatorAmbush();
      return;
    }
    this.scoutIntel();
  }

  foodBloom() {
    for (let i = 0; i < EVENT_CONFIG.foodBloomSources; i++) {
      this.scene.spawnFoodSource();
    }
    this.scene.resources.addMorale(2);
    this.scene.announce("Event: Surface food bloom (+food sources)");
  }

  moraleSurge() {
    this.scene.resources.addMorale(EVENT_CONFIG.moraleBoost);
    this.scene.announce("Event: Colony morale surge");
  }

  predatorAmbush() {
    for (let i = 0; i < EVENT_CONFIG.ambushEnemyCount; i++) {
      this.scene.enemyManager.spawnEnemy(
        ENEMY_TYPE.SPIDER,
        Phaser.Math.Between(2, MAP_WIDTH - 3),
        Phaser.Math.Between(1, 3)
      );
    }
    this.scene.resources.addMorale(-3);
    this.scene.announce("Event: Predator ambush!");
  }

  scoutIntel() {
    const centerTx = Phaser.Math.Between(6, MAP_WIDTH - 7);
    const centerTy = Phaser.Math.Between(1, SURFACE_ROWS + 3);
    const radius = 4;

    for (let y = centerTy - radius; y <= centerTy + radius; y++) {
      for (let x = centerTx - radius; x <= centerTx + radius; x++) {
        if (!this.scene.inBounds(x, y)) continue;
        const d = Phaser.Math.Distance.Between(x, y, centerTx, centerTy);
        if (d <= radius) {
          this.scene.discovered[y][x] = true;
          this.scene.vision[y][x] = 1;
        }
      }
    }

    this.scene.spawnFoodSource();
    const moraleBoost = clamp(EVENT_CONFIG.moraleBoost * 0.35, 1, 6);
    this.scene.resources.addMorale(moraleBoost);
    this.scene.spawnFoodParticles(centerTx * TILE_SIZE + 12, centerTy * TILE_SIZE + 12);
    this.scene.announce("Event: Scout intel discovered a fresh route");
  }
}
