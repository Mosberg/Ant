import { GAME_HEIGHT, GAME_WIDTH } from "./core/constants.js";
import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { MainMenuScene } from "./scenes/MainMenuScene.js";
import { PauseScene } from "./scenes/PauseScene.js";
import { PreloadScene } from "./scenes/PreloadScene.js";
import { UIScene } from "./scenes/UIScene.js";

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-root",
  backgroundColor: "#15110d",
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, PauseScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  input: {
    activePointers: 4,
    mouse: true,
    touch: true,
    gamepad: false
  },
  dom: {
    createContainer: true
  }
};

new Phaser.Game(config);
