import { DIFFICULTY_SETTINGS, clamp } from "../core/constants.js";

export class ResourceManager {
  constructor(scene, difficultyKey) {
    const diff = DIFFICULTY_SETTINGS[difficultyKey];
    this.scene = scene;
    this.food = diff.startingFood;
    this.foodCap = 160;
    this.population = 5;
    this.populationCap = 12;
    this.morale = 100;
    this.totalFoodGathered = 0;
    this.timeSurvived = 0;
    this.unlocks = {
      utility: false,
      advancedRoles: true,
      bossWaveReady: false
    };
  }

  addFood(amount) {
    const before = this.food;
    this.food = clamp(this.food + amount, 0, this.foodCap);
    this.totalFoodGathered += Math.max(0, this.food - before);
  }

  spendFood(amount) {
    if (this.food < amount) return false;
    this.food -= amount;
    return true;
  }

  addMorale(v) {
    this.morale = clamp(this.morale + v, 0, 100);
  }

  update(dt) {
    this.timeSurvived += dt;
    const difficulty = this.scene.settings.get("difficulty");
    const diff = DIFFICULTY_SETTINGS[difficulty];
    const moraleBonus = this.scene.colonyModifiers?.moraleBonus || 0;
    const bonusReduction = moraleBonus * 0.0008;
    this.morale = clamp(
      this.morale - Math.max(0.05, diff.moraleDrain * 0.16 - bonusReduction) * dt,
      0,
      100
    );

    if (this.totalFoodGathered >= 150) this.unlocks.utility = true;
    if (this.timeSurvived >= 180) this.unlocks.bossWaveReady = true;
  }
}
