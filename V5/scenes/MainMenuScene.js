import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";

function createButton(scene, x, y, label, onClick) {
  const text = scene.add
    .text(x, y, label, {
      fontFamily: "Consolas, monospace",
      fontSize: "24px",
      color: "#cfe7bf",
      backgroundColor: "#1a2c24",
      padding: {
        left: 12,
        right: 12,
        top: 7,
        bottom: 7
      }
    })
    .setOrigin(0.5, 0.5)
    .setInteractive({ useHandCursor: true });

  text.on("pointerover", () => {
    text.setColor("#f2f7c8");
    text.setBackgroundColor("#274136");
  });

  text.on("pointerout", () => {
    text.setColor("#cfe7bf");
    text.setBackgroundColor("#1a2c24");
  });

  text.on("pointerdown", onClick);
  return text;
}

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
    this.menuDifficultyIndex = 2;
  }

  create() {
    this.cameras.main.setBackgroundColor("#0d1512");

    const centerX = this.scale.width * 0.5;
    const top = this.scale.height * 0.2;

    this.add
      .text(centerX, top, "Ant Colony Manager V5", {
        fontFamily: "Consolas, monospace",
        fontSize: "48px",
        color: "#e2efc9"
      })
      .setOrigin(0.5, 0.5);

    const subtitle = this.add
      .text(
        centerX,
        top + 58,
        "All systems enabled: AI, weather, tech, events, pheromones, saves, debug",
        {
          fontFamily: "Consolas, monospace",
          fontSize: "16px",
          color: "#9ab891"
        }
      )
      .setOrigin(0.5, 0.5);

    const difficultyValues = ["Tranquil", "Forgiving", "Balanced", "Harsh", "Nightmare"];
    const difficultyText = this.add
      .text(centerX, top + 106, "", {
        fontFamily: "Consolas, monospace",
        fontSize: "17px",
        color: "#f5dd91"
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    const setDifficultyLabel = () => {
      difficultyText.setText(
        `Difficulty: ${difficultyValues[this.menuDifficultyIndex]} (click to cycle)`
      );
    };
    setDifficultyLabel();

    difficultyText.on("pointerdown", () => {
      this.menuDifficultyIndex = (this.menuDifficultyIndex + 1) % difficultyValues.length;
      setDifficultyLabel();
    });

    createButton(this, centerX, top + 180, "Start New Colony", () => {
      this.scene.start("GameScene", {
        loadSlot: null,
        overrideSettings: {
          "gameplay.difficulty": difficultyValues[this.menuDifficultyIndex]
        }
      });
    });

    createButton(this, centerX, top + 240, "Continue Autosave", () => {
      this.scene.start("GameScene", {
        loadSlot: "autosave",
        overrideSettings: {
          "gameplay.difficulty": difficultyValues[this.menuDifficultyIndex]
        }
      });
    });

    createButton(this, centerX, top + 300, "Reset To Defaults", () => {
      localStorage.removeItem("ant.colony.v5.settings");
      this.add
        .text(centerX, top + 346, "Settings reset. Start a new colony.", {
          fontFamily: "Consolas, monospace",
          fontSize: "13px",
          color: "#bce5bc"
        })
        .setOrigin(0.5, 0.5);
    });

    const controls = [
      "Controls:",
      "1-4 tool modes | Q/E cycle room type",
      "S save slot1 | L load slot1",
      "O settings panel | F3 debug panel | P or ESC pause",
      "Hold middle mouse + drag to pan camera",
      "Mouse wheel to zoom"
    ].join("\n");

    this.add
      .text(centerX, this.scale.height - 122, controls, {
        fontFamily: "Consolas, monospace",
        fontSize: "13px",
        color: "#8ead93",
        align: "center",
        lineSpacing: 4
      })
      .setOrigin(0.5, 0.5);

    const version = this.registry.get("gameVersion") ?? "unknown";
    this.add
      .text(this.scale.width - 10, this.scale.height - 10, `v${version}`, {
        fontFamily: "Consolas, monospace",
        fontSize: "12px",
        color: "#6f8575"
      })
      .setOrigin(1, 1);

    subtitle.setAlpha(0.85);
  }
}
