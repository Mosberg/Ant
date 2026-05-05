class PauseScene extends Phaser.Scene {
  constructor() {
    super("PauseScene");
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55);
    this.add
      .text(w / 2, h / 2 - 130, "Paused", {
        fontSize: "42px",
        color: "#fff0d8",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.createBtn(w / 2, h / 2 - 30, "Resume", () => this.resumeGame());
    this.createBtn(w / 2, h / 2 + 40, "Quit to Menu", () => {
      this.scene.stop("UIScene");
      this.scene.stop("GameScene");
      this.scene.start("MainMenuScene");
    });
  }

  createBtn(x, y, label, cb) {
    const bg = this.add
      .rectangle(x, y, 220, 52, 0x3b2a1f, 1)
      .setStrokeStyle(2, 0xd88c36, 1)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, {
        fontSize: "24px",
        color: "#fff7ea"
      })
      .setOrigin(0.5);
    bg.on("pointerdown", cb);
    return { bg, txt };
  }

  resumeGame() {
    this.scene.stop();
    this.scene.resume("GameScene");
    this.scene.resume("UIScene");
  }
}

