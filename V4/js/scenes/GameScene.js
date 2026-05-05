import {
  ANT_TYPES,
  BALANCE_CONFIG,
  DIFFICULTY_SETTINGS,
  GAME_SPEED_STEPS,
  MAP_HEIGHT,
  MAP_WIDTH,
  ROLE,
  ROOM_KIND,
  ROOM_TYPES,
  STARTING_ANTS_BY_DIFFICULTY,
  SURFACE_ROWS,
  TILE,
  TILE_SIZE,
  TOOL_MODE,
  clamp
} from "../core/constants.js";
import { MobileSupport } from "../core/mobileSupport.js";
import { Room } from "../entities/Room.js";
import { AntManager } from "../managers/AntManager.js";
import { AudioManager } from "../managers/AudioManager.js";
import { ColonyEventManager } from "../managers/ColonyEventManager.js";
import { EnemyManager } from "../managers/EnemyManager.js";
import { GridPathfinder } from "../managers/GridPathfinder.js";
import { ResourceManager } from "../managers/ResourceManager.js";
import { RoomManager } from "../managers/RoomManager.js";
import { SaveManager } from "../managers/SaveManager.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  init(data) {
    this.saveData = data?.saveData || null;
  }

  create() {
    this.settings = this.registry.get("settings");
    this.audio = this.registry.get("audio") || new AudioManager(this.settings);
    this.debugEnabled = false;
    this.helpVisible = true;
    this.isGameOver = false;
    this.globalPriority = "food";
    this.currentBuildMode = ROOM_KIND.BROOD;
    this.currentTool = this.settings.get("defaultTool") || TOOL_MODE.SELECT;
    if (!Object.values(TOOL_MODE).includes(this.currentTool)) {
      this.currentTool = TOOL_MODE.SELECT;
    }
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
    this.autoSaveTimer = 0;

    this.resources = new ResourceManager(this, this.settings.get("difficulty"));
    this.pathfinder = new GridPathfinder(this);
    this.colonyEvents = new ColonyEventManager(this);
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
    this.dragPaintDig = false;
    this.dragQueuedCount = 0;
    this.pendingSelectClick = null;

    this.input.on("pointerdown", (pointer) => this.handlePointerDown(pointer));
    this.input.on("pointerup", (pointer) => this.handlePointerUp(pointer));
    this.input.on("pointermove", (pointer) => this.handlePointerMove(pointer));
    if (this.isTouchDevice) {
      this.enablePinchZoom(this.cameras.main, 0.72, 1.45);
    }

    this.bindFocusPause();
    this.createKeyboardShortcuts();

    if (this.saveData) {
      this.restoreSave(this.saveData);
    }

    this.applyToolCursor();
    this.cameras.main.setBackgroundColor("#19120d");
    this.redrawWorld(true);
    this.announce(`Colony founded. Tool: ${this.getToolLabel()}`);
  }

  createKeyboardShortcuts() {
    this.input.keyboard.on("keydown-ONE", () => this.assignRole(ROLE.WORKER));
    this.input.keyboard.on("keydown-TWO", () => this.assignRole(ROLE.SOLDIER));
    this.input.keyboard.on("keydown-THREE", () => this.assignRole(ROLE.NURSE));
    this.input.keyboard.on("keydown-FOUR", () => this.assignRole(ROLE.SCOUT));

    this.input.keyboard.on("keydown-B", () => {
      const rooms = [ROOM_KIND.BROOD, ROOM_KIND.STORAGE, ROOM_KIND.BARRACKS, ROOM_KIND.UTILITY];
      const idx = rooms.indexOf(this.currentBuildMode);
      const nextRoom = rooms[(idx + 1 + rooms.length) % rooms.length];
      this.setBuildMode(nextRoom);
      this.announce(`Build mode: ${nextRoom}`);
    });

    this.input.keyboard.on("keydown-Q", () => this.setSelectTool());
    this.input.keyboard.on("keydown-E", () => this.setDigTool());
    this.input.keyboard.on("keydown-R", () =>
      this.setBuildMode(this.currentBuildMode || ROOM_KIND.BROOD)
    );
    this.input.keyboard.on("keydown-ESC", () => this.setSelectTool());

    this.input.keyboard.on("keydown-Z", () => this.undoLastDigOrder());
    this.input.keyboard.on("keydown-X", () => this.clearDigOrders());
    this.input.keyboard.on("keydown-BACKSPACE", (ev) => {
      ev.preventDefault?.();
      if (ev.shiftKey) {
        this.clearDigOrders();
      } else {
        this.undoLastDigOrder();
      }
    });
    this.input.keyboard.on("keydown-DELETE", () => this.clearDigOrders());

    this.input.keyboard.on("keydown-SPACE", () => {
      const current = this.settings.get("gameSpeed");
      const idx = GAME_SPEED_STEPS.indexOf(current);
      const next = GAME_SPEED_STEPS[(idx + 1 + GAME_SPEED_STEPS.length) % GAME_SPEED_STEPS.length];
      this.settings.set("gameSpeed", next);
      this.announce(`Game speed set to ${next}x`);
    });

    this.input.keyboard.on("keydown-F5", () => {
      const ok = this.saveCurrentGame();
      this.announce(ok ? "Manual save complete" : "Manual save failed");
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

  bindFocusPause() {
    this._onWindowBlur = () => {
      if (!this.settings.get("pauseOnBlur")) return;
      if (this.scene.isPaused("GameScene") || this.isGameOver) return;
      this.scene.pause();
      this.scene.pause("UIScene");
      if (!this.scene.isActive("PauseScene")) {
        this.scene.launch("PauseScene");
      }
    };

    window.addEventListener("blur", this._onWindowBlur);
    this.events.once("shutdown", () => {
      window.removeEventListener("blur", this._onWindowBlur);
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

    - Q = Select tool. E = Dig tool. R = Build tool.
    - Drag in Select mode for fast box-select.
    - Drag across dirt and rock in Dig mode to queue many tunnel orders.
- Clear tunnel space, then build underground rooms.
    - Z = Undo last dig order. X = Clear dig queue.
    - Double-click an ant in Select mode to select all ants of that role.
    - Press Esc (or Cancel/Clear in HUD) to return to Select tool.
    - Right-click to order selected ants to move.
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
    const composition =
      STARTING_ANTS_BY_DIFFICULTY[this.settings.get("difficulty")] ||
      STARTING_ANTS_BY_DIFFICULTY.normal;
    const offsets = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [2, 0],
      [-2, 0],
      [1, 1],
      [-1, 1]
    ];

    composition.forEach((role, idx) => {
      const offset = offsets[idx] || [0, 0];
      this.antManager.spawn(c.tx + offset[0], c.ty + offset[1], role);
    });
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

  findBestFoodForWorker(worker) {
    if (!worker || this.foodSources.length === 0) return null;
    if (!this.settings.get("smartWorkerDistribution")) {
      return this.findNearestFood(worker.x, worker.y);
    }

    let best = null;
    let bestScore = Number.MAX_VALUE;

    for (const food of this.foodSources) {
      let claims = 0;
      for (const ant of this.antManager.ants) {
        if (ant === worker || ant.role !== ROLE.WORKER) continue;
        if ((ant.state === "foraging" || ant.state === "returning") && ant.target === food) {
          claims += 1;
        }
      }

      const distanceScore = Phaser.Math.Distance.Between(worker.x, worker.y, food.x, food.y);
      const richnessBonus = Math.min(34, food.amount) * 0.9;
      const score = distanceScore + claims * BALANCE_CONFIG.workerFoodClaimPenalty - richnessBonus;

      if (score < bestScore) {
        best = food;
        bestScore = score;
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

  setTool(tool, announce = true) {
    if (!Object.values(TOOL_MODE).includes(tool)) return;
    this.currentTool = tool;
    this.applyToolCursor();
    if (announce) {
      this.announce(`Tool: ${this.getToolLabel()}`);
    }
  }

  setSelectTool(announce = true) {
    this.currentBuildMode = this.currentBuildMode || ROOM_KIND.BROOD;
    this.buildPreview?.clear();
    this.setTool(TOOL_MODE.SELECT, announce);
  }

  setDigTool(announce = true) {
    this.currentBuildMode = this.currentBuildMode || ROOM_KIND.BROOD;
    this.buildPreview?.clear();
    this.setTool(TOOL_MODE.DIG, announce);
  }

  setBuildMode(roomType) {
    if (!roomType) {
      this.clearBuildMode(false);
      return;
    }

    if (this.currentTool === TOOL_MODE.BUILD && this.currentBuildMode === roomType) {
      this.clearBuildMode();
      return;
    }

    this.currentBuildMode = roomType;
    this.setTool(TOOL_MODE.BUILD, false);
  }

  clearBuildMode(announce = true) {
    this.currentBuildMode = this.currentBuildMode || ROOM_KIND.BROOD;
    this.buildPreview?.clear();
    this.setSelectTool(false);
    if (announce) this.announce("Build cancelled. Tool: select");
  }

  getToolLabel() {
    switch (this.currentTool) {
      case TOOL_MODE.SELECT:
        return "Select";
      case TOOL_MODE.DIG:
        return "Dig";
      case TOOL_MODE.BUILD:
        return "Build";
      default:
        return "Select";
    }
  }

  applyToolCursor() {
    if (!this.input?.setDefaultCursor) return;
    switch (this.currentTool) {
      case TOOL_MODE.DIG:
        this.input.setDefaultCursor("crosshair");
        break;
      case TOOL_MODE.BUILD:
        this.input.setDefaultCursor("copy");
        break;
      default:
        this.input.setDefaultCursor("default");
        break;
    }
  }

  undoLastDigOrder(announce = true) {
    const removed = this.pendingDigOrders.pop();
    if (announce) {
      this.announce(removed ? "Removed last dig order" : "No dig orders to undo");
    }
    return Boolean(removed);
  }

  clearDigOrders(announce = true) {
    const count = this.pendingDigOrders.length;
    this.pendingDigOrders.length = 0;
    if (announce) {
      this.announce(count > 0 ? `Cleared ${count} dig orders` : "No dig orders to clear");
    }
    return count;
  }

  assignRole(role) {
    const changed = this.antManager.assignRoleToSelection(role);
    if (changed) this.announce(`Assigned ${ANT_TYPES[role].label}`);
  }

  queueDig(tx, ty, announce = true) {
    if (!this.inBounds(tx, ty)) return false;
    if (this.map[ty][tx] !== TILE.DIRT && this.map[ty][tx] !== TILE.ROCK) return false;
    if (this.pendingDigOrders.length >= BALANCE_CONFIG.maxDigQueue) {
      if (announce) this.announce("Dig queue is full");
      return false;
    }
    const already = this.pendingDigOrders.some((o) => o.tx === tx && o.ty === ty);
    if (!already) {
      this.pendingDigOrders.push({ tx, ty });
      if (announce) this.announce(`Dig queued at ${tx},${ty}`);
      return true;
    }
    return false;
  }

  handlePointerDown(pointer) {
    const tx = Math.floor(pointer.worldX / TILE_SIZE);
    const ty = Math.floor(pointer.worldY / TILE_SIZE);

    if (pointer.rightButtonDown()) return;

    const viewport = this.getViewport?.();
    const safeTop = viewport?.safeArea?.top || 0;
    const compactTopHud =
      this.isMobileDevice || this.scale.width <= 1024 || this.settings.get("compactHud");
    const topInputGuard = safeTop + (compactTopHud ? 84 : 52);
    if (pointer.y < topInputGuard) return;

    const tile = this.map[ty]?.[tx];
    const canDigTile = tile === TILE.DIRT || tile === TILE.ROCK;
    if (this.currentTool === TOOL_MODE.DIG) {
      if (canDigTile) {
        this.dragPaintDig = true;
        this.dragQueuedCount = this.queueDig(tx, ty, true) ? 1 : 0;
      }
      return;
    }

    if (this.currentTool === TOOL_MODE.BUILD && this.currentBuildMode) {
      const room = this.roomManager.roomAt(tx, ty);
      if (room && room.type !== ROOM_KIND.QUEEN) {
        const result = this.roomManager.upgradeRoom(room);
        this.announce(result.ok ? `${room.type} upgraded` : result.reason);
      } else {
        const result = this.roomManager.buildRoom(this.currentBuildMode, tx, ty);
        this.announce(result.ok ? `${this.currentBuildMode} room placed` : result.reason);
      }
      return;
    }

    this.dragStart = { x: pointer.worldX, y: pointer.worldY };
    this.isDragging = true;
    this.pendingSelectClick = {
      additive: Boolean(pointer.event?.shiftKey || pointer.event?.ctrlKey),
      roleMultiSelect: Number(pointer.event?.detail || 1) >= 2
    };
  }

  handlePointerMove(pointer) {
    if (this.currentTool === TOOL_MODE.BUILD && this.currentBuildMode) {
      this.drawBuildPreview(pointer.worldX, pointer.worldY);
    }

    if (this.dragPaintDig && pointer.isDown) {
      const tx = Math.floor(pointer.worldX / TILE_SIZE);
      const ty = Math.floor(pointer.worldY / TILE_SIZE);
      if (this.queueDig(tx, ty, false)) {
        this.dragQueuedCount += 1;
      }
      return;
    }

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
    if (this.dragPaintDig) {
      if (this.dragQueuedCount > 1) {
        this.announce(`Queued ${this.dragQueuedCount} dig orders`);
      }
      this.dragPaintDig = false;
      this.dragQueuedCount = 0;
      return;
    }

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

      const additive = Boolean(this.pendingSelectClick?.additive);
      if (rect.width > 4 || rect.height > 4) {
        this.antManager.selectInRect(rect, additive);
      } else if (this.settings.get("singleClickSelect")) {
        const picked = this.antManager.selectClosestAt(
          pointer.worldX,
          pointer.worldY,
          BALANCE_CONFIG.clickSelectRadius,
          additive
        );

        if (picked && this.pendingSelectClick?.roleMultiSelect) {
          this.antManager.selectByRole(picked.role, true);
        }

        if (!picked && !additive) {
          this.antManager.clearSelection();
        }
      }
    }

    this.isDragging = false;
    this.dragStart = null;
    this.pendingSelectClick = null;
    this.selectionGraphics.clear();
  }

  drawBuildPreview(worldX, worldY) {
    this.buildPreview.clear();
    if (this.currentTool !== TOOL_MODE.BUILD || !this.currentBuildMode) return;
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

    if (this.settings.get("showDigMarkers")) {
      this.drawPendingDigMarkers();
    }

    if (force || this.settings.get("graphicsDetail")) {
      this.drawMinimap();
    }
  }

  drawPendingDigMarkers() {
    if (this.pendingDigOrders.length === 0) return;
    this.worldGfx.lineStyle(1, 0xf2cc77, 0.95);
    for (const order of this.pendingDigOrders) {
      const px = order.tx * TILE_SIZE;
      const py = order.ty * TILE_SIZE;
      this.worldGfx.strokeRect(px + 3, py + 3, TILE_SIZE - 7, TILE_SIZE - 7);
      this.worldGfx.lineBetween(px + 6, py + 6, px + TILE_SIZE - 6, py + TILE_SIZE - 6);
      this.worldGfx.lineBetween(px + TILE_SIZE - 6, py + 6, px + 6, py + TILE_SIZE - 6);
    }
  }

  drawMinimap() {
    if (this.minimapGfx) this.minimapGfx.destroy();
    this.minimapGfx = this.add.graphics().setDepth(500);
    const scale = clamp(
      Math.round(this.settings.get("minimapScale") || 4),
      BALANCE_CONFIG.minimapScaleMin,
      BALANCE_CONFIG.minimapScaleMax
    );
    const minimapAlpha = clamp(Number(this.settings.get("minimapOpacity") || 0.9), 0.25, 1);
    const viewport = this.getViewport?.();
    const safe = viewport?.safeArea || { top: 0, right: 0, bottom: 0, left: 0 };
    const width = MAP_WIDTH * scale;
    const height = MAP_HEIGHT * scale;
    const ox = this.scale.width - width - 18 - safe.right;
    const oy = 76 + safe.top;

    this.minimapGfx.fillStyle(0x150f0b, minimapAlpha);
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

    if (save.settings && typeof save.settings === "object") {
      this.settings.setMany(save.settings);
    }

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

    if (Array.isArray(save.pendingDigOrders)) {
      this.pendingDigOrders = save.pendingDigOrders
        .filter((o) => this.inBounds(o.tx, o.ty))
        .slice(0, BALANCE_CONFIG.maxDigQueue);
    }

    const savedTool = save.currentTool;
    if (Object.values(TOOL_MODE).includes(savedTool)) {
      this.currentTool = savedTool;
    }

    if (save.currentBuildMode && ROOM_TYPES[save.currentBuildMode]) {
      this.currentBuildMode = save.currentBuildMode;
    }

    if (this.currentTool === TOOL_MODE.BUILD && !this.currentBuildMode) {
      this.setSelectTool(false);
    }

    this.antManager.ants.forEach((a) => {
      a.sprite?.destroy();
      a.healthBar?.destroy();
      a.healthBarBg?.destroy();
      a.selectionRing?.destroy();
    });
    this.antManager.ants = [];
    this.resources.population = 0;
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
    if (typeof save.autoSaveTimer === "number") {
      this.autoSaveTimer = save.autoSaveTimer;
    }
    if (typeof save.eventTimer === "number") {
      this.colonyEvents.timeToNext = save.eventTimer;
    }
    this.applyToolCursor();
    this.redrawWorld(true);
    this.announce("Save loaded.");
  }

  saveCurrentGame() {
    const state = {
      settingsDifficulty: this.settings.get("difficulty"),
      settings: { ...this.settings.data },
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
      pendingDigOrders: this.pendingDigOrders,
      enemyWave: this.enemyManager.wave,
      autoSaveTimer: this.autoSaveTimer,
      eventTimer: this.colonyEvents?.timeToNext || 0,
      currentTool: this.currentTool,
      currentBuildMode: this.currentBuildMode
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
    if (this.isGameOver) return;
    this.isGameOver = true;
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
    if (this.isGameOver) return;
    this.isGameOver = true;
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

    this.broodProgress += dt * BALANCE_CONFIG.broodBaseRate * broodBonus;

    if (this.broodProgress >= 1 && this.antManager.ants.length < this.resources.populationCap) {
      this.broodProgress = 0;
      const queen = this.roomManager.getQueenRoom().center();
      const spawned = this.antManager.spawn(queen.tx, queen.ty, ROLE.WORKER);
      if (spawned && this.settings.get("autoSelectNewAnt")) {
        this.antManager.clearSelection();
        spawned.selected = true;
      }
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

  updateAutoSave(dt) {
    if (!this.settings.get("autoSaveEnabled") || this.isGameOver) return;

    this.autoSaveTimer += dt;
    const interval = Math.max(
      BALANCE_CONFIG.autoSaveMinimumIntervalSec,
      this.settings.get("autoSaveIntervalSec") || BALANCE_CONFIG.autoSaveMinimumIntervalSec
    );

    if (this.autoSaveTimer >= interval) {
      this.autoSaveTimer = 0;
      this.saveCurrentGame();
      this.announce("Autosaved");
    }
  }

  update(_, dtMs) {
    if (this.isGameOver) return;

    const dt = (dtMs / 1000) * this.getGameSpeed();

    this.resources.update(dt);
    this.processBrood(dt);
    this.antManager.update(dt);
    this.enemyManager.update(dt);
    this.colonyEvents.update(dt);
    this.updateAutoSave(dt);

    if (
      Math.random() <
        BALANCE_CONFIG.randomFoodSpawnChance *
          DIFFICULTY_SETTINGS[this.settings.get("difficulty")].foodSpawnRate &&
      this.foodSources.length < BALANCE_CONFIG.maxFoodSources
    ) {
      this.spawnFoodSource();
    }

    if (this.resources.morale <= 0) {
      this.triggerLose("Colony morale collapsed.");
      return;
    }

    const queen = this.roomManager.getQueenRoom();
    if (!queen || queen.health <= 0) {
      this.triggerLose("The queen has died.");
      return;
    }

    this.handleProgression();
    this.redrawWorld();
    this.updateFog();
    this.helpOverlay.setVisible(this.helpVisible);
  }
}
