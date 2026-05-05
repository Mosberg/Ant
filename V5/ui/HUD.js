export class HUD {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gameScene = gameScene;
    this.visible = true;
    this.alerts = [];
    this.refreshClock = 0;

    this.root = scene.add.container(0, 0);
    this.background = scene.add
      .rectangle(0, 0, scene.scale.width, 92, 0x0a1110, 0.86)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6c8f72, 0.5);

    this.resourceText = scene.add.text(12, 8, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "14px",
      color: "#edf5df"
    });

    this.statusText = scene.add.text(12, 46, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "13px",
      color: "#c6d8b5"
    });

    this.alertText = scene.add.text(scene.scale.width * 0.34, 46, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "13px",
      color: "#ffc9a8"
    });

    this.miniMapBg = scene.add
      .rectangle(scene.scale.width - 192, 8, 184, 76, 0x08100d, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x9ebf9f, 0.42);

    this.miniMapGraphics = scene.add.graphics();

    this.pheromoneToggle = scene.add
      .text(scene.scale.width - 196, 86, "[Pheromone Overlay]", {
        fontFamily: "Consolas, monospace",
        fontSize: "11px",
        color: "#96e5a0"
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true });

    this.pheromoneToggle.on("pointerdown", () => {
      const debug = this.gameScene.engine.getSystem("debug");
      debug.toggle("showPheromoneHeatmap");
    });

    this.root.add([
      this.background,
      this.resourceText,
      this.statusText,
      this.alertText,
      this.miniMapBg,
      this.miniMapGraphics,
      this.pheromoneToggle
    ]);

    const engine = this.gameScene.engine;
    this.unsubscribe = [
      engine.events.on("events:triggered", (entry) => this.pushAlert(`Event: ${entry.name}`)),
      engine.events.on("colony:warning", (entry) =>
        this.pushAlert(`Warning: morale ${entry.morale.toFixed(0)}`)
      ),
      engine.events.on("save:completed", (entry) => this.pushAlert(`Saved ${entry.slot}`))
    ];
  }

  pushAlert(message) {
    this.alerts.push({
      time: this.scene.time.now,
      message
    });
    this.alerts = this.alerts.slice(-6);
  }

  formatResourceLine(summary) {
    const firstTen = summary
      .slice(0, 10)
      .map((entry) => `${entry.id}:${entry.value.toFixed(0)}/${entry.capacity.toFixed(0)}`)
      .join("  ");
    return firstTen;
  }

  drawMiniMap() {
    const engine = this.gameScene.engine;
    const terrain = engine.getSystem("terrain");
    const ants = engine.getSystem("ants");
    const enemies = engine.getSystem("enemies");

    const width = 184;
    const height = 76;
    const startX = this.scene.scale.width - 192;
    const startY = 8;

    this.miniMapGraphics.clear();

    const sx = width / terrain.width;
    const sy = height / terrain.height;

    this.miniMapGraphics.fillStyle(0x1f2a23, 0.9);
    this.miniMapGraphics.fillRect(startX + 1, startY + 1, width - 2, height - 2);

    this.miniMapGraphics.fillStyle(0x8ab48d, 0.8);
    for (const ant of ants.getAliveAnts()) {
      this.miniMapGraphics.fillRect(startX + ant.x * sx, startY + ant.y * sy, 2, 2);
    }

    this.miniMapGraphics.fillStyle(0xdb6a62, 0.85);
    for (const enemy of enemies.getAliveEnemies()) {
      this.miniMapGraphics.fillRect(startX + enemy.x * sx, startY + enemy.y * sy, 2, 2);
    }
  }

  update(dt) {
    this.refreshClock += dt;
    if (this.refreshClock < 0.2) {
      return;
    }

    this.refreshClock = 0;

    const engine = this.gameScene.engine;
    const resources = engine.getSystem("resources");
    const ants = engine.getSystem("ants");
    const rooms = engine.getSystem("rooms");
    const weather = engine.getSystem("weather");
    const morale = engine.getSystem("morale");
    const debug = engine.getSystem("debug");

    const resourceSummary = resources.getSummary();
    this.resourceText.setText(this.formatResourceLine(resourceSummary));

    this.statusText.setText(
      [
        `Ants ${ants.getAliveAnts().length}`,
        `Rooms ${rooms.rooms.length}`,
        `Weather ${weather.getCurrentWeather().id}`,
        `Season ${weather.getCurrentSeason().id}`,
        `Morale ${morale.morale.toFixed(1)}`,
        `Tool ${this.gameScene.currentTool}`,
        `Build ${this.gameScene.selectedRoomType}`
      ].join("  |  ")
    );

    const latestAlert = this.alerts[this.alerts.length - 1];
    this.alertText.setText(latestAlert ? latestAlert.message : "");

    const showPheromone = debug.toggles.showPheromoneHeatmap;
    this.pheromoneToggle.setColor(showPheromone ? "#9ff2ab" : "#96e5a0");

    this.drawMiniMap();
  }

  destroy() {
    for (const off of this.unsubscribe ?? []) {
      off();
    }
    this.root.destroy(true);
  }
}
