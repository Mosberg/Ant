class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data) {
    this.saveData = data?.saveData || null;
  }

  create() {
    this.settings = this.registry.get("settings");
    this.audio = window.__antAudio = new AudioManager(this.settings);
    this.debugEnabled = false;
    this.helpVisible = true;
    this.globalPriority = "food";
    this.currentBuildMode = null;
    this.currentTool = "dig";
    this.pendingDigOrders = [];
    this.foodSources = [];
    this.roomTypeMap = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(null));
    this.colonyModifiers = {
      soldierPower: 1,
      moraleBonus: 0,
      soldierCap: 4
    };
    this.broodProgress = 0;
    this.unlockMilestones = new Set();
    this.uiMessage = "";
    this.uiMessageTime = 0;

    this.resources = new ResourceManager(this, this.settings.get("difficulty"));
    this.pathfinder = new GridPathfinder(this);
    MobileSupport.attachSceneHelpers(this);

    this.generateMap();
    this.createVisualLayers();
    this.roomManager = new RoomManager(this);
    this.roomManager.createInitialRooms();

    this.antManager = new AntManager(this);
    this.enemyManager = new EnemyManager(this);

    this.entranceTile = { tx: 25, ty: 7 };
    this.map[this.entranceTile.ty][this.entranceTile.tx] = TILE.ENTRANCE;
    this.map[this.entranceTile.ty + 1][this.entranceTile.tx] = TILE.TUNNEL;
    this.map[this.entranceTile.ty + 2][this.entranceTile.tx] = TILE.TUNNEL;

    this.spawnStartingAnts();
    this.spawnInitialFood();

    this.selectionGraphics = this.add.graphics().setDepth(450);
    this.buildPreview = this.add.graphics().setDepth(451);
    this.helpOverlay = this.add.container(0, 0).setDepth(480);
    this.createHelpOverlay();

    this.input.mouse?.disableContextMenu();

    this.dragStart = null;
    this.isDragging = false;

    this.input.on("pointerdown", (pointer) => this.handlePointerDown(pointer));
    this.input.on("pointerup", (pointer) => this.handlePointerUp(pointer));
    this.input.on("pointermove", (pointer) => this.handlePointerMove(pointer));
    if (this.isTouchDevice) {
      this.enablePinchZoom(this.cameras.main, 0.75, 1.35);
    }

    this.createKeyboardShortcuts();

    if (this.saveData) {
      this.restoreSave(this.saveData);
    }

    this.cameras.main.setBackgroundColor("#19120d");
    this.redrawWorld(true);
    this.announce("Colony founded.");
  }

  createKeyboardShortcuts() {
    this.input.keyboard.on("keydown-ONE", () => this.assignRole(ROLE.WORKER));
    this.input.keyboard.on("keydown-TWO", () => this.assignRole(ROLE.SOLDIER));
    this.input.keyboard.on("keydown-THREE", () => this.assignRole(ROLE.NURSE));
    this.input.keyboard.on("keydown-FOUR", () => this.assignRole(ROLE.SCOUT));

    this.input.keyboard.on("keydown-B", () => {
      const rooms = [ROOM_KIND.BROOD, ROOM_KIND.STORAGE, ROOM_KIND.BARRACKS, ROOM_KIND.UTILITY];
      const idx = rooms.indexOf(this.currentBuildMode);
      this.currentBuildMode = rooms[(idx + 1 + rooms.length) % rooms.length];
      this.announce(`Build mode: ${this.currentBuildMode}`);
    });

    this.input.keyboard.on("keydown-SPACE", () => {
      const current = this.settings.get("gameSpeed");
      const next = current === 1 ? 2 : 1;
      this.settings.set("gameSpeed", next);
      this.announce(`Game speed set to ${next}x`);
    });

    this.input.keyboard.on("keydown-H", () => {
      this.helpVisible = !this.helpVisible;
    });

    this.input.keyboard.on("keydown-P", () => {
      this.scene.pause();
      this.scene.launch("PauseScene");
      this.scene.pause("UIScene");
    });

    this.input.keyboard.on("keydown-F", () => {
      this.globalPriority = this.globalPriority === "food" ? "defense" : "food";
      this.announce(`Priority: ${this.globalPriority}`);
    });
  }

  generateMap() {
    this.map = [];

    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (y < SURFACE_ROWS) {
          row.push(TILE.SURFACE);
        } else {
          const rockChance = (y > 24 ? 0.16 : 0.08) + (Math.abs(x - MAP_WIDTH / 2) > 18 ? 0.04 : 0);
          row.push(Math.random() < rockChance ? TILE.ROCK : TILE.DIRT);
        }
      }
      this.map.push(row);
    }

    for (let x = 22; x <= 28; x++) {
      for (let y = 11; y <= 20; y++) {
        this.map[y][x] = TILE.TUNNEL;
      }
    }

    for (let x = 18; x <= 32; x++) {
      this.map[14][x] = TILE.TUNNEL;
      this.map[17][x] = TILE.TUNNEL;
    }

    for (let y = 7; y <= 13; y++) {
      this.map[y][25] = TILE.TUNNEL;
    }
  }

  createVisualLayers() {
    this.worldGfx = this.add.graphics();
    this.fogGfx = this.add.graphics().setDepth(400);
    this.effectGfx = this.add.graphics().setDepth(410);

    this.vision = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(0));
    this.discovered = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false));
  }

  createHelpOverlay() {
    const box = this.add
      .rectangle(720, 440, 760, 300, 0x000000, 0.8)
      .setStrokeStyle(2, 0xb3844f, 1);
    const txt = this.add.text(
      390,
      310,
      `Tutorial

- Left-click dirt with Dig mode to queue tunnel digging.
- Clear tunnel space, then build underground rooms.
- Drag to select ants; right-click to order movement.
- Assign roles with the role buttons or number keys.
- Workers collect food, soldiers defend, nurses hatch faster, scouts reveal more.
- Survive escalating waves; if the queen dies or morale reaches zero, the colony falls.`,
      {
        fontSize: "22px",
        color: "#f5ead8",
        wordWrap: { width: 650 },
        lineSpacing: 8
      }
    );
    this.helpOverlay.add([box, txt]);
  }

  spawnStartingAnts() {
    const queenRoom = this.roomManager.getQueenRoom();
    const c = queenRoom.center();
    this.antManager.spawn(c.tx, c.ty, ROLE.WORKER);
    this.antManager.spawn(c.tx + 1, c.ty, ROLE.WORKER);
    this.antManager.spawn(c.tx - 1, c.ty, ROLE.WORKER);
    this.antManager.spawn(c.tx, c.ty + 1, ROLE.SOLDIER);
    this.antManager.spawn(c.tx, c.ty - 1, ROLE.NURSE);
  }

  spawnInitialFood() {
    for (let i = 0; i < 8; i++) this.spawnFoodSource();
  }

  spawnFoodSource() {
    const tx = Phaser.Math.Between(2, MAP_WIDTH - 3);
    const ty = Phaser.Math.Between(1, SURFACE_ROWS - 2);
    const amount = Phaser.Math.Between(18, 46);
    this.foodSources.push({
      tx,
      ty,
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
      amount
    });
  }

  removeFoodSource(food) {
    Phaser.Utils.Array.Remove(this.foodSources, food);
  }

  getGameSpeed() {
    return this.settings.get("gameSpeed") || 1;
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < MAP_WIDTH && ty < MAP_HEIGHT;
  }

  isWalkable(tx, ty) {
    if (!this.inBounds(tx, ty)) return false;
    const t = this.map[ty][tx];
    return t === TILE.SURFACE || t === TILE.TUNNEL || t === TILE.ROOM || t === TILE.ENTRANCE;
  }

  findNearestFood(x, y) {
    let best = null;
    let bestD = Number.MAX_VALUE;
    for (const food of this.foodSources) {
      const d = Phaser.Math.Distance.Between(x, y, food.x, food.y);
      if (d < bestD) {
        best = food;
        bestD = d;
      }
    }
    return best;
  }

  findBestDepositTile() {
    const storage = this.roomManager.rooms.find((r) => r.type === ROOM_KIND.STORAGE);
    if (!storage) return this.roomManager.getQueenRoom().center();
    return storage.center();
  }

  findNearestRoomTarget(x, y) {
    let best = null;
    let bestD = Number.MAX_VALUE;
    for (const room of this.roomManager.rooms) {
      const c = room.center();
      const px = c.tx * TILE_SIZE + TILE_SIZE / 2;
      const py = c.ty * TILE_SIZE + TILE_SIZE / 2;
      const d = Phaser.Math.Distance.Between(x, y, px, py);
      if (d < bestD) {
        best = room;
        bestD = d;
      }
    }
    return best;
  }

  setBuildMode(roomType) {
    this.currentBuildMode = roomType;
    this.currentTool = "build";
  }

  assignRole(role) {
    const changed = this.antManager.assignRoleToSelection(role);
    if (changed) this.announce(`Assigned ${ANT_TYPES[role].label}`);
  }

  queueDig(tx, ty) {
    if (!this.inBounds(tx, ty)) return;
    if (this.map[ty][tx] !== TILE.DIRT) return;
    const already = this.pendingDigOrders.some((o) => o.tx === tx && o.ty === ty);
    if (!already) {
      this.pendingDigOrders.push({ tx, ty });
      this.announce(`Dig queued at ${tx},${ty}`);
    }
  }

  handlePointerDown(pointer) {
    const tx = Math.floor(pointer.worldX / TILE_SIZE);
    const ty = Math.floor(pointer.worldY / TILE_SIZE);

    if (pointer.rightButtonDown()) return;

    if (pointer.y < 48) return;

    this.dragStart = { x: pointer.worldX, y: pointer.worldY };
    this.isDragging = true;

    if (this.currentTool === "dig" && this.map[ty]?.[tx] === TILE.DIRT) {
      this.queueDig(tx, ty);
    } else if (this.currentTool === "build" && this.currentBuildMode) {
      const room = this.roomManager.roomAt(tx, ty);
      if (room && room.type !== ROOM_KIND.QUEEN) {
        const result = this.roomManager.upgradeRoom(room);
        this.announce(result.ok ? `${room.type} upgraded` : result.reason);
      } else {
        const result = this.roomManager.buildRoom(this.currentBuildMode, tx, ty);
        this.announce(result.ok ? `${this.currentBuildMode} room placed` : result.reason);
      }
    }
  }

  handlePointerMove(pointer) {
    if (!this.isDragging || !this.dragStart) return;
    this.selectionGraphics.clear();
    this.selectionGraphics.lineStyle(1, 0xf0e2a5, 1);
    this.selectionGraphics.fillStyle(0xf0e2a5, 0.08);
    const rect = new Phaser.Geom.Rectangle(
      Math.min(this.dragStart.x, pointer.worldX),
      Math.min(this.dragStart.y, pointer.worldY),
      Math.abs(pointer.worldX - this.dragStart.x),
      Math.abs(pointer.worldY - this.dragStart.y)
    );
    this.selectionGraphics.fillRectShape(rect);
    this.selectionGraphics.strokeRectShape(rect);

    this.drawBuildPreview(pointer.worldX, pointer.worldY);
  }

  handlePointerUp(pointer) {
    const tx = Math.floor(pointer.worldX / TILE_SIZE);
    const ty = Math.floor(pointer.worldY / TILE_SIZE);

    if (pointer.rightButtonReleased()) {
      const selected = this.antManager.selectedAnts();
      for (const ant of selected) {
        ant.moveTarget = { tx, ty };
      }
      return;
    }

    if (this.dragStart) {
      const rect = new Phaser.Geom.Rectangle(
        Math.min(this.dragStart.x, pointer.worldX),
        Math.min(this.dragStart.y, pointer.worldY),
        Math.abs(pointer.worldX - this.dragStart.x),
        Math.abs(pointer.worldY - this.dragStart.y)
      );
      if (rect.width > 4 || rect.height > 4) {
        this.antManager.selectInRect(rect);
      }
    }

    this.isDragging = false;
    this.dragStart = null;
    this.selectionGraphics.clear();
  }

  drawBuildPreview(worldX, worldY) {
    this.buildPreview.clear();
    if (this.currentTool !== "build" || !this.currentBuildMode) return;
    const def = ROOM_TYPES[this.currentBuildMode];
    if (!def) return;
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    const ok = this.roomManager.canPlaceRoom(this.currentBuildMode, tx, ty);
    this.buildPreview.lineStyle(2, ok ? 0x79d26d : 0xd96b6b, 1);
    this.buildPreview.fillStyle(ok ? 0x79d26d : 0xd96b6b, 0.18);
    this.buildPreview.fillRect(
      tx * TILE_SIZE,
      ty * TILE_SIZE,
      def.size.w * TILE_SIZE,
      def.size.h * TILE_SIZE
    );
    this.buildPreview.strokeRect(
      tx * TILE_SIZE,
      ty * TILE_SIZE,
      def.size.w * TILE_SIZE,
      def.size.h * TILE_SIZE
    );
  }

  revealAround(unit, radius) {
    const tileRadius = Math.ceil(radius / TILE_SIZE);
    const pos = unit.getTilePos ? unit.getTilePos() : { tx: unit.tx, ty: unit.ty };

    for (let y = pos.ty - tileRadius; y <= pos.ty + tileRadius; y++) {
      for (let x = pos.tx - tileRadius; x <= pos.tx + tileRadius; x++) {
        if (!this.inBounds(x, y)) continue;
        const dist = Phaser.Math.Distance.Between(x, y, pos.tx, pos.ty);
        if (dist <= tileRadius) {
          this.vision[y][x] = Math.max(this.vision[y][x], 1);
          this.discovered[y][x] = true;
        }
      }
    }
  }

  redrawWorld(force = false) {
    this.worldGfx.clear();
    this.worldGfx.fillStyle(0x17100c, 1);
    this.worldGfx.fillRect(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        let c = 0x000000;

        switch (this.map[y][x]) {
          case TILE.SURFACE:
            c = 0x5d8a3a;
            break;
          case TILE.DIRT:
            c = 0x67462a;
            break;
          case TILE.TUNNEL:
            c = 0x3d2b1d;
            break;
          case TILE.ROCK:
            c = 0x4d4a49;
            break;
          case TILE.ROOM:
            c = this.getRoomColor(this.roomTypeMap[y][x]);
            break;
          case TILE.ENTRANCE:
            c = 0xc9b483;
            break;
        }

        this.worldGfx.fillStyle(c, 1);
        this.worldGfx.fillRect(px, py, TILE_SIZE - 1, TILE_SIZE - 1);

        if (this.map[y][x] === TILE.SURFACE) {
          this.worldGfx.fillStyle(0x7ab24c, 0.14);
          this.worldGfx.fillRect(px + 2, py + 2, TILE_SIZE - 6, TILE_SIZE - 12);
        }
      }
    }

    for (const food of this.foodSources) {
      this.worldGfx.fillStyle(0xa9d84c, 1);
      this.worldGfx.fillCircle(food.x, food.y, 7);
      this.worldGfx.fillStyle(0xdceb84, 1);
      this.worldGfx.fillCircle(food.x + 3, food.y - 2, 3);
    }

    if (force || this.settings.get("graphicsDetail")) {
      this.drawMinimap();
    }
  }

  drawMinimap() {
    if (this.minimapGfx) this.minimapGfx.destroy();
    this.minimapGfx = this.add.graphics().setDepth(500);
    const scale = 4;
    const width = MAP_WIDTH * scale;
    const height = MAP_HEIGHT * scale;
    const ox = this.scale.width - width - 18;
    const oy = 76;

    this.minimapGfx.fillStyle(0x150f0b, 0.9);
    this.minimapGfx.fillRoundedRect(ox - 8, oy - 8, width + 16, height + 16, 8);
    this.minimapGfx.lineStyle(1, 0x8d704b, 1);
    this.minimapGfx.strokeRoundedRect(ox - 8, oy - 8, width + 16, height + 16, 8);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        let color = 0x000000;
        switch (this.map[y][x]) {
          case TILE.SURFACE:
            color = 0x5e8c3b;
            break;
          case TILE.DIRT:
            color = 0x5b3e29;
            break;
          case TILE.TUNNEL:
            color = 0x3a281b;
            break;
          case TILE.ROCK:
            color = 0x515151;
            break;
          case TILE.ROOM:
            color = this.getRoomColor(this.roomTypeMap[y][x]);
            break;
          case TILE.ENTRANCE:
            color = 0xd8bf8a;
            break;
        }
        this.minimapGfx.fillStyle(color, 1);
        this.minimapGfx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }

    for (const ant of this.antManager.ants) {
      const tp = ant.getTilePos();
      this.minimapGfx.fillStyle(0xf8edd0, 1);
      this.minimapGfx.fillRect(ox + tp.tx * scale, oy + tp.ty * scale, scale, scale);
    }

    for (const enemy of this.enemyManager.enemies) {
      const tp = enemy.getTilePos();
      this.minimapGfx.fillStyle(0xde5d5d, 1);
      this.minimapGfx.fillRect(ox + tp.tx * scale, oy + tp.ty * scale, scale, scale);
    }
  }

  getRoomColor(type) {
    switch (type) {
      case ROOM_KIND.QUEEN:
        return 0x9a6cc7;
      case ROOM_KIND.BROOD:
        return 0xd6c18a;
      case ROOM_KIND.STORAGE:
        return 0x8f6a3b;
      case ROOM_KIND.BARRACKS:
        return 0xa04747;
      case ROOM_KIND.UTILITY:
        return 0x5a7d44;
      default:
        return 0x6d533a;
    }
  }

  spawnDigParticles(tx, ty) {
    if (!this.settings.get("graphicsDetail")) return;
    const px = tx * TILE_SIZE + 12;
    const py = ty * TILE_SIZE + 12;
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(px, py, 2, 0xb27a4a, 1).setDepth(420);
      this.tweens.add({
        targets: p,
        x: px + Phaser.Math.Between(-12, 12),
        y: py + Phaser.Math.Between(-12, 12),
        alpha: 0,
        duration: 350,
        onComplete: () => p.destroy()
      });
    }
  }

  spawnBuildParticles(tx, ty) {
    if (!this.settings.get("graphicsDetail")) return;
    const px = tx * TILE_SIZE + 20;
    const py = ty * TILE_SIZE + 20;
    for (let i = 0; i < 8; i++) {
      const p = this.add.circle(px, py, 2, 0xd3c28e, 1).setDepth(420);
      this.tweens.add({
        targets: p,
        x: px + Phaser.Math.Between(-20, 20),
        y: py + Phaser.Math.Between(-16, 16),
        alpha: 0,
        scale: 0.2,
        duration: 450,
        onComplete: () => p.destroy()
      });
    }
  }

  spawnCombatParticles(x, y) {
    if (!this.settings.get("graphicsDetail")) return;
    for (let i = 0; i < 5; i++) {
      const p = this.add.circle(x, y, 2, 0xe06d6d, 1).setDepth(420);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-12, 12),
        y: y + Phaser.Math.Between(-12, 12),
        alpha: 0,
        duration: 260,
        onComplete: () => p.destroy()
      });
    }
  }

  spawnFoodParticles(x, y) {
    if (!this.settings.get("graphicsDetail")) return;
    for (let i = 0; i < 5; i++) {
      const p = this.add.circle(x, y, 2, 0xc4ee61, 1).setDepth(420);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-10, 10),
        y: y + Phaser.Math.Between(-10, 10),
        alpha: 0,
        duration: 300,
        onComplete: () => p.destroy()
      });
    }
  }

  onAntKilled(ant) {
    Phaser.Utils.Array.Remove(this.antManager.ants, ant);
    this.resources.population = this.antManager.ants.length;
    this.resources.addMorale(-5);
    this.announce(`${ANT_TYPES[ant.role].label} ant lost`);
  }

  restoreSave(save) {
    if (!save) return;

    if (save.settingsDifficulty) this.settings.set("difficulty", save.settingsDifficulty);

    if (save.resources) {
      Object.assign(this.resources, save.resources);
    }

    if (Array.isArray(save.map)) {
      this.map = save.map;
    }

    if (Array.isArray(save.roomTypeMap)) {
      this.roomTypeMap = save.roomTypeMap;
    }

    if (Array.isArray(save.rooms)) {
      this.roomManager.rooms = save.rooms.map((data) => {
        const room = new Room(data.type, data.tiles, data.level);
        room.health = data.health;
        room.maxHealth = data.maxHealth;
        return room;
      });
      this.roomManager.applyRoomBonuses();
    }

    if (Array.isArray(save.foodSources)) {
      this.foodSources = save.foodSources;
    }

    this.antManager.ants.forEach((a) => a.destroy());
    this.antManager.ants = [];
    if (Array.isArray(save.ants)) {
      save.ants.forEach((a) => {
        const tx = Math.floor(a.x / TILE_SIZE);
        const ty = Math.floor(a.y / TILE_SIZE);
        const ant = this.antManager.spawn(tx, ty, a.role);
        if (ant) {
          ant.x = a.x;
          ant.y = a.y;
          ant.health = a.health;
          ant.carryingFood = a.carryingFood || 0;
        }
      });
    }

    if (save.enemyWave) this.enemyManager.wave = save.enemyWave;
    this.redrawWorld(true);
    this.announce("Save loaded.");
  }

  saveCurrentGame() {
    const state = {
      settingsDifficulty: this.settings.get("difficulty"),
      resources: this.resources,
      map: this.map,
      roomTypeMap: this.roomTypeMap,
      rooms: this.roomManager.rooms.map((r) => ({
        type: r.type,
        tiles: r.tiles,
        level: r.level,
        health: r.health,
        maxHealth: r.maxHealth
      })),
      ants: this.antManager.ants.map((a) => a.serialize()),
      foodSources: this.foodSources,
      enemyWave: this.enemyManager.wave
    };
    return SaveManager.saveGame(state);
  }

  announce(text) {
    this.uiMessage = text;
    this.uiMessageTime = 0.1;
  }

  formatTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${String(m).padStart(2, "0")}:${String(rs).padStart(2, "0")}`;
  }

  triggerLose(reason) {
    this.scene.pause();
    this.scene.pause("UIScene");
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x000000,
        0.72
      )
      .setDepth(600);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, "Colony Lost", {
        fontSize: "44px",
        color: "#f0d7d7",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(601);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 20, reason, {
        fontSize: "24px",
        color: "#f2dfc4"
      })
      .setOrigin(0.5)
      .setDepth(601);
  }

  triggerWin() {
    this.scene.pause();
    this.scene.pause("UIScene");
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x000000,
        0.72
      )
      .setDepth(600);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, "Colony Endures", {
        fontSize: "44px",
        color: "#e6f0cb",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(601);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 20, "You survived the final assault.", {
        fontSize: "24px",
        color: "#f2dfc4"
      })
      .setOrigin(0.5)
      .setDepth(601);
  }

  updateFog() {
    this.fogGfx.clear();
    this.fogGfx.fillStyle(0x000000, 0.86);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const visible = this.vision[y][x] > 0;
        const seen = this.discovered[y][x];
        if (!visible) {
          const alpha = seen ? 0.42 : 0.88;
          this.fogGfx.fillStyle(0x000000, alpha);
          this.fogGfx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.vision[y][x] = 0;
      }
    }
  }

  processBrood(dt) {
    const broodBonus = this.roomManager.broodRooms().reduce((sum, room) => {
      return sum + (ROOM_TYPES.brood.levels[room.level]?.hatchRate || 0);
    }, 0);

    this.broodProgress += dt * 0.02 * broodBonus;

    if (this.broodProgress >= 1 && this.antManager.ants.length < this.resources.populationCap) {
      this.broodProgress = 0;
      const queen = this.roomManager.getQueenRoom().center();
      this.antManager.spawn(queen.tx, queen.ty, ROLE.WORKER);
      this.resources.addMorale(2);
      this.audio.hatch();
      this.announce("A new ant has hatched");
    }
  }

  handleProgression() {
    if (this.resources.totalFoodGathered >= 150 && !this.unlockMilestones.has("utility")) {
      this.unlockMilestones.add("utility");
      this.resources.unlocks.utility = true;
      this.announce("Utility room unlocked");
    }

    if (this.resources.timeSurvived >= 300 && !this.unlockMilestones.has("final")) {
      this.unlockMilestones.add("final");
      this.resources.unlocks.bossWaveReady = true;
      this.announce("Late colony assault expected");
    }

    if (this.resources.timeSurvived >= 420 && this.enemyManager.wave >= 8) {
      this.triggerWin();
    }
  }

  update(_, dtMs) {
    const dt = (dtMs / 1000) * this.getGameSpeed();

    this.resources.update(dt);
    this.processBrood(dt);
    this.antManager.update(dt);
    this.enemyManager.update(dt);

    if (
      Math.random() <
      0.004 * DIFFICULTY_SETTINGS[this.settings.get("difficulty")].foodSpawnRate
    ) {
      if (this.foodSources.length < 16) this.spawnFoodSource();
    }

    if (this.resources.morale <= 0) {
      this.triggerLose("Colony morale collapsed.");
    }

    const queen = this.roomManager.getQueenRoom();
    if (!queen || queen.health <= 0) {
      this.triggerLose("The queen has died.");
    }

    this.handleProgression();
    this.redrawWorld();
    this.updateFog();
    this.helpOverlay.setVisible(this.helpVisible);
  }
}

