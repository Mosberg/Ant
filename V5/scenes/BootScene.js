import Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#0c1310");

    this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.5, "Booting Ant Colony V5...", {
        fontFamily: "Consolas, monospace",
        fontSize: "28px",
        color: "#d9efc8"
      })
      .setOrigin(0.5, 0.5);

    this.time.delayedCall(260, () => {
      this.scene.start("PreloadScene");
    });
  }
}
