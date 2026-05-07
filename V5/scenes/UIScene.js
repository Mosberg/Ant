import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";
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
    this.useShellDom = false;
    this.shellHeader = null;
    this.shellFooter = null;
    this.shellStatusResources = null;
    this.shellStatusMeta = null;
    this.footerButtons = [];
    this.statusRefreshClock = 0;
    this.miniMapRefreshClock = 0;
    this.miniMapPanel = null;
    this.miniMapLabel = null;
    this.miniMapGraphics = null;
    this.miniMapHitArea = null;
    this.miniMapBounds = null;
    this.domCleanupHandlers = [];
  }

  create(data) {
    const key = data?.gameSceneKey ?? "GameScene";
    this.gameScene = this.scene.get(key);

    this.useShellDom = this.bindShellContainers();
    if (this.useShellDom) {
      this.createShellHeaderStatus();
      this.createShellFooterButtons();
      this.createMiniMapOverlay();
    } else {
      this.hud = new HUD(this, this.gameScene);
    }

    this.settingsPanel = new SettingsPanel(this, this.gameScene);
    this.debugPanel = new DebugPanel(this, this.gameScene);

    if (!this.useShellDom) {
      this.createControlStrip();
    }

    this.gameScene.events.on("ui:toggleSettings", () => this.settingsPanel.toggle());
    this.gameScene.events.on("ui:toggleDebug", () => this.debugPanel.toggle());

    this.events.once("shutdown", () => {
      this.hud?.destroy();
      this.teardownShellDom();
      this.destroyMiniMapOverlay();
      this.gameScene?.events?.off("ui:toggleSettings");
      this.gameScene?.events?.off("ui:toggleDebug");
    });
  }

  bindShellContainers() {
    this.shellHeader = document.getElementById("game-root-top-overlay");
    this.shellFooter = document.getElementById("game-root-bottom-menu");
    return Boolean(this.shellHeader && this.shellFooter);
  }

  createShellHeaderStatus() {
    if (!this.shellHeader) {
      return;
    }

    this.shellHeader.innerHTML = "";

    this.shellStatusResources = document.createElement("div");
    this.shellStatusResources.className = "shell-status-row shell-status-resources";

    this.shellStatusMeta = document.createElement("div");
    this.shellStatusMeta.className = "shell-status-row shell-status-meta";

    this.shellHeader.append(this.shellStatusResources, this.shellStatusMeta);
    this.refreshShellStatus(true);
  }

  createShellFooterButtons() {
    if (!this.shellFooter) {
      return;
    }

    this.shellFooter.innerHTML = "";

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

    for (const control of controls) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "shell-action-button";
      button.textContent = control.label;
      button.addEventListener("click", control.onClick);
      this.shellFooter.append(button);
      this.footerButtons.push(button);
      this.domCleanupHandlers.push(() => {
        button.removeEventListener("click", control.onClick);
      });
    }
  }

  createMiniMapOverlay() {
    if (!this.useShellDom) {
      return;
    }

    const panelWidth = 214;
    const panelHeight = 126;
    const panelX = this.scale.width - panelWidth - 12;
    const panelY = 10;

    this.miniMapPanel = this.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x08100d, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x9ebf9f, 0.42)
      .setScrollFactor(0)
      .setDepth(180);

    this.miniMapLabel = this.add
      .text(panelX + 10, panelY + 8, "Mini Map", {
        fontFamily: "Consolas, monospace",
        fontSize: "12px",
        color: "#cfe8ca"
      })
      .setScrollFactor(0)
      .setDepth(181);

    this.miniMapGraphics = this.add.graphics().setScrollFactor(0).setDepth(182);

    const mapX = panelX + 10;
    const mapY = panelY + 26;
    const mapWidth = panelWidth - 20;
    const mapHeight = panelHeight - 36;
    this.miniMapBounds = {
      x: mapX,
      y: mapY,
      width: mapWidth,
      height: mapHeight
    };

    this.miniMapHitArea = this.add
      .rectangle(mapX, mapY, mapWidth, mapHeight, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(183)
      .setInteractive({ useHandCursor: true });

    this.miniMapHitArea.on("pointerdown", (pointer) => {
      if (!pointer.leftButtonDown()) {
        return;
      }
      this.centerCameraFromMiniMap(pointer.x, pointer.y);
    });

    this.refreshMiniMap(true);
  }

  centerCameraFromMiniMap(screenX, screenY) {
    if (!this.miniMapBounds) {
      return;
    }

    const terrain = this.gameScene.engine.getSystem("terrain");
    const camera = this.gameScene.cameras.main;

    const nx = Phaser.Math.Clamp((screenX - this.miniMapBounds.x) / this.miniMapBounds.width, 0, 1);
    const ny = Phaser.Math.Clamp(
      (screenY - this.miniMapBounds.y) / this.miniMapBounds.height,
      0,
      1
    );

    const worldX = nx * terrain.width * terrain.tileSize;
    const worldY = ny * terrain.height * terrain.tileSize;
    camera.centerOn(worldX, worldY);
  }

  refreshMiniMap(force = false) {
    if (!this.miniMapGraphics || !this.miniMapBounds) {
      return;
    }

    if (!force && this.miniMapRefreshClock < 0.16) {
      return;
    }
    this.miniMapRefreshClock = 0;

    const engine = this.gameScene.engine;
    const terrain = engine.getSystem("terrain");
    const ants = engine.getSystem("ants");
    const enemies = engine.getSystem("enemies");
    const rooms = engine.getSystem("rooms");
    const camera = this.gameScene.cameras.main;

    const { x, y, width, height } = this.miniMapBounds;
    const sx = width / terrain.width;
    const sy = height / terrain.height;
    const dotW = Math.max(2, Math.ceil(sx));
    const dotH = Math.max(2, Math.ceil(sy));

    this.miniMapGraphics.clear();
    this.miniMapGraphics.fillStyle(0x1c2a23, 0.92);
    this.miniMapGraphics.fillRect(x, y, width, height);
    this.miniMapGraphics.lineStyle(1, 0x5f7f6b, 0.5);
    this.miniMapGraphics.strokeRect(x, y, width, height);

    this.miniMapGraphics.fillStyle(0xba915f, 0.58);
    for (const room of rooms.rooms) {
      this.miniMapGraphics.fillRect(
        x + room.tilePosition.x * sx,
        y + room.tilePosition.y * sy,
        dotW,
        dotH
      );
    }

    this.miniMapGraphics.fillStyle(0x8ab48d, 0.9);
    for (const ant of ants.getAliveAnts()) {
      this.miniMapGraphics.fillRect(x + ant.x * sx, y + ant.y * sy, dotW, dotH);
    }

    this.miniMapGraphics.fillStyle(0xdb6a62, 0.92);
    for (const enemy of enemies.getAliveEnemies()) {
      this.miniMapGraphics.fillRect(x + enemy.x * sx, y + enemy.y * sy, dotW, dotH);
    }

    const tileSize = terrain.tileSize;
    const viewTileX = camera.scrollX / tileSize;
    const viewTileY = camera.scrollY / tileSize;
    const viewTileW = camera.width / camera.zoom / tileSize;
    const viewTileH = camera.height / camera.zoom / tileSize;

    this.miniMapGraphics.lineStyle(1, 0xf6dc7e, 0.95);
    this.miniMapGraphics.strokeRect(
      x + viewTileX * sx,
      y + viewTileY * sy,
      viewTileW * sx,
      viewTileH * sy
    );
  }

  destroyMiniMapOverlay() {
    this.miniMapHitArea?.destroy();
    this.miniMapGraphics?.destroy();
    this.miniMapLabel?.destroy();
    this.miniMapPanel?.destroy();

    this.miniMapHitArea = null;
    this.miniMapGraphics = null;
    this.miniMapLabel = null;
    this.miniMapPanel = null;
    this.miniMapBounds = null;
  }

  refreshShellStatus(force = false) {
    if (!this.useShellDom || !this.shellStatusResources || !this.shellStatusMeta) {
      return;
    }

    if (!force && this.statusRefreshClock < 0.2) {
      return;
    }
    this.statusRefreshClock = 0;

    const engine = this.gameScene.engine;
    const resources = engine.getSystem("resources");
    const ants = engine.getSystem("ants");
    const rooms = engine.getSystem("rooms");
    const weather = engine.getSystem("weather");
    const morale = engine.getSystem("morale");

    const resourceSummary = resources
      .getSummary()
      .map((entry) => `${entry.id}:${entry.value.toFixed(0)}/${entry.capacity.toFixed(0)}`)
      .join("  |  ");

    this.shellStatusResources.textContent = resourceSummary;
    this.shellStatusMeta.textContent = [
      `Ants: ${ants.getAliveAnts().length}`,
      `Rooms: ${rooms.rooms.length}`,
      `Weather: ${weather.getCurrentWeather().id}`,
      `Season: ${weather.getCurrentSeason().id}`,
      `Morale: ${morale.morale.toFixed(1)}`,
      `Tool: ${this.gameScene.currentTool}`,
      `Build: ${this.gameScene.selectedRoomType}`
    ].join("  |  ");

    for (const button of this.footerButtons) {
      const mode = button.textContent?.toLowerCase();
      const isTool =
        mode === "select" || mode === "dig" || mode === "build" || mode === "pheromone";
      button.classList.toggle("is-active", isTool && mode === this.gameScene.currentTool);
    }
  }

  teardownShellDom() {
    for (const dispose of this.domCleanupHandlers) {
      dispose();
    }
    this.domCleanupHandlers = [];

    if (this.shellHeader) {
      this.shellHeader.innerHTML = "";
    }
    if (this.shellFooter) {
      this.shellFooter.innerHTML = "";
    }

    this.footerButtons = [];
    this.shellStatusResources = null;
    this.shellStatusMeta = null;
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
    this.statusRefreshClock += dt;
    this.miniMapRefreshClock += dt;
    this.hud?.update(dt);
    this.refreshShellStatus();
    this.refreshMiniMap();
    this.settingsPanel.update(dt);
    this.debugPanel.update(dt);
  }
}
