import { DEFAULT_SETTINGS, GAME_SPEED_STEPS, GAME_VERSION, TOOL_MODE } from "../core/constants.js";
import { SaveManager } from "../managers/SaveManager.js";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#140f0b");
    this.audio = this.registry.get("audio");

    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x1b1511, 1);
    this.add.circle(w * 0.2, h * 0.18, 140, 0x6a4426, 0.16);
    this.add.circle(w * 0.78, h * 0.28, 180, 0x442812, 0.15);
    this.add.circle(w * 0.52, h * 0.76, 220, 0x8c5a2d, 0.07);

    this.add
      .text(w / 2, 126, "Ant Colony Manager", {
        fontFamily: "Arial",
        fontSize: "46px",
        color: "#f5e5c8",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 176, "Dig. Forage. Defend. Endure.", {
        fontSize: "20px",
        color: "#ceb48b"
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 206, `V${GAME_VERSION}  |  ES Modules`, {
        fontSize: "14px",
        color: "#d9bb8f"
      })
      .setOrigin(0.5);

    this.createButton(w / 2, 300, 260, 56, "Start Game", () => {
      this.scene.start("GameScene");
      this.scene.launch("UIScene");
    });

    this.createButton(w / 2, 370, 260, 56, "Load Save", () => {
      const save = SaveManager.loadGame();
      this.scene.start("GameScene", { saveData: save });
      this.scene.launch("UIScene");
    });

    this.createButton(w / 2, 440, 260, 56, "Options", () => this.openOptions());
    this.createButton(w / 2, 510, 260, 56, "Instructions", () => this.openHelp());

    this.helpPanel = this.createPanel(w / 2, h / 2 + 75, 780, 410, false);
    this.helpText = this.add.text(
      this.helpPanel.x - 350,
      this.helpPanel.y - 170,
      `How to play

- Drag-select ants, then right-click to move them.
- Assign roles in the lower UI: workers, soldiers, nurses, scouts.
- Use Dig mode to carve tunnels through dirt.
- Use Build mode to place rooms in cleared underground tunnel areas.
- Workers gather food on the surface and return it to storage.
- Nurses speed brood growth. Soldiers defend against waves.
- Scouts reveal fog-of-war and discover resources.
- Use mobile action bar tools on touch devices.
- Dynamic events can help or hurt the colony over time.
- Lose if the queen chamber is destroyed or morale hits zero.

Shortcuts:
Q/E/R = Select/Dig/Build tool
P = Pause
Z/X = Undo/Clear dig queue
1/2/3/4 = Set selected ants to Worker/Soldier/Nurse/Scout
B = Cycle build menu
H = Toggle help
F3 = Debug overlay
Space = Cycle game speed`,
      {
        fontSize: "18px",
        color: "#f1e6d1",
        lineSpacing: 7,
        wordWrap: { width: 700 }
      }
    );
    this.helpText.setVisible(false);

    this.optionsPanel = this.createPanel(w / 2, h / 2 + 40, 860, 560, false);
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
      this.audio?.click();
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

  formatChoiceLabel(value) {
    if (typeof value === "boolean") return value ? "On" : "Off";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value.charAt(0).toUpperCase() + value.slice(1);
    return String(value);
  }

  buildOptionsPanel() {
    const settings = this.registry.get("settings");
    const panelLeft = this.optionsPanel.x - this.optionsPanel.width / 2;
    const panelTop = this.optionsPanel.y - this.optionsPanel.height / 2;
    const rowsPerColumn = 9;
    const rowHeight = 38;
    const columnWidth = 395;
    const baseX = panelLeft + 30;
    const startY = panelTop + 64;

    const title = this.add
      .text(this.optionsPanel.x, panelTop + 18, "Options", {
        fontSize: "28px",
        color: "#f6e6cb",
        fontStyle: "bold"
      })
      .setOrigin(0.5, 0);

    this.optionsWidgets.push(title);

    const rows = [
      { key: "musicVolume", text: "Music", type: "slider", min: 0, max: 1, step: 0.1 },
      { key: "sfxVolume", text: "SFX", type: "slider", min: 0, max: 1, step: 0.1 },
      { key: "gameSpeed", text: "Speed", type: "choice", choices: GAME_SPEED_STEPS },
      {
        key: "difficulty",
        text: "Difficulty",
        type: "choice",
        choices: ["easy", "normal", "hard"]
      },
      {
        key: "defaultTool",
        text: "Default Tool",
        type: "choice",
        choices: [TOOL_MODE.SELECT, TOOL_MODE.DIG, TOOL_MODE.BUILD]
      },
      {
        key: "singleClickSelect",
        text: "Click Select",
        type: "choice",
        choices: [true, false]
      },
      {
        key: "smartWorkerDistribution",
        text: "Smart Worker AI",
        type: "choice",
        choices: [true, false]
      },
      {
        key: "autoSelectNewAnt",
        text: "Auto Select Hatch",
        type: "choice",
        choices: [true, false]
      },
      { key: "graphicsDetail", text: "Graphics", type: "choice", choices: [true, false] },
      { key: "compactHud", text: "Compact HUD", type: "choice", choices: [true, false] },
      { key: "showControlHints", text: "Control Hints", type: "choice", choices: [true, false] },
      { key: "autoSaveEnabled", text: "Autosave", type: "choice", choices: [true, false] },
      {
        key: "autoSaveIntervalSec",
        text: "Autosave Sec",
        type: "choice",
        choices: [30, 60, 90, 120]
      },
      { key: "pauseOnBlur", text: "Pause on Blur", type: "choice", choices: [true, false] },
      { key: "dynamicEvents", text: "Dynamic Events", type: "choice", choices: [true, false] },
      { key: "minimapScale", text: "Minimap Scale", type: "choice", choices: [3, 4, 5] },
      { key: "minimapOpacity", text: "Minimap Alpha", type: "slider", min: 0.4, max: 1, step: 0.1 },
      { key: "showDigMarkers", text: "Dig Markers", type: "choice", choices: [true, false] }
    ];

    rows.forEach((row, idx) => {
      const col = Math.floor(idx / rowsPerColumn);
      const rowIdx = idx % rowsPerColumn;
      const x = baseX + col * columnWidth;
      const y = startY + rowIdx * rowHeight;

      const label = this.add.text(x, y, row.text, {
        fontSize: "17px",
        color: "#f3e4cf"
      });
      this.optionsWidgets.push(label);

      if (row.type === "choice") {
        let bx = x + 170;
        row.choices.forEach((choice) => {
          const chosen = settings.get(row.key) === choice;
          const btn = this.add
            .rectangle(bx, y + 12, 58, 26, chosen ? 0xd88c36 : 0x4b392c, 1)
            .setStrokeStyle(1, 0x9d7a50, 1)
            .setInteractive({ useHandCursor: true });
          const text = this.add
            .text(bx, y + 12, this.formatChoiceLabel(choice), {
              fontSize: "12px",
              color: "#fff7ea"
            })
            .setOrigin(0.5);
          btn.on("pointerdown", () => {
            settings.set(row.key, choice);
            this.scene.restart();
          });
          this.optionsWidgets.push(btn, text);
          bx += 66;
        });
      } else if (row.type === "slider") {
        const val = settings.get(row.key);
        const steps = Math.round((row.max - row.min) / row.step);
        const slotW = 14;
        const gap = 3;
        for (let i = 0; i <= steps; i++) {
          const targetVal = Number((row.min + i * row.step).toFixed(2));
          const active = targetVal <= Number(val) + 1e-6;
          const slot = this.add
            .rectangle(
              x + 170 + i * (slotW + gap),
              y + 12,
              slotW,
              14,
              active ? 0xd88c36 : 0x564232,
              1
            )
            .setStrokeStyle(1, 0x8c6b4a, 1)
            .setInteractive({ useHandCursor: true });
          slot.on("pointerdown", () => {
            settings.set(row.key, targetVal);
            this.scene.restart();
          });
          this.optionsWidgets.push(slot);
        }
      }
    });

    const resetBtn = this.add
      .rectangle(
        this.optionsPanel.x - 100,
        panelTop + this.optionsPanel.height - 34,
        170,
        34,
        0x6f3e2f,
        1
      )
      .setStrokeStyle(1, 0xe4af7a, 1)
      .setInteractive({ useHandCursor: true });
    const resetText = this.add
      .text(resetBtn.x, resetBtn.y, "Reset Defaults", {
        fontSize: "16px",
        color: "#fff3e0",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    resetBtn.on("pointerdown", () => {
      settings.setMany({ ...DEFAULT_SETTINGS });
      this.scene.restart();
    });

    const closeBtn = this.add
      .rectangle(
        this.optionsPanel.x + 100,
        panelTop + this.optionsPanel.height - 34,
        170,
        34,
        0x3b2a1f,
        1
      )
      .setStrokeStyle(1, 0xd88c36, 1)
      .setInteractive({ useHandCursor: true });
    const closeText = this.add
      .text(closeBtn.x, closeBtn.y, "Close", {
        fontSize: "16px",
        color: "#fff3e0",
        fontStyle: "bold"
      })
      .setOrigin(0.5);
    closeBtn.on("pointerdown", () => this.setOptionsVisible(false));

    this.optionsWidgets.push(resetBtn, resetText, closeBtn, closeText);
    this.optionsWidgets.forEach((item) => item.setVisible(false));
  }
}
