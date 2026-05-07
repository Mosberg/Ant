import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";
import { loadConfigBundle } from "./engine/ConfigLoader.js";
import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { MainMenuScene } from "./scenes/MainMenuScene.js";
import { PauseScene } from "./scenes/PauseScene.js";
import { PreloadScene } from "./scenes/PreloadScene.js";
import { UIScene } from "./scenes/UIScene.js";

const GAME_VERSION = "5.0.0";

async function bootGame() {
  const configBundle = await loadConfigBundle("./data");

  const gameConfig = {
    type: Phaser.AUTO,
    parent: "game-root",
    width: 1280,
    height: 720,
    backgroundColor: "#0e1512",
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    fps: {
      target: 60,
      smoothStep: true,
      forceSetTimeOut: false
    },
    scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, PauseScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set("configBundle", configBundle);
        game.registry.set("gameVersion", GAME_VERSION);
      }
    }
  };

  // Keep the game instance local to prevent accidental global leakage.
  new Phaser.Game(gameConfig);
}

bootGame().catch((error) => {
  const bootError = document.getElementById("boot-error");
  const message = `Boot failed: ${error.message}`;
  if (bootError) {
    bootError.textContent = message;
  }
  console.error(message, error);
});
