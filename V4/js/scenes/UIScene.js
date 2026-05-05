import {
  ANT_TYPES,
  GAME_SPEED_STEPS,
  HUD_CONFIG,
  ROLE,
  ROOM_KIND,
  ROOM_TYPES,
  TOOL_MODE
} from "../core/constants.js";
import { MobileSupport } from "../core/mobileSupport.js";

export class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
  }

  create() {
    MobileSupport.attachSceneHelpers(this);
    this.gameScene = this.scene.get("GameScene");
    this.settings = this.registry.get("settings");
    this.selectedRole = ROLE.WORKER;
    this.selectedBuild = ROOM_KIND.BROOD;
    this.messageTimer = 0;
    this.toolButtons = [];

    const viewport = this.getViewport?.() || MobileSupport.getViewport();
    this.safeArea = viewport.safeArea || { top: 0, right: 0, bottom: 0, left: 0 };
    this.isMobileLayout =
      this.isMobileDevice || this.scale.width <= 1024 || this.settings.get("compactHud");

    const w = this.scale.width;
    const h = this.scale.height;
    const hudPreset = this.isMobileLayout ? HUD_CONFIG.mobile : HUD_CONFIG.desktop;
    const topBarHeight = hudPreset.topBarHeight;
    const topBarY = this.safeArea.top + topBarHeight / 2;

    this.topBar = this.add.rectangle(w / 2, topBarY, w, topBarHeight, 0x1e1712, 0.92).setDepth(500);

    const infoFont = `${hudPreset.infoFontSize}px`;
    if (this.isMobileLayout) {
      const row1Y = this.safeArea.top + 8;
      const row2Y = this.safeArea.top + 32;
      this.foodText = this.add.text(this.safeArea.left + 12, row1Y, "", {
        fontSize: infoFont,
        color: "#f5ead6",
        fontStyle: "bold"
      });
      this.popText = this.add.text(Math.floor(w * 0.32), row1Y, "", {
        fontSize: infoFont,
        color: "#f5ead6",
        fontStyle: "bold"
      });
      this.moraleText = this.add.text(Math.floor(w * 0.62), row1Y, "", {
        fontSize: infoFont,
        color: "#f5ead6",
        fontStyle: "bold"
      });
      this.timeText = this.add.text(this.safeArea.left + 12, row2Y, "", {
        fontSize: infoFont,
        color: "#dec8a3",
        fontStyle: "bold"
      });
      this.waveText = this.add.text(Math.floor(w * 0.42), row2Y, "", {
        fontSize: infoFont,
        color: "#dec8a3",
        fontStyle: "bold"
      });
      this.helpBox = this.add.rectangle(w / 2, topBarY, w, topBarHeight, 0x000000, 0).setDepth(500);
      this.helpText = this.add.text(this.safeArea.left + 12, row2Y + 20, "", {
        fontSize: `${hudPreset.helpFontSize}px`,
        color: "#dec8a3"
      });
      this.helpText.setVisible(true);
    } else {
      this.foodText = this.add
        .text(18, this.safeArea.top + 10, "", {
          fontSize: infoFont,
          color: "#f5ead6",
          fontStyle: "bold"
        })
        .setDepth(501);
      this.popText = this.add
        .text(220, this.safeArea.top + 10, "", {
          fontSize: infoFont,
          color: "#f5ead6",
          fontStyle: "bold"
        })
        .setDepth(501);
      this.moraleText = this.add
        .text(450, this.safeArea.top + 10, "", {
          fontSize: infoFont,
          color: "#f5ead6",
          fontStyle: "bold"
        })
        .setDepth(501);
      this.timeText = this.add
        .text(660, this.safeArea.top + 10, "", {
          fontSize: infoFont,
          color: "#f5ead6",
          fontStyle: "bold"
        })
        .setDepth(501);
      this.waveText = this.add
        .text(860, this.safeArea.top + 10, "", {
          fontSize: infoFont,
          color: "#f5ead6",
          fontStyle: "bold"
        })
        .setDepth(501);

      this.helpBox = this.add
        .rectangle(1110, this.safeArea.top + 24, 620, 48, 0x33261d, 0.9)
        .setOrigin(0.5, 0.5)
        .setDepth(500);
      this.helpText = this.add
        .text(860, this.safeArea.top + 10, "", {
          fontSize: `${hudPreset.helpFontSize}px`,
          color: "#dec8a3"
        })
        .setDepth(501);
    }

    const panelY = h - this.safeArea.bottom - (this.isMobileLayout ? 132 : 108);
    this.bottomPanel = this.add
      .rectangle(
        260,
        panelY,
        this.isMobileLayout ? 0 : 560,
        this.isMobileLayout ? 0 : 230,
        0x1f1813,
        0.94
      )
      .setStrokeStyle(this.isMobileLayout ? 0 : 2, 0x624d39, 1)
      .setDepth(500);

    this.toolLabel = this.add
      .text(26, panelY - 120, "Tools", {
        fontSize: this.isMobileLayout ? "0px" : "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501)
      .setVisible(!this.isMobileLayout);

    this.roleLabel = this.add
      .text(26, panelY - 58, "Assign Roles", {
        fontSize: this.isMobileLayout ? "0px" : "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501)
      .setVisible(!this.isMobileLayout);

    this.buildLabel = this.add
      .text(26, panelY + 4, "Build Rooms", {
        fontSize: this.isMobileLayout ? "0px" : "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501)
      .setVisible(!this.isMobileLayout);

    this.debugText = this.add
      .text(this.scale.width - 280, this.safeArea.top + 58, "", {
        fontSize: "14px",
        color: "#d8f2d0",
        backgroundColor: "#172012cc",
        padding: { x: 8, y: 6 }
      })
      .setDepth(520)
      .setVisible(false);

    this.messageText = this.add
      .text(this.scale.width / 2, this.safeArea.top + topBarHeight + 8, "", {
        fontSize: `${hudPreset.messageFontSize}px`,
        color: "#fff4d8",
        fontStyle: "bold",
        backgroundColor: "#3a2c18cc",
        padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5, 0)
      .setDepth(510)
      .setVisible(false);

    if (!this.isMobileLayout) {
      this.createToolButtons(panelY);
      this.createRoleButtons(panelY);
      this.createBuildButtons(panelY);
    }
    this.createUtilityButtons(panelY);

    if (this.isMobileLayout) {
      this.createMobileControls();
    }

    this.input.keyboard.on("keydown-H", () => this.toggleTutorial());
    this.input.keyboard.on("keydown-P", () => this.togglePause());
    this.input.keyboard.on("keydown-F3", () => this.toggleDebug());
    this.events.on("wake", () => this.syncRefs());
  }

  syncRefs() {
    this.gameScene = this.scene.get("GameScene");
  }

  createRoleButtons(panelY) {
    const roles = [ROLE.WORKER, ROLE.SOLDIER, ROLE.NURSE, ROLE.SCOUT];
    let x = 120;
    roles.forEach((role) => {
      const btn = this.makeButton(x, panelY - 28, 86, 36, ANT_TYPES[role].label, () => {
        this.gameScene.assignRole(role);
      });
      x += 100;
      btn.bg.setFillStyle(ANT_TYPES[role].color);
      btn.label.setColor("#fff7ea");
    });
  }

  createToolButtons(panelY) {
    const tools = [
      {
        label: "Select",
        width: 92,
        mode: TOOL_MODE.SELECT,
        onClick: () => {
          this.gameScene.setSelectTool();
          this.flashMessage("Tool: Select");
        }
      },
      {
        label: "Dig",
        width: 76,
        mode: TOOL_MODE.DIG,
        onClick: () => {
          this.gameScene.setDigTool();
          this.flashMessage("Tool: Dig");
        }
      },
      {
        label: "Build",
        width: 84,
        mode: TOOL_MODE.BUILD,
        onClick: () => {
          this.gameScene.setBuildMode(this.selectedBuild);
          this.flashMessage(`Build: ${ROOM_TYPES[this.selectedBuild].label}`);
        }
      },
      {
        label: "Undo",
        width: 72,
        onClick: () => {
          this.gameScene.undoLastDigOrder();
        }
      },
      {
        label: "Clear",
        width: 76,
        onClick: () => {
          this.gameScene.clearDigOrders();
        }
      }
    ];

    let x = 74;
    for (const tool of tools) {
      const btn = this.makeButton(x, panelY - 86, tool.width, 34, tool.label, tool.onClick);
      if (tool.mode) {
        this.toolButtons.push({ mode: tool.mode, bg: btn.bg, label: btn.label });
      }
      x += tool.width + 10;
    }
  }

  createBuildButtons(panelY) {
    const rooms = [ROOM_KIND.BROOD, ROOM_KIND.STORAGE, ROOM_KIND.BARRACKS, ROOM_KIND.UTILITY];
    let x = 120;
    rooms.forEach((room) => {
      const btn = this.makeButton(
        x,
        panelY + 30,
        86,
        36,
        ROOM_TYPES[room]?.label || "Utility",
        () => {
          this.selectedBuild = room;
          this.gameScene.setBuildMode(room);
          if (this.gameScene.currentTool === TOOL_MODE.BUILD) {
            this.flashMessage(`Build mode: ${ROOM_TYPES[room]?.label || room}`);
          } else {
            this.flashMessage("Build cancelled");
          }
        }
      );
      x += 100;
      btn.bg.setFillStyle(ROOM_TYPES[room]?.color || 0x5a7d44);
      btn.label.setColor("#22170f");
    });
  }

  createUtilityButtons(panelY) {
    if (this.isMobileLayout) {
      this.makeButton(
        this.scale.width - this.safeArea.right - 140,
        this.safeArea.top + 62,
        90,
        30,
        "Save",
        () => {
          const ok = this.gameScene.saveCurrentGame();
          this.flashMessage(ok ? "Game saved." : "Save failed.");
        }
      );
      this.makeButton(
        this.scale.width - this.safeArea.right - 44,
        this.safeArea.top + 62,
        76,
        30,
        "Help",
        () => this.toggleTutorial()
      );
      return;
    }

    this.makeButton(this.scale.width - 390, panelY + 22, 90, 40, "Pause", () => this.togglePause());
    this.makeButton(this.scale.width - 290, panelY + 22, 90, 40, "Cancel", () => {
      this.gameScene.clearBuildMode();
      this.flashMessage("Build cancelled");
    });
    this.makeButton(this.scale.width - 190, panelY + 22, 90, 40, "Save", () => {
      const ok = this.gameScene.saveCurrentGame();
      this.flashMessage(ok ? "Game saved." : "Save failed.");
    });
    this.makeButton(this.scale.width - 90, panelY + 22, 90, 40, "Help", () =>
      this.toggleTutorial()
    );
  }

  createMobileControls() {
    const rooms = [ROOM_KIND.BROOD, ROOM_KIND.STORAGE, ROOM_KIND.BARRACKS, ROOM_KIND.UTILITY];
    const roles = [ROLE.WORKER, ROLE.SOLDIER, ROLE.NURSE, ROLE.SCOUT];

    const cycleBuild = () => {
      const idx = rooms.indexOf(this.selectedBuild);
      this.selectedBuild = rooms[(idx + 1 + rooms.length) % rooms.length];
      this.gameScene.setBuildMode(this.selectedBuild);
      this.flashMessage(`Build: ${ROOM_TYPES[this.selectedBuild].label}`);
    };

    const cycleRole = () => {
      const idx = roles.indexOf(this.selectedRole);
      this.selectedRole = roles[(idx + 1 + roles.length) % roles.length];
      this.gameScene.assignRole(this.selectedRole);
      this.flashMessage(`Role: ${ANT_TYPES[this.selectedRole].label}`);
    };

    const cycleSpeed = () => {
      const current = this.settings.get("gameSpeed");
      const idx = GAME_SPEED_STEPS.indexOf(current);
      const next = GAME_SPEED_STEPS[(idx + 1 + GAME_SPEED_STEPS.length) % GAME_SPEED_STEPS.length];
      this.settings.set("gameSpeed", next);
      this.flashMessage(`Speed: ${next}x`);
    };

    this.mobileBar = this.createMobileActionBar([
      {
        label: "Select",
        onClick: () => {
          this.gameScene.setSelectTool();
          this.flashMessage("Tool: Select");
        }
      },
      {
        label: "Dig",
        onClick: () => {
          this.gameScene.setDigTool();
          this.flashMessage("Tool: Dig");
        }
      },
      {
        label: "Build",
        onClick: () => {
          this.gameScene.setBuildMode(this.selectedBuild);
          if (this.gameScene.currentTool === TOOL_MODE.BUILD) {
            this.flashMessage(`Build: ${ROOM_TYPES[this.selectedBuild].label}`);
          } else {
            this.flashMessage("Build cancelled");
          }
        }
      },
      { label: "Room", onClick: cycleBuild },
      { label: "Role", onClick: cycleRole },
      { label: "Speed", onClick: cycleSpeed },
      {
        label: "Undo",
        onClick: () => {
          this.gameScene.undoLastDigOrder();
        }
      },
      { label: "Pause", onClick: () => this.togglePause() }
    ]);
  }

  updateToolButtonStates() {
    if (!this.toolButtons || this.toolButtons.length === 0) return;
    for (const item of this.toolButtons) {
      const active = this.gameScene?.currentTool === item.mode;
      item.bg.setFillStyle(active ? 0xe2a248 : 0x4b392c, 1);
      item.bg.setStrokeStyle(active ? 2 : 1, active ? 0xf8dcb0 : 0x8d6d46, 1);
      item.label.setColor(active ? "#26180d" : "#fff6e6");
    }
  }

  makeButton(x, y, w, h, label, cb) {
    const bg = this.add
      .rectangle(x, y, w, h, 0x4b392c, 1)
      .setStrokeStyle(1, 0x8d6d46, 1)
      .setDepth(501)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, {
        fontSize: h <= 30 ? "12px" : "14px",
        color: "#fff6e6",
        fontStyle: "bold",
        align: "center"
      })
      .setOrigin(0.5)
      .setDepth(502);

    bg.on("pointerover", () => bg.setFillStyle(0x624832));
    bg.on("pointerout", () => bg.setFillStyle(0x4b392c));
    bg.on("pointerdown", cb);
    return { bg, label: txt };
  }

  togglePause() {
    if (this.scene.isActive("PauseScene")) {
      this.scene.stop("PauseScene");
      this.scene.resume("GameScene");
      this.scene.resume();
    } else {
      this.scene.pause("GameScene");
      this.scene.launch("PauseScene");
      this.scene.pause();
    }
  }

  toggleDebug() {
    this.gameScene.debugEnabled = !this.gameScene.debugEnabled;
    this.debugText.setVisible(this.gameScene.debugEnabled);
  }

  toggleTutorial() {
    this.gameScene.helpVisible = !this.gameScene.helpVisible;
  }

  flashMessage(msg) {
    this.messageText.setText(msg).setVisible(true);
    this.messageTimer = 2.5;
  }

  update(_, dtMs) {
    if (!this.gameScene || !this.gameScene.scene.isActive()) return;
    const g = this.gameScene;
    const dt = dtMs / 1000;

    this.foodText.setText(`Food: ${Math.floor(g.resources.food)} / ${g.resources.foodCap}`);
    this.popText.setText(`Pop: ${g.antManager.ants.length} / ${g.resources.populationCap}`);
    this.moraleText.setText(`Morale: ${Math.floor(g.resources.morale)}`);
    this.timeText.setText(`Time: ${g.formatTime(g.resources.timeSurvived)}`);
    this.waveText.setText(`Wave: ${g.enemyManager.wave}`);

    if (!this.isMobileLayout) {
      const selectedCount = g.antManager.selectedAnts().length;
      const hint = this.settings.get("showControlHints")
        ? " | Q/E/R tools | drag in Select mode | right-click move"
        : "";
      this.helpText.setText(
        `Tool: ${g.getToolLabel().toUpperCase()} | Selected: ${selectedCount} | Build: ${(
          g.currentBuildMode || "none"
        ).toUpperCase()} | Dig Queue: ${g.pendingDigOrders.length}${hint}`
      );
    } else {
      const selectedCount = g.antManager.selectedAnts().length;
      const hint = this.settings.get("showControlHints") ? " | tap toolbar" : "";
      this.helpText.setText(
        `Tool: ${g.getToolLabel()} | Sel: ${selectedCount} | Queue: ${g.pendingDigOrders.length}${hint}`
      );
    }

    this.updateToolButtonStates();

    if (g.debugEnabled) {
      const fps = Math.round(this.game.loop.actualFps);
      this.debugText.setText(
        `Workers: ${g.antManager.countByRole(ROLE.WORKER)}\n` +
          `Soldiers: ${g.antManager.countByRole(ROLE.SOLDIER)}\n` +
          `Nurses: ${g.antManager.countByRole(ROLE.NURSE)}\n` +
          `Scouts: ${g.antManager.countByRole(ROLE.SCOUT)}\n` +
          `Enemies: ${g.enemyManager.enemies.length}\n` +
          `Wave Timer: ${g.enemyManager.waveTimer.toFixed(1)}\n` +
          `FPS: ${fps}`
      );
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageText.setVisible(false);
    }

    if (g.uiMessage && g.uiMessageTime > 0) {
      this.flashMessage(g.uiMessage);
      g.uiMessageTime = 0;
    }
  }
}
