/* Ant Colony Manager V4
   Core constants and tunable configs used by the modular ES module build.
*/

export const GAME_VERSION = "4.0.0";

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export const TILE_SIZE = 24;
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 45;
export const SURFACE_ROWS = 8;
export const UNDERGROUND_START = SURFACE_ROWS;

export const TILE = {
  SURFACE: 0,
  DIRT: 1,
  TUNNEL: 2,
  ROCK: 3,
  ROOM: 4,
  ENTRANCE: 5
};

export const ROOM_KIND = {
  QUEEN: "queen",
  BROOD: "brood",
  STORAGE: "storage",
  BARRACKS: "barracks",
  UTILITY: "utility"
};

export const TOOL_MODE = {
  SELECT: "select",
  DIG: "dig",
  BUILD: "build"
};

export const ROLE = {
  WORKER: "worker",
  SOLDIER: "soldier",
  NURSE: "nurse",
  SCOUT: "scout"
};

export const ENEMY_TYPE = {
  SPIDER: "spider",
  BEETLE: "beetle"
};

export const GAME_SPEED_STEPS = [0.5, 1, 1.5, 2, 3];

export const ANT_TYPES = {
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
    health: 9000,
    speed: 52,
    carry: 2,
    damage: 1400,
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

export const ROOM_TYPES = {
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

export const DIFFICULTY_SETTINGS = {
  easy: {
    label: "Easy",
    enemyInterval: 34,
    foodSpawnRate: 1.35,
    startingFood: 120,
    moraleDrain: 0.18,
    waveScale: 0.85
  },
  normal: {
    label: "Normal",
    enemyInterval: 24,
    foodSpawnRate: 1.0,
    startingFood: 95,
    moraleDrain: 0.34,
    waveScale: 1.0
  },
  hard: {
    label: "Hard",
    enemyInterval: 18,
    foodSpawnRate: 0.82,
    startingFood: 72,
    moraleDrain: 0.56,
    waveScale: 1.22
  }
};

export const STARTING_ANTS_BY_DIFFICULTY = {
  easy: [ROLE.WORKER, ROLE.WORKER, ROLE.WORKER, ROLE.WORKER, ROLE.SOLDIER, ROLE.NURSE],
  normal: [ROLE.WORKER, ROLE.WORKER, ROLE.WORKER, ROLE.SOLDIER, ROLE.NURSE],
  hard: [ROLE.WORKER, ROLE.WORKER, ROLE.SOLDIER, ROLE.NURSE]
};

export const HUD_CONFIG = {
  desktop: {
    topBarHeight: 52,
    infoFontSize: 18,
    messageFontSize: 20,
    helpFontSize: 15
  },
  mobile: {
    topBarHeight: 84,
    infoFontSize: 15,
    messageFontSize: 16,
    helpFontSize: 12,
    panelMargin: 10
  }
};

export const BALANCE_CONFIG = {
  randomFoodSpawnChance: 0.004,
  maxFoodSources: 20,
  broodBaseRate: 0.02,
  maxDigQueue: 120,
  workerFoodClaimPenalty: 115,
  clickSelectRadius: 18,
  autoSaveMinimumIntervalSec: 20,
  minimapScaleMin: 2,
  minimapScaleMax: 6
};

export const EVENT_CONFIG = {
  enabledByDefault: true,
  minIntervalSec: 52,
  maxIntervalSec: 96,
  foodBloomSources: 3,
  moraleBoost: 8,
  ambushEnemyCount: 2
};

export const DEFAULT_SETTINGS = {
  musicVolume: 0.35,
  sfxVolume: 0.7,
  gameSpeed: 1,
  graphicsDetail: true,
  difficulty: "normal",
  defaultTool: TOOL_MODE.SELECT,
  compactHud: false,
  showControlHints: true,
  uiScale: 1,
  singleClickSelect: true,
  smartWorkerDistribution: true,
  autoSelectNewAnt: false,
  autoSaveEnabled: true,
  autoSaveIntervalSec: 60,
  pauseOnBlur: true,
  minimapScale: 4,
  minimapOpacity: 0.9,
  showDigMarkers: true,
  dynamicEvents: EVENT_CONFIG.enabledByDefault
};

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function distance(a, b) {
  return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
}
