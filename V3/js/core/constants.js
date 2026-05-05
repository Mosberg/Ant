/* Ant Colony Manager
   ------------------------------------------------------------
   A complete browser-ready Phaser colony management prototype.

   Architecture:
   - BootScene: game boot and settings initialization
   - PreloadScene: generate placeholder graphics/audio helpers
   - MainMenuScene: title, options, help
   - GameScene: world, ants, rooms, resources, enemies
   - UIScene: HUD, controls, overlays
   - PauseScene: pause menu overlay

   Key extension points:
   - ANT_TYPES: add new ant roles here
   - ROOM_TYPES: add new room types/upgrades here
   - DIFFICULTY_SETTINGS: tweak pacing and challenge here
   - WaveManager.spawnWave(): add new enemy wave compositions here

   Note:
   - Uses procedural graphics and simple WebAudio tones so no external assets are needed.
   - This is intentionally modular and heavily commented for extension.
*/

const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;

const TILE_SIZE = 24;
const MAP_WIDTH = 80;
const MAP_HEIGHT = 45;
const SURFACE_ROWS = 8;
const UNDERGROUND_START = SURFACE_ROWS;

const TILE = {
  SURFACE: 0,
  DIRT: 1,
  TUNNEL: 2,
  ROCK: 3,
  ROOM: 4,
  ENTRANCE: 5
};

const ROOM_KIND = {
  QUEEN: "queen",
  BROOD: "brood",
  STORAGE: "storage",
  BARRACKS: "barracks",
  UTILITY: "utility"
};

const ROLE = {
  WORKER: "worker",
  SOLDIER: "soldier",
  NURSE: "nurse",
  SCOUT: "scout"
};

const ENEMY_TYPE = {
  SPIDER: "spider",
  BEETLE: "beetle"
};

const ANT_TYPES = {
  worker: {
    label: "Worker",
    color: 0x3b2f2f,
    health: 40,
    speed: 62,
    carry: 12,
    damage: 4,
    vision: 90
  },
  soldier: {
    label: "Soldier",
    color: 0x8d2f2f,
    health: 90,
    speed: 52,
    carry: 2,
    damage: 14,
    vision: 100
  },
  nurse: {
    label: "Nurse",
    color: 0x8058a5,
    health: 50,
    speed: 56,
    carry: 6,
    damage: 3,
    vision: 90
  },
  scout: {
    label: "Scout",
    color: 0x2c6f7a,
    health: 38,
    speed: 78,
    carry: 6,
    damage: 5,
    vision: 140
  }
};

/* How to add a new room type:
   1. Add a new key below.
   2. Give it cost, size, and upgrade levels.
   3. Update RoomManager.applyRoomBonuses() if it affects colony stats.
   4. Add a UI button in UIScene.createBuildButtons().
*/
const ROOM_TYPES = {
  brood: {
    label: "Brood",
    color: 0xd6c18a,
    cost: 35,
    maxLevel: 2,
    size: { w: 3, h: 2 },
    levels: {
      1: { popBonus: 6, hatchRate: 1.0 },
      2: { popBonus: 10, hatchRate: 1.6 }
    }
  },
  storage: {
    label: "Storage",
    color: 0x8f6a3b,
    cost: 30,
    maxLevel: 2,
    size: { w: 3, h: 2 },
    levels: {
      1: { foodCap: 120 },
      2: { foodCap: 220 }
    }
  },
  barracks: {
    label: "Barracks",
    color: 0xa04747,
    cost: 45,
    maxLevel: 2,
    size: { w: 3, h: 2 },
    levels: {
      1: { soldierPower: 1.1, soldierCap: 6 },
      2: { soldierPower: 1.25, soldierCap: 12 }
    }
  },
  utility: {
    label: "Utility",
    color: 0x5a7d44,
    cost: 50,
    maxLevel: 2,
    size: { w: 3, h: 2 },
    levels: {
      1: { moraleBonus: 6, unlockUtility: true },
      2: { moraleBonus: 12, techBoost: true }
    }
  }
};

/* Difficulty tuning lives here.
   To tweak progression:
   - enemyInterval lowers as difficulty rises
   - foodSpawnRate and moraleDrain shape economy pressure
*/
const DIFFICULTY_SETTINGS = {
  easy: {
    label: "Easy",
    enemyInterval: 32,
    foodSpawnRate: 1.3,
    startingFood: 110,
    moraleDrain: 0.2,
    waveScale: 0.9
  },
  normal: {
    label: "Normal",
    enemyInterval: 24,
    foodSpawnRate: 1.0,
    startingFood: 90,
    moraleDrain: 0.35,
    waveScale: 1.0
  },
  hard: {
    label: "Hard",
    enemyInterval: 18,
    foodSpawnRate: 0.85,
    startingFood: 72,
    moraleDrain: 0.55,
    waveScale: 1.2
  }
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distance(a, b) {
  return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
}
