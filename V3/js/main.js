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
