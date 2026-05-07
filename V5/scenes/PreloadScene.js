import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create() {
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;

    this.cameras.main.setBackgroundColor("#111a16");

    const status = this.add
      .text(centerX, centerY - 8, "Preparing systems and config maps...", {
        fontFamily: "Consolas, monospace",
        fontSize: "20px",
        color: "#e5f3d5"
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(centerX, centerY + 30, "No external build tools. Direct browser ES modules.", {
        fontFamily: "Consolas, monospace",
        fontSize: "14px",
        color: "#a5be9d"
      })
      .setOrigin(0.5, 0.5);

    this.time.delayedCall(500, () => {
      status.setText("Ready");
      this.scene.start("MainMenuScene");
    });
  }
}
