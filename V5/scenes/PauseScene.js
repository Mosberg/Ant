import Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";

function createMenuButton(scene, x, y, label, onClick) {
  const button = scene.add
    .text(x, y, label, {
      fontFamily: "Consolas, monospace",
      fontSize: "22px",
      color: "#e3e8ca",
      backgroundColor: "#1d3027",
      padding: {
        left: 12,
        right: 12,
        top: 8,
        bottom: 8
      }
    })
    .setOrigin(0.5, 0.5)
    .setInteractive({ useHandCursor: true });

  button.on("pointerover", () => {
    button.setColor("#fff5ca");
    button.setBackgroundColor("#2d4a3e");
  });

  button.on("pointerout", () => {
    button.setColor("#e3e8ca");
    button.setBackgroundColor("#1d3027");
  });

  button.on("pointerdown", onClick);
  return button;
}

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("PauseScene");
  }

  create(data) {
    this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.56)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.28, "Simulation Paused", {
        fontFamily: "Consolas, monospace",
        fontSize: "42px",
        color: "#f3e7be"
      })
      .setOrigin(0.5, 0.5);

    if (data?.reason) {
      this.add
        .text(this.scale.width * 0.5, this.scale.height * 0.36, data.reason, {
          fontFamily: "Consolas, monospace",
          fontSize: "14px",
          color: "#ffd7d1"
        })
        .setOrigin(0.5, 0.5);
    }

    createMenuButton(this, this.scale.width * 0.5, this.scale.height * 0.48, "Resume", () => {
      this.scene.stop("PauseScene");
      this.scene.resume("GameScene");
      this.scene.resume("UIScene");
    });

    createMenuButton(
      this,
      this.scale.width * 0.5,
      this.scale.height * 0.58,
      "Restart Colony",
      () => {
        this.scene.stop("PauseScene");
        this.scene.stop("UIScene");
        this.scene.start("GameScene", {
          loadSlot: null
        });
      }
    );

    createMenuButton(this, this.scale.width * 0.5, this.scale.height * 0.68, "Quit To Menu", () => {
      this.scene.stop("PauseScene");
      this.scene.stop("UIScene");
      this.scene.stop("GameScene");
      this.scene.start("MainMenuScene");
    });

    this.input.keyboard.on("keydown-ESC", () => {
      this.scene.stop("PauseScene");
      this.scene.resume("GameScene");
      this.scene.resume("UIScene");
    });
  }
}
