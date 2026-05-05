class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  init() {
    this.registry.set("settings", new SettingsManager());
  }

  create() {
    MobileSupport.attachSceneHelpers(this);
    const mobileSupport = new MobileSupport(this.game, {
      enableFullscreenButton: MobileSupport.isMobileDevice()
    });
    mobileSupport.install();
    this.registry.set("mobileSupport", mobileSupport);

    this.scene.start("PreloadScene");
  }
}

