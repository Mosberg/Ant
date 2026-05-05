import { MobileSupport } from "../core/mobileSupport.js";
import { AudioManager } from "../managers/AudioManager.js";
import { SettingsManager } from "../managers/SettingsManager.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  init() {
    const settings = new SettingsManager();
    this.registry.set("settings", settings);
    this.registry.set("audio", new AudioManager(settings));
  }

  create() {
    MobileSupport.attachSceneHelpers(this);
    const mobileSupport = new MobileSupport(this.game, {
      enableFullscreenButton: MobileSupport.isMobileDevice(),
      audioManager: this.registry.get("audio")
    });
    mobileSupport.install();
    this.registry.set("mobileSupport", mobileSupport);

    this.scene.start("PreloadScene");
  }
}
