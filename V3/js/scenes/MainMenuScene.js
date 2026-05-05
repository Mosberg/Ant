class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#140f0b");

    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x1b1511, 1);
    this.add.circle(w * 0.2, h * 0.18, 140, 0x6a4426, 0.16);
    this.add.circle(w * 0.78, h * 0.28, 180, 0x442812, 0.15);
    this.add.circle(w * 0.52, h * 0.76, 220, 0x8c5a2d, 0.07);

    this.add
      .text(w / 2, 140, "Ant Colony Manager", {
        fontFamily: "Arial",
        fontSize: "46px",
        color: "#f5e5c8",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 195, "Dig. Forage. Defend. Endure.", {
        fontSize: "20px",
        color: "#ceb48b"
      })
      .setOrigin(0.5);

    this.createButton(w / 2, 310, 260, 56, "Start Game", () => {
      this.scene.start("GameScene");
      this.scene.launch("UIScene");
    });

    this.createButton(w / 2, 382, 260, 56, "Load Save", () => {
      const save = SaveManager.loadGame();
      this.scene.start("GameScene", { saveData: save });
      this.scene.launch("UIScene");
    });

    this.createButton(w / 2, 454, 260, 56, "Options", () => this.openOptions());
    this.createButton(w / 2, 526, 260, 56, "Instructions", () => this.openHelp());

    this.helpPanel = this.createPanel(w / 2, h / 2 + 50, 760, 380, false);
    this.helpText = this.add.text(
      this.helpPanel.x - 340,
      this.helpPanel.y - 150,
      `How to play

- Drag-select ants, then right-click to move them.
- Assign roles in the lower UI: workers, soldiers, nurses, scouts.
- Use Dig mode to carve tunnels through dirt.
- Use Build mode to place rooms in cleared underground tunnel areas.
- Workers gather food on the surface and return it to storage.
- Nurses speed brood growth. Soldiers defend against waves.
- Scouts reveal fog-of-war and discover resources.
- Lose if the queen chamber is destroyed or morale hits zero.
- Win by surviving long enough to beat the late colony assault.

Shortcuts:
P = Pause
1/2/3/4 = Set selected ants to Worker/Soldier/Nurse/Scout
B = Cycle build menu
H = Toggle help
F3 = Debug overlay
Space = 2x game speed`,
      {
        fontSize: "20px",
        color: "#f1e6d1",
        lineSpacing: 8,
        wordWrap: { width: 680 }
      }
    );
    this.helpText.setVisible(false);

    this.optionsPanel = this.createPanel(w / 2, h / 2 + 40, 560, 380, false);
    this.optionsWidgets = [];
    this.buildOptionsPanel();
    this.setOptionsVisible(false);
  }

  createButton(x, y, width, height, label, onClick) {
    const bg = this.add
      .rectangle(x, y, width, height, 0x3b2a1f, 1)
      .setStrokeStyle(2, 0xd88c36, 1)
      .setInteractive({ useHandCursor: true });

    const txt = this.add
      .text(x, y, label, {
        fontSize: "24px",
        color: "#fff2d9",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x513826));
    bg.on("pointerout", () => bg.setFillStyle(0x3b2a1f));
    bg.on("pointerdown", () => {
      window.__antAudio?.click();
      onClick();
    });

    return { bg, txt };
  }

  createPanel(x, y, w, h, visible = true) {
    const panel = this.add.rectangle(x, y, w, h, 0x241b15, 0.97).setStrokeStyle(2, 0x7a5e44, 1);
    panel.setVisible(visible);
    return panel;
  }

  openHelp() {
    const nowVisible = !this.helpPanel.visible;
    this.helpPanel.setVisible(nowVisible);
    this.helpText.setVisible(nowVisible);
    this.setOptionsVisible(false);
  }

  openOptions() {
    this.setOptionsVisible(!this.optionsPanel.visible);
    this.helpPanel.setVisible(false);
    this.helpText.setVisible(false);
  }

  setOptionsVisible(v) {
    this.optionsPanel.setVisible(v);
    for (const item of this.optionsWidgets) item.setVisible(v);
  }

  buildOptionsPanel() {
    const settings = this.registry.get("settings");
    const x = this.optionsPanel.x - 200;
    let y = this.optionsPanel.y - 120;

    const title = this.add
      .text(this.optionsPanel.x, this.optionsPanel.y - 150, "Options", {
        fontSize: "28px",
        color: "#f6e6cb",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    const labels = [
      {
        key: "musicVolume",
        text: "Music Volume",
        type: "slider",
        min: 0,
        max: 1,
        step: 0.1
      },
      {
        key: "sfxVolume",
        text: "SFX Volume",
        type: "slider",
        min: 0,
        max: 1,
        step: 0.1
      },
      {
        key: "gameSpeed",
        text: "Game Speed",
        type: "choice",
        choices: [0.5, 1, 2]
      },
      {
        key: "graphicsDetail",
        text: "Graphics Detail",
        type: "choice",
        choices: [true, false]
      },
      {
        key: "difficulty",
        text: "Difficulty",
        type: "choice",
        choices: ["easy", "normal", "hard"]
      }
    ];

    this.optionsWidgets.push(title);

    labels.forEach((row) => {
      const label = this.add.text(x, y, row.text, {
        fontSize: "22px",
        color: "#f3e4cf"
      });
      this.optionsWidgets.push(label);

      if (row.type === "choice") {
        let bx = x + 220;
        row.choices.forEach((choice) => {
          const chosen = settings.get(row.key) === choice;
          const btn = this.add
            .rectangle(bx, y + 14, 74, 34, chosen ? 0xd88c36 : 0x4b392c, 1)
            .setStrokeStyle(1, 0x9d7a50, 1)
            .setInteractive({ useHandCursor: true });
          const text = this.add
            .text(bx, y + 14, String(choice), {
              fontSize: "16px",
              color: "#fff7ea"
            })
            .setOrigin(0.5);
          btn.on("pointerdown", () => {
            settings.set(row.key, choice);
            this.scene.restart();
          });
          this.optionsWidgets.push(btn, text);
          bx += 92;
        });
      } else if (row.type === "slider") {
        const val = settings.get(row.key);
        for (let i = 0; i <= 10; i++) {
          const slot = this.add
            .rectangle(x + 220 + i * 24, y + 14, 18, 18, i / 10 <= val ? 0xd88c36 : 0x564232, 1)
            .setStrokeStyle(1, 0x8c6b4a, 1)
            .setInteractive({ useHandCursor: true });
          slot.on("pointerdown", () => {
            settings.set(row.key, i / 10);
            this.scene.restart();
          });
          this.optionsWidgets.push(slot);
        }
      }

      y += 58;
    });

    this.optionsWidgets.forEach((item) => item.setVisible(false));
  }
}

