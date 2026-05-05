/* Ant Colony Manager - Mobile Enhanced Version
   Now includes media.css and media.js for full mobile support.
   Phaser pointer events automatically handle touch/mouse unification.
   MobileSupport class adds viewport, fullscreen, and touch helpers.
*/

// ... [your full original main.js code goes here unchanged] ...

// Mobile integration - add this to the end of your main.js, before the config
class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  init() {
    this.registry.set("settings", new SettingsManager());
  }

  create() {
    // Mobile support integration
    const mobileSupport = window.mobileSupport;
    if (mobileSupport) {
      MobileSupport.attachSceneHelpers(this);
      this.isMobile = MobileSupport.isMobileDevice();
    }

    this.scene.start("PreloadScene");
  }
}

// Add mobile action bar to UIScene create() method
// Insert this after the existing UI creation in UIScene.create():
/*
if (this.isMobileDevice) {
  const mobileButtons = [
    { label: "Dig", onClick: () => this.gameScene.currentTool = 'dig' },
    { label: "Build", onClick: () => this.gameScene.currentTool = 'build' },
    { label: "Pause", onClick: () => this.togglePause() }
  ];
  this.mobileBar = this.createMobileActionBar(mobileButtons);
}
*/

// Update config to support mobile input
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
    activePointers: 4,  // Support multi-touch
    mouse: true,
    touch: true,
    gamepad: false
  },
  dom: {
    createContainer: true
  }
};

new Phaser.Game(config);