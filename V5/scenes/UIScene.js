import Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";
import { DebugPanel } from "../ui/DebugPanel.js";
import { HUD } from "../ui/HUD.js";
import { SettingsPanel } from "../ui/SettingsPanel.js";

function createButton(scene, x, y, label, handler) {
  const node = scene.add
    .text(x, y, label, {
      fontFamily: "Consolas, monospace",
      fontSize: "13px",
      color: "#d4e4ca",
      backgroundColor: "#1c2c25",
      padding: {
        left: 7,
        right: 7,
        top: 4,
        bottom: 4
      }
    })
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  node.on("pointerover", () => {
    node.setColor("#f4f5d5");
    node.setBackgroundColor("#2a4337");
  });
  node.on("pointerout", () => {
    node.setColor("#d4e4ca");
    node.setBackgroundColor("#1c2c25");
  });
  node.on("pointerdown", handler);

  return node;
}

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
    this.gameScene = null;
    this.hud = null;
    this.settingsPanel = null;
    this.debugPanel = null;
    this.buttons = [];
  }

  create(data) {
    const key = data?.gameSceneKey ?? "GameScene";
    this.gameScene = this.scene.get(key);

    this.hud = new HUD(this, this.gameScene);
    this.settingsPanel = new SettingsPanel(this, this.gameScene);
    this.debugPanel = new DebugPanel(this, this.gameScene);

    this.createControlStrip();

    this.gameScene.events.on("ui:toggleSettings", () => this.settingsPanel.toggle());
    this.gameScene.events.on("ui:toggleDebug", () => this.debugPanel.toggle());

    this.events.once("shutdown", () => {
      this.hud?.destroy();
      this.gameScene?.events?.off("ui:toggleSettings");
      this.gameScene?.events?.off("ui:toggleDebug");
    });
  }

  createControlStrip() {
    const y = this.scale.height - 34;
    const strip = this.add
      .rectangle(0, y - 2, this.scale.width, 36, 0x08110d, 0.88)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x5f8970, 0.36)
      .setScrollFactor(0)
      .setDepth(120);

    this.buttons.push(strip);

    const controls = [
      { label: "Select", onClick: () => this.gameScene.setTool("select") },
      { label: "Dig", onClick: () => this.gameScene.setTool("dig") },
      { label: "Build", onClick: () => this.gameScene.setTool("build") },
      { label: "Pheromone", onClick: () => this.gameScene.setTool("pheromone") },
      { label: "Prev Room", onClick: () => this.gameScene.cycleRoomType(-1) },
      { label: "Next Room", onClick: () => this.gameScene.cycleRoomType(1) },
      { label: "Save", onClick: () => this.gameScene.engine.getSystem("saveLoad").save("slot1") },
      { label: "Load", onClick: () => this.gameScene.engine.getSystem("saveLoad").load("slot1") },
      { label: "Settings", onClick: () => this.settingsPanel.toggle() },
      { label: "Debug", onClick: () => this.debugPanel.toggle() },
      { label: "Pause", onClick: () => this.gameScene.togglePause() }
    ];

    let x = 8;
    for (const control of controls) {
      const button = createButton(this, x, y, control.label, control.onClick)
        .setDepth(121)
        .setScrollFactor(0);
      this.buttons.push(button);
      x += button.width + 6;
    }
  }

  update(_time, delta) {
    if (!this.gameScene || !this.scene.isActive("GameScene")) {
      return;
    }

    const dt = delta / 1000;
    this.hud.update(dt);
    this.settingsPanel.update(dt);
    this.debugPanel.update(dt);
  }
}
