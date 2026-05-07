const DEBUG_TOGGLES = [
  { key: "showFps", label: "FPS" },
  { key: "showEntityCount", label: "Entity Count" },
  { key: "showPathfindingGrid", label: "Path Grid" },
  { key: "showAiStateViewer", label: "AI State Viewer" },
  { key: "showPheromoneHeatmap", label: "Pheromone Heatmap" },
  { key: "showRoomStats", label: "Room Stats" },
  { key: "showResourceFlowGraph", label: "Resource Flow Graph" },
  { key: "showEventLog", label: "Event Log" },
  { key: "enableManualSpawnTools", label: "Manual Spawn" },
  { key: "freeCamera", label: "Free Camera" }
];

export class DebugPanel {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gameScene = gameScene;
    this.visible = false;
    this.toggleRows = [];

    const width = 380;
    const height = 500;
    const x = scene.scale.width - width - 12;
    const y = 102;

    this.root = scene.add.container(x, y).setDepth(320).setVisible(false);
    const bg = scene.add
      .rectangle(0, 0, width, height, 0x080f0d, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6cc493, 0.5);

    const title = scene.add.text(12, 8, "Debug Tools", {
      fontFamily: "Consolas, monospace",
      fontSize: "20px",
      color: "#9cf5be"
    });

    const close = scene.add
      .text(width - 42, 10, "[X]", {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#f0a6a6"
      })
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.close());

    this.metricsText = scene.add.text(12, 54, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "12px",
      color: "#d6e9d7",
      lineSpacing: 2
    });

    this.root.add([bg, title, close, this.metricsText]);

    let yOffset = 192;
    for (const toggle of DEBUG_TOGGLES) {
      const line = scene.add
        .text(12, yOffset, "", {
          fontFamily: "Consolas, monospace",
          fontSize: "13px",
          color: "#afe6ba"
        })
        .setInteractive({ useHandCursor: true });

      line.on("pointerdown", () => {
        this.getDebugSystem().toggle(toggle.key);
        this.refreshToggleRows();
      });

      this.toggleRows.push({
        ...toggle,
        node: line
      });
      this.root.add(line);
      yOffset += 24;
    }

    this.spawnAntButton = scene.add
      .text(12, height - 64, "[Spawn Random Ant]", {
        fontFamily: "Consolas, monospace",
        fontSize: "13px",
        color: "#9ed9ff"
      })
      .setInteractive({ useHandCursor: true });

    this.spawnEnemyButton = scene.add
      .text(200, height - 64, "[Spawn Random Enemy]", {
        fontFamily: "Consolas, monospace",
        fontSize: "13px",
        color: "#ffb7b1"
      })
      .setInteractive({ useHandCursor: true });

    this.spawnAntButton.on("pointerdown", () => {
      const ants = this.gameScene.engine.getSystem("ants");
      const unlocked = ants.getUnlockedTypeIds();
      const typeId = unlocked[Math.floor(Math.random() * unlocked.length)] ?? "basic_worker";
      this.getDebugSystem().spawnAnt(typeId);
    });

    this.spawnEnemyButton.on("pointerdown", () => {
      const enemies = this.gameScene.engine.getSystem("enemies");
      const ids = Array.from(enemies.enemyTypeMap.keys());
      const id = ids[Math.floor(Math.random() * ids.length)] ?? "spider";
      this.getDebugSystem().spawnEnemy(id);
    });

    this.root.add([this.spawnAntButton, this.spawnEnemyButton]);
    this.refreshToggleRows();
  }

  getDebugSystem() {
    return this.gameScene.engine.getSystem("debug");
  }

  refreshToggleRows() {
    const debug = this.getDebugSystem();
    for (const row of this.toggleRows) {
      const enabled = debug.toggles[row.key];
      row.node.setText(`[${enabled ? "x" : " "}] ${row.label}`);
      row.node.setColor(enabled ? "#b9f8be" : "#84ae90");
    }
  }

  open() {
    this.visible = true;
    this.root.setVisible(true);
    this.refreshToggleRows();
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

    const snapshot = this.getDebugSystem().getSnapshot();
    const metrics = snapshot.metrics;

    const stateEntries = Object.entries(metrics.aiStateCounts ?? {})
      .slice(0, 6)
      .map(([state, count]) => `${state}:${count}`)
      .join("  ");

    const roomEntries = Object.entries(metrics.roomCounts ?? {})
      .slice(0, 5)
      .map(([id, count]) => `${id}:${count}`)
      .join("  ");

    this.metricsText.setText([
      `FPS: ${metrics.fps?.toFixed?.(1) ?? 0}`,
      `Ants: ${metrics.ants}  Enemies: ${metrics.enemies}  Rooms: ${metrics.rooms}`,
      `Path Queries: ${metrics.pathfindingQueries}`,
      `Path AvgVisited: ${(metrics.pathfindingAvgVisited ?? 0).toFixed?.(1) ?? 0}`,
      `Path Cache H/M: ${metrics.pathfindingCacheHits ?? 0}/${metrics.pathfindingCacheMisses ?? 0}`,
      `Path Failures: ${metrics.pathfindingFailedQueries ?? 0}`,
      `Pheromone Tiles: ${metrics.pheromoneTiles}`,
      `AI: ${stateEntries || "n/a"}`,
      `Queues H/I/F: ${metrics.aiQueues?.haul ?? 0}/${metrics.aiQueues?.intercept ?? 0}/${metrics.aiQueues?.frontier ?? 0}`,
      `Rooms: ${roomEntries || "n/a"}`,
      "",
      "Debug overlays can be toggled below."
    ]);

    this.refreshToggleRows();
  }
}
