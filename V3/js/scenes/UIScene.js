class UIScene extends Phaser.Scene {
  constructor() {
    super("UIScene");
  }

  create() {
    MobileSupport.attachSceneHelpers(this);
    this.gameScene = this.scene.get("GameScene");
    this.selectedRole = ROLE.WORKER;
    this.selectedBuild = ROOM_KIND.BROOD;
    this.messageTimer = 0;
    this.isMobileLayout = this.isMobileDevice || this.scale.width <= 1024;

    const w = this.scale.width;

    this.topBar = this.add.rectangle(w / 2, 24, w, 48, 0x1e1712, 0.92).setDepth(500);
    this.foodText = this.add
      .text(18, 10, "", {
        fontSize: "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501);
    this.popText = this.add
      .text(220, 10, "", {
        fontSize: "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501);
    this.moraleText = this.add
      .text(450, 10, "", {
        fontSize: "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501);
    this.timeText = this.add
      .text(660, 10, "", {
        fontSize: "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501);
    this.waveText = this.add
      .text(860, 10, "", {
        fontSize: "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501);

    this.helpBox = this.add
      .rectangle(1110, 24, 620, 48, 0x33261d, 0.9)
      .setOrigin(0.5, 0.5)
      .setDepth(500);
    this.helpText = this.add
      .text(860, 10, "", { fontSize: "15px", color: "#dec8a3" })
      .setDepth(501);

    this.bottomPanel = this.add
      .rectangle(240, this.scale.height - 90, 470, 170, 0x1f1813, 0.94)
      .setStrokeStyle(2, 0x624d39, 1)
      .setDepth(500);

    this.roleLabel = this.add
      .text(26, this.scale.height - 162, "Assign Roles", {
        fontSize: "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501);

    this.buildLabel = this.add
      .text(26, this.scale.height - 96, "Build Rooms", {
        fontSize: "18px",
        color: "#f5ead6",
        fontStyle: "bold"
      })
      .setDepth(501);

    this.debugText = this.add
      .text(this.scale.width - 250, 58, "", {
        fontSize: "14px",
        color: "#d8f2d0",
        backgroundColor: "#172012cc",
        padding: { x: 8, y: 6 }
      })
      .setDepth(520)
      .setVisible(false);

    this.messageText = this.add
      .text(this.scale.width / 2, 66, "", {
        fontSize: "20px",
        color: "#fff4d8",
        fontStyle: "bold",
        backgroundColor: "#3a2c18cc",
        padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5, 0)
      .setDepth(510)
      .setVisible(false);

    this.createRoleButtons();
    this.createBuildButtons();
    this.createUtilityButtons();

    if (this.isMobileLayout) {
      const cycleBuild = () => {
        const rooms = [ROOM_KIND.BROOD, ROOM_KIND.STORAGE, ROOM_KIND.BARRACKS, ROOM_KIND.UTILITY];
        const idx = rooms.indexOf(this.selectedBuild);
        this.selectedBuild = rooms[(idx + 1 + rooms.length) % rooms.length];
        this.gameScene.setBuildMode(this.selectedBuild);
        this.flashMessage(`Build: ${ROOM_TYPES[this.selectedBuild].label}`);
      };

      this.mobileBar = this.createMobileActionBar([
        {
          label: "Dig",
          onClick: () => {
            this.gameScene.currentBuildMode = null;
            this.gameScene.currentTool = "dig";
            this.flashMessage("Tool: Dig");
          }
        },
        {
          label: "Build",
          onClick: () => {
            this.gameScene.currentTool = "build";
            this.gameScene.setBuildMode(this.selectedBuild);
            this.flashMessage(`Build: ${ROOM_TYPES[this.selectedBuild].label}`);
          }
        },
        { label: "Room", onClick: cycleBuild },
        { label: "Pause", onClick: () => this.togglePause() }
      ]);
    }

    this.input.keyboard.on("keydown-H", () => this.toggleTutorial());
    this.input.keyboard.on("keydown-P", () => this.togglePause());
    this.input.keyboard.on("keydown-F3", () => this.toggleDebug());
    this.events.on("wake", () => this.syncRefs());
  }

  syncRefs() {
    this.gameScene = this.scene.get("GameScene");
  }

  createRoleButtons() {
    const roles = [ROLE.WORKER, ROLE.SOLDIER, ROLE.NURSE, ROLE.SCOUT];
    let x = 120;
    roles.forEach((role) => {
      const btn = this.makeButton(x, this.scale.height - 130, 86, 36, ANT_TYPES[role].label, () => {
        this.gameScene.assignRole(role);
      });
      x += 100;
      btn.bg.setFillStyle(ANT_TYPES[role].color);
      btn.label.setColor("#fff7ea");
    });
  }

  createBuildButtons() {
    const rooms = [ROOM_KIND.BROOD, ROOM_KIND.STORAGE, ROOM_KIND.BARRACKS, ROOM_KIND.UTILITY];
    let x = 120;
    rooms.forEach((room) => {
      const btn = this.makeButton(
        x,
        this.scale.height - 66,
        86,
        36,
        ROOM_TYPES[room]?.label || "Utility",
        () => {
          this.gameScene.setBuildMode(room);
          this.flashMessage(`Build mode: ${ROOM_TYPES[room]?.label || room}`);
        }
      );
      x += 100;
      btn.bg.setFillStyle(ROOM_TYPES[room]?.color || 0x5a7d44);
      btn.label.setColor("#22170f");
    });
  }

  createUtilityButtons() {
    this.makeButton(this.scale.width - 300, this.scale.height - 74, 90, 40, "Pause", () =>
      this.togglePause()
    );
    this.makeButton(this.scale.width - 200, this.scale.height - 74, 90, 40, "Save", () => {
      const ok = this.gameScene.saveCurrentGame();
      this.flashMessage(ok ? "Game saved." : "Save failed.");
    });
    this.makeButton(this.scale.width - 100, this.scale.height - 74, 90, 40, "Help", () =>
      this.toggleTutorial()
    );
  }

  makeButton(x, y, w, h, label, cb) {
    const bg = this.add
      .rectangle(x, y, w, h, 0x4b392c, 1)
      .setStrokeStyle(1, 0x8d6d46, 1)
      .setDepth(501)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, {
        fontSize: "14px",
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
    this.popText.setText(`Population: ${g.antManager.ants.length} / ${g.resources.populationCap}`);
    this.moraleText.setText(`Morale: ${Math.floor(g.resources.morale)}`);
    this.timeText.setText(`Time: ${g.formatTime(g.resources.timeSurvived)}`);
    this.waveText.setText(`Wave: ${g.enemyManager.wave}`);

    this.helpText.setText(
      `Priority: ${g.globalPriority.toUpperCase()} | Build: ${(
        g.currentBuildMode || "none"
      ).toUpperCase()} | ` + `Drag-select ants, right-click to move, left-click dirt to dig/build`
    );

    if (g.debugEnabled) {
      const fps = Math.round(this.game.loop.actualFps);
      this.debugText.setText(
        `Workers: ${g.antManager.countByRole(ROLE.WORKER)}
` +
          `Soldiers: ${g.antManager.countByRole(ROLE.SOLDIER)}
` +
          `Nurses: ${g.antManager.countByRole(ROLE.NURSE)}
` +
          `Scouts: ${g.antManager.countByRole(ROLE.SCOUT)}
` +
          `Enemies: ${g.enemyManager.enemies.length}
` +
          `Wave Timer: ${g.enemyManager.waveTimer.toFixed(1)}
` +
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

