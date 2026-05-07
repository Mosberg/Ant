import { getByPath } from "../engine/utils.js";

const SETTINGS_ROWS = [
  { label: "Master Volume", path: "audio.masterVolume" },
  { label: "Music", path: "audio.musicEnabled" },
  { label: "SFX", path: "audio.sfxEnabled" },
  { label: "Game Speed", path: "gameplay.gameSpeed" },
  { label: "Difficulty", path: "gameplay.difficulty" },
  { label: "Graphics Quality", path: "graphics.quality" },
  { label: "Particle Density", path: "graphics.particleDensity" },
  { label: "Ant Detail", path: "graphics.antSpriteDetail" },
  { label: "Colorblind Mode", path: "accessibility.colorblindMode" },
  { label: "UI Scale", path: "ui.scale" },
  { label: "Autosave", path: "gameplay.autosaveEnabled" },
  { label: "Auto Research", path: "gameplay.autoResearchEnabled" },
  { label: "Morph Food Cost", path: "gameplay.antMorphFoodCost" },
  { label: "Morph Biomass", path: "gameplay.antMorphBiomassCost" },
  { label: "Morph Jelly", path: "gameplay.antMorphRoyalJellyCost" },
  { label: "Dig Power", path: "gameplay.digPowerScale" },
  { label: "Simulation Depth", path: "gameplay.simulationDepth" },
  { label: "AI Think Interval", path: "ai.decisionIntervalSeconds" },
  { label: "AI State Hold", path: "ai.stateHoldSeconds" },
  { label: "AI Decisions/Tick", path: "ai.maxDecisionsPerTick" },
  { label: "AI Danger Threshold", path: "ai.dangerPheromoneThreshold" },
  { label: "AI Job Queues", path: "ai.useJobQueues" },
  { label: "Queue Refresh", path: "ai.jobQueueRefreshSeconds" },
  { label: "Job Claim TTL", path: "ai.jobClaimTtlSeconds" },
  { label: "Soldier Hunt Range", path: "ai.soldierHuntRangeBonus" },
  { label: "Combat Pack Radius", path: "ai.combatPackRadius" },
  { label: "Pack Dmg Per Mate", path: "ai.combatPackDamagePerMate" },
  { label: "Combat Pack Max", path: "ai.combatPackMaxBonus" },
  { label: "Path Cache", path: "pathfinding.enableCache" },
  { label: "Role Path Profiles", path: "pathfinding.useRoleProfiles" },
  { label: "Danger Cost Scale", path: "pathfinding.dangerCostScale" },
  { label: "Diagonal Pathing", path: "pathfinding.allowDiagonal" },
  { label: "Ant Pathing", path: "pathfinding.enableAntPathing" },
  { label: "Enemy Pathing", path: "pathfinding.enableEnemyPathing" },
  { label: "Max Path Nodes", path: "pathfinding.maxVisitedNodes" },
  { label: "Repath Interval", path: "pathfinding.repathIntervalSeconds" }
];

function formatValue(value) {
  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

export class SettingsPanel {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gameScene = gameScene;
    this.visible = false;
    this.rows = [];

    const rowHeight = 24;
    const panelWidth = 460;
    const desiredHeight = 96 + SETTINGS_ROWS.length * rowHeight;
    const panelHeight = Math.min(scene.scale.height - 24, Math.max(430, desiredHeight));
    const x = scene.scale.width * 0.5 - panelWidth * 0.5;
    const y = scene.scale.height * 0.5 - panelHeight * 0.5;

    this.root = scene.add.container(x, y).setDepth(300).setVisible(false);

    const bg = scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x0c1412, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xd7c16a, 0.55);

    const title = scene.add.text(14, 12, "Settings", {
      fontFamily: "Consolas, monospace",
      fontSize: "20px",
      color: "#ece6b7"
    });

    const closeButton = scene.add
      .text(panelWidth - 44, 12, "[X]", {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#f4a5a5"
      })
      .setInteractive({ useHandCursor: true });

    closeButton.on("pointerdown", () => this.close());

    this.root.add([bg, title, closeButton]);

    let yOffset = 54;
    for (const row of SETTINGS_ROWS) {
      const line = scene.add
        .text(16, yOffset, "", {
          fontFamily: "Consolas, monospace",
          fontSize: "13px",
          color: "#cfe8ca"
        })
        .setInteractive({ useHandCursor: true });

      line.on("pointerdown", () => {
        this.cycleOption(row.path);
      });

      this.rows.push({
        ...row,
        node: line
      });
      this.root.add(line);
      yOffset += rowHeight;
    }

    const hint = scene.add.text(16, panelHeight - 30, "Click any row to cycle values", {
      fontFamily: "Consolas, monospace",
      fontSize: "12px",
      color: "#96b399"
    });

    this.root.add(hint);
    this.refresh();
  }

  getSettingsSystem() {
    return this.gameScene.engine.getSystem("settings");
  }

  cycleOption(path) {
    const settings = this.getSettingsSystem();
    const schema = getByPath(settings.schema, path, null);
    const current = settings.get(path);

    if (!schema) {
      return;
    }

    if (schema.type === "boolean") {
      settings.set(path, !current);
      this.refresh();
      return;
    }

    if (Array.isArray(schema.options)) {
      const index = schema.options.indexOf(current);
      const next = schema.options[(index + 1) % schema.options.length];
      settings.set(path, next);
      this.refresh();
      return;
    }

    if (schema.type === "number") {
      const min = Number(schema.min ?? 0);
      const max = Number(schema.max ?? 1);
      const step = Number(schema.step ?? 0.1);
      let next = Number(current) + step;
      if (next > max) {
        next = min;
      }
      settings.set(path, next);
      this.refresh();
    }
  }

  refresh() {
    const settings = this.getSettingsSystem();
    for (const row of this.rows) {
      const value = settings.get(row.path);
      row.node.setText(`${row.label.padEnd(18, " ")}: ${formatValue(value)}`);
    }
  }

  open() {
    this.visible = true;
    this.root.setVisible(true);
    this.refresh();
  }

  close() {
    this.visible = false;
    this.root.setVisible(false);
  }

  toggle() {
    if (this.visible) {
      this.close();
    } else {
      this.open();
    }
  }

  update(_dt) {
    if (!this.visible) {
      return;
    }
    this.refresh();
  }
}
