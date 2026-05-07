function statusPrefix(techState) {
  if (techState === "researched") {
    return "[x]";
  }
  if (techState === "current") {
    return "[>]";
  }
  if (techState === "available") {
    return "[ ]";
  }
  return "[lock]";
}

function statusColor(techState) {
  if (techState === "researched") {
    return "#a8e1a4";
  }
  if (techState === "current") {
    return "#f2e39c";
  }
  if (techState === "available") {
    return "#cbe7c7";
  }
  return "#7f9982";
}

export class TechPanel {
  constructor(scene, gameScene) {
    this.scene = scene;
    this.gameScene = gameScene;
    this.visible = false;
    this.rows = [];
    this.maxRows = 14;

    const panelWidth = 560;
    const panelHeight = Math.min(scene.scale.height - 26, 560);
    const x = scene.scale.width * 0.5 - panelWidth * 0.5;
    const y = scene.scale.height * 0.5 - panelHeight * 0.5;

    this.root = scene.add.container(x, y).setDepth(340).setVisible(false);

    const bg = scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x0a1310, 0.97)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xa0c58a, 0.5);

    const title = scene.add.text(14, 10, "Tech Tree", {
      fontFamily: "Consolas, monospace",
      fontSize: "21px",
      color: "#e8efbb"
    });

    const close = scene.add
      .text(panelWidth - 45, 10, "[X]", {
        fontFamily: "Consolas, monospace",
        fontSize: "18px",
        color: "#f4a5a5"
      })
      .setInteractive({ useHandCursor: true });

    close.on("pointerdown", () => this.close());

    this.progressText = scene.add.text(16, 44, "", {
      fontFamily: "Consolas, monospace",
      fontSize: "12px",
      color: "#d8ebce"
    });

    this.hintText = scene.add.text(16, panelHeight - 24, "Click available tech to start research", {
      fontFamily: "Consolas, monospace",
      fontSize: "11px",
      color: "#8fae91"
    });

    this.root.add([bg, title, close, this.progressText, this.hintText]);

    let yOffset = 86;
    for (let i = 0; i < this.maxRows; i += 1) {
      const line = scene.add
        .text(14, yOffset, "", {
          fontFamily: "Consolas, monospace",
          fontSize: "12px",
          color: "#cbe7c7"
        })
        .setInteractive({ useHandCursor: true });

      line.on("pointerdown", () => {
        const payload = this.rows[i]?.payload;
        if (!payload) {
          return;
        }

        if (payload.state === "available") {
          this.getTechSystem()?.startResearch(payload.id);
          this.refresh();
        }
      });

      this.rows.push({
        node: line,
        payload: null
      });
      this.root.add(line);
      yOffset += 30;
    }

    this.refresh();
  }

  getTechSystem() {
    return this.gameScene.engine.getSystem("tech");
  }

  getSortedTechRows() {
    const techSystem = this.getTechSystem();
    const output = [];

    for (const tech of techSystem.techMap.values()) {
      let state = "locked";
      if (techSystem.isResearched(tech.id)) {
        state = "researched";
      } else if (techSystem.currentResearchId === tech.id) {
        state = "current";
      } else if (techSystem.canResearch(tech.id)) {
        state = "available";
      }

      output.push({
        id: tech.id,
        name: tech.name,
        category: tech.category ?? "general",
        cost: Number(tech.cost ?? 0),
        state,
        prerequisites: Array.isArray(tech.prerequisites) ? tech.prerequisites : []
      });
    }

    const stateRank = {
      current: 0,
      available: 1,
      locked: 2,
      researched: 3
    };

    output.sort((a, b) => {
      const rankA = stateRank[a.state] ?? 10;
      const rankB = stateRank[b.state] ?? 10;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.cost - b.cost;
    });

    return output;
  }

  refresh() {
    const techSystem = this.getTechSystem();
    const currentTech = techSystem.currentResearchId
      ? techSystem.techMap.get(techSystem.currentResearchId)
      : null;

    if (currentTech) {
      const ratio = Math.min(
        1,
        techSystem.currentProgress / Math.max(1, Number(currentTech.cost ?? 1))
      );
      this.progressText.setText(
        `Current: ${currentTech.name}  ${(ratio * 100).toFixed(0)}%  RP:${techSystem.researchPoints.toFixed(1)}`
      );
    } else {
      this.progressText.setText(`Current: idle  RP:${techSystem.researchPoints.toFixed(1)}`);
    }

    const rows = this.getSortedTechRows();
    for (let i = 0; i < this.maxRows; i += 1) {
      const rowNode = this.rows[i];
      const payload = rows[i] ?? null;
      rowNode.payload = payload;

      if (!payload) {
        rowNode.node.setText("");
        rowNode.node.disableInteractive();
        continue;
      }

      rowNode.node.setText(
        `${statusPrefix(payload.state)} ${payload.category.padEnd(11, " ")} ${payload.name} (${payload.cost})`
      );
      rowNode.node.setColor(statusColor(payload.state));

      if (payload.state === "available") {
        rowNode.node.setInteractive({ useHandCursor: true });
      } else {
        rowNode.node.disableInteractive();
      }
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

  update() {
    if (!this.visible) {
      return;
    }
    this.refresh();
  }
}
