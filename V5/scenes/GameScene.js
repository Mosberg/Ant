import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js";
import { GameEngine } from "../engine/GameEngine.js";

const TOOL_MODES = ["select", "dig", "build", "pheromone"];

const TILE_COLORS = {
  surface: 0x2b6e4a,
  dirt: 0x4b3728,
  tunnel: 0x9e7f5e,
  rock: 0x252831,
  crystal: 0x4d9ac8,
  room: 0xba915f
};

function roleColor(role) {
  const value = String(role || "").toLowerCase();
  if (value.includes("soldier") || value.includes("guardian") || value.includes("spitter")) {
    return 0xc77b74;
  }
  if (value.includes("scout")) {
    return 0x96c5ff;
  }
  if (value.includes("nurse") || value.includes("medic")) {
    return 0x8fd5a3;
  }
  if (value.includes("builder")) {
    return 0xd8be74;
  }
  if (value.includes("excavator")) {
    return 0xb98a5d;
  }
  return 0xe8dfa6;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.engine = null;
    this.currentTool = "select";
    this.selectedRoomType = "food_storage";
    this.selectedAntIds = new Set();
    this.selectedRoomId = null;
    this.selectedMorphTypeIndex = 0;
    this.selectionBox = {
      active: false,
      pointerId: null,
      additive: false,
      dragged: false,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 }
    };
    this.pointerPanning = false;
    this.panPointerId = null;
    this.lastPointer = { x: 0, y: 0 };
    this.worldWidth = 0;
    this.worldHeight = 0;
    this.zoomMin = 0.38;
    this.zoomMax = 2.8;
    this.zoomStep = 1.14;
    this.hintBarHeight = 32;
    this.lossLabel = null;
    this.debugHint = null;
  }

  create(data) {
    this.cameras.main.setBackgroundColor("#111b16");

    const configBundle = this.registry.get("configBundle");
    this.engine = new GameEngine(this, configBundle);
    this.engine.init();

    const settings = this.engine.getSystem("settings");
    for (const [path, value] of Object.entries(data?.overrideSettings ?? {})) {
      settings.set(path, value, false);
    }
    settings.persist();

    if (data?.loadSlot) {
      this.engine.getSystem("saveLoad").load(data.loadSlot);
    }

    const terrain = this.engine.getSystem("terrain");
    const rooms = this.engine.getSystem("rooms");

    this.currentTool = settings.get("controls.defaultTool", "select");
    this.selectedRoomType = rooms.defaultBuildType;

    const worldWidth = terrain.width * terrain.tileSize;
    const worldHeight = terrain.height * terrain.tileSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.centerOn(worldWidth * 0.5, worldHeight * 0.5);

    this.terrainGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.entityGraphics = this.add.graphics();
    this.uiGraphics = this.add.graphics();

    this.pendingEventText = this.add
      .text(this.scale.width * 0.5, 104, "", {
        fontFamily: "Consolas, monospace",
        fontSize: "14px",
        color: "#ffe6b2",
        backgroundColor: "#352715",
        padding: {
          left: 8,
          right: 8,
          top: 5,
          bottom: 5
        }
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(150)
      .setVisible(false);

    this.scale.on("resize", this.handleScaleResize, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.handleScaleResize, this);
    });

    this.registerInputHandlers();
    this.registerEngineListeners();

    if (this.scene.isActive("UIScene")) {
      this.scene.stop("UIScene");
    }
    this.scene.launch("UIScene", {
      gameSceneKey: "GameScene"
    });

    this.clampCameraToBounds();

    this.renderWorld();
  }

  handleScaleResize(gameSize) {
    this.pendingEventText?.setPosition(gameSize.width * 0.5, 104);
    this.clampCameraToBounds();
  }

  clampCameraToBounds() {
    if (!this.engine || this.worldWidth <= 0 || this.worldHeight <= 0) {
      return;
    }

    const camera = this.cameras.main;

    const minZoomByWidth = camera.width / this.worldWidth;
    const minZoomByHeight = camera.height / this.worldHeight;
    const effectiveMinZoom = Math.max(this.zoomMin, minZoomByWidth, minZoomByHeight);
    if (camera.zoom < effectiveMinZoom) {
      camera.setZoom(effectiveMinZoom);
    }

    const viewWidth = camera.width / camera.zoom;
    const viewHeight = camera.height / camera.zoom;

    if (viewWidth >= this.worldWidth) {
      camera.scrollX = (this.worldWidth - viewWidth) * 0.5;
    } else {
      camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, this.worldWidth - viewWidth);
    }

    if (viewHeight >= this.worldHeight) {
      camera.scrollY = (this.worldHeight - viewHeight) * 0.5;
    } else {
      camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, this.worldHeight - viewHeight);
    }
  }

  getHintText() {
    const selectedCount = this.selectedAntIds.size;
    const morphTarget = this.getSelectedMorphTypeId() ?? "-";
    return [
      `Tool:${this.currentTool}`,
      `Build:${this.selectedRoomType}`,
      `Selected:${selectedCount}`,
      `Morph:${morphTarget}`,
      `1-4 Tools`,
      `[ ] Type`,
      `T Morph`,
      `U Upgrade Room`,
      `Z/V Select Room`,
      `K Tech`,
      `S Save`,
      `L Load`,
      `O Settings`,
      `F3 Debug`,
      `Shift+Drag MultiSelect`,
      `RMB Drag Pan`,
      `Wheel Zoom`,
      `P Pause`,
      `X Deselect`
    ].join("  |  ");
  }

  registerEngineListeners() {
    this.engine.events.on("colony:defeat", (entry) => {
      this.showLoss(entry.reason);
    });

    this.engine.events.on("events:pending", (eventDef) => {
      this.pendingEventText.setVisible(true);
      this.pendingEventText.setText(`Event: ${eventDef.name} (auto-resolves soon)`);
    });

    this.engine.events.on("events:triggered", () => {
      this.pendingEventText.setVisible(false);
    });
  }

  registerInputHandlers() {
    this.input.mouse?.disableContextMenu();

    this.keys = this.input.keyboard.addKeys({
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      t: Phaser.Input.Keyboard.KeyCodes.T,
      u: Phaser.Input.Keyboard.KeyCodes.U,
      k: Phaser.Input.Keyboard.KeyCodes.K,
      c: Phaser.Input.Keyboard.KeyCodes.C,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      l: Phaser.Input.Keyboard.KeyCodes.L,
      o: Phaser.Input.Keyboard.KeyCodes.O,
      f3: Phaser.Input.Keyboard.KeyCodes.F3,
      p: Phaser.Input.Keyboard.KeyCodes.P,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
      m: Phaser.Input.Keyboard.KeyCodes.M,
      tab: Phaser.Input.Keyboard.KeyCodes.TAB,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      x: Phaser.Input.Keyboard.KeyCodes.X,
      z: Phaser.Input.Keyboard.KeyCodes.Z,
      v: Phaser.Input.Keyboard.KeyCodes.V,
      minus: Phaser.Input.Keyboard.KeyCodes.MINUS,
      equals: Phaser.Input.Keyboard.KeyCodes.EQUALS,
      leftBracket: Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET,
      rightBracket: Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET,
      zero: Phaser.Input.Keyboard.KeyCodes.ZERO,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE
    });

    this.input.on("pointerdown", (pointer) => {
      const wantsPan =
        pointer.rightButtonDown() ||
        pointer.middleButtonDown() ||
        (pointer.leftButtonDown() && this.keys.space.isDown);

      if (wantsPan) {
        this.pointerPanning = true;
        this.panPointerId = pointer.id;
        this.lastPointer = { x: pointer.x, y: pointer.y };
        return;
      }

      if (!pointer.leftButtonDown()) {
        return;
      }

      if (this.currentTool === "select") {
        const worldPoint = pointer.positionToCamera(this.cameras.main);
        this.selectionBox.active = true;
        this.selectionBox.pointerId = pointer.id;
        this.selectionBox.additive = this.keys.shift.isDown;
        this.selectionBox.dragged = false;
        this.selectionBox.start = { x: worldPoint.x, y: worldPoint.y };
        this.selectionBox.end = { x: worldPoint.x, y: worldPoint.y };
        return;
      }

      this.handleToolInput(pointer);
    });

    this.input.on("pointerup", (pointer) => {
      if (!this.pointerPanning || pointer.id !== this.panPointerId) {
        if (this.selectionBox.active && pointer.id === this.selectionBox.pointerId) {
          this.finishSelection(pointer);
        }
        return;
      }

      this.pointerPanning = false;
      this.panPointerId = null;
    });

    this.input.on("pointermove", (pointer) => {
      if (
        !this.pointerPanning ||
        (this.panPointerId !== null && pointer.id !== this.panPointerId)
      ) {
        return;
      }

      const dx = pointer.x - this.lastPointer.x;
      const dy = pointer.y - this.lastPointer.y;
      this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
      this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
      this.clampCameraToBounds();
      this.lastPointer = { x: pointer.x, y: pointer.y };

      return;
    });

    this.input.on("pointermove", (pointer) => {
      if (!this.selectionBox.active || pointer.id !== this.selectionBox.pointerId) {
        return;
      }

      const worldPoint = pointer.positionToCamera(this.cameras.main);
      this.selectionBox.end = { x: worldPoint.x, y: worldPoint.y };

      const dx = this.selectionBox.end.x - this.selectionBox.start.x;
      const dy = this.selectionBox.end.y - this.selectionBox.start.y;
      if (dx * dx + dy * dy > 20) {
        this.selectionBox.dragged = true;
      }
    });

    this.input.on("wheel", (pointer, _gameObjects, _dx, dy) => {
      if (!pointer) {
        return;
      }

      const sensitivity = this.keys.shift.isDown ? 0.0018 : 0.0012;
      const zoomFactor = Phaser.Math.Clamp(1 - dy * sensitivity, 0.75, 1.25);
      this.zoomAtScreenPoint(pointer.x, pointer.y, zoomFactor);
    });
  }

  zoomAtScreenPoint(screenX, screenY, zoomFactor) {
    const cam = this.cameras.main;
    const worldBefore = cam.getWorldPoint(screenX, screenY);

    const minZoomByWidth = this.worldWidth > 0 ? cam.width / this.worldWidth : this.zoomMin;
    const minZoomByHeight = this.worldHeight > 0 ? cam.height / this.worldHeight : this.zoomMin;
    const effectiveMinZoom = Math.max(this.zoomMin, minZoomByWidth, minZoomByHeight);

    const nextZoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, effectiveMinZoom, this.zoomMax);
    if (Math.abs(nextZoom - cam.zoom) < 0.0001) {
      return;
    }

    cam.setZoom(nextZoom);
    const worldAfter = cam.getWorldPoint(screenX, screenY);
    cam.scrollX += worldBefore.x - worldAfter.x;
    cam.scrollY += worldBefore.y - worldAfter.y;
    this.clampCameraToBounds();
  }

  worldToTile(pointer) {
    const terrain = this.engine.getSystem("terrain");
    const worldPoint = pointer.positionToCamera(this.cameras.main);
    return {
      x: Math.floor(worldPoint.x / terrain.tileSize),
      y: Math.floor(worldPoint.y / terrain.tileSize)
    };
  }

  setTool(tool) {
    if (!TOOL_MODES.includes(tool)) {
      return;
    }
    this.currentTool = tool;
  }

  cycleRoomType(direction) {
    const roomTypes = this.engine.configBundle.rooms.roomTypes.map((room) => room.id);
    const currentIndex = roomTypes.indexOf(this.selectedRoomType);
    const nextIndex = (currentIndex + direction + roomTypes.length) % roomTypes.length;
    this.selectedRoomType = roomTypes[nextIndex];
  }

  getSelectedMorphTypeId() {
    const ants = this.engine.getSystem("ants");
    const unlocked = ants.getUnlockedTypeIds();
    if (unlocked.length === 0) {
      return null;
    }

    const clampedIndex = Phaser.Math.Wrap(this.selectedMorphTypeIndex, 0, unlocked.length);
    this.selectedMorphTypeIndex = clampedIndex;
    return unlocked[clampedIndex];
  }

  cycleSelectedMorphType(direction) {
    const ants = this.engine.getSystem("ants");
    const unlocked = ants.getUnlockedTypeIds();
    if (unlocked.length === 0) {
      return;
    }

    this.selectedMorphTypeIndex = Phaser.Math.Wrap(
      this.selectedMorphTypeIndex + direction,
      0,
      unlocked.length
    );
  }

  clearSelection() {
    this.selectedAntIds.clear();
    this.selectedRoomId = null;
  }

  getPrimarySelectedAnt() {
    const ants = this.engine.getSystem("ants");
    for (const antId of this.selectedAntIds) {
      const ant = ants.ants.find((entry) => entry.id === antId && entry.isAlive());
      if (ant) {
        return ant;
      }
    }
    return null;
  }

  selectAntAt(tileX, tileY, additive = false) {
    const ants = this.engine.getSystem("ants");
    const candidates = ants.getAliveAnts();

    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const ant of candidates) {
      const dx = ant.x - (tileX + 0.5);
      const dy = ant.y - (tileY + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = ant;
      }
    }

    if (best && bestDist <= 2.2) {
      if (!additive) {
        this.selectedAntIds.clear();
      }

      if (additive && this.selectedAntIds.has(best.id)) {
        this.selectedAntIds.delete(best.id);
      } else {
        this.selectedAntIds.add(best.id);
      }

      this.selectedRoomId = null;

      const unlocked = ants.getUnlockedTypeIds();
      const typeIndex = unlocked.indexOf(best.typeId);
      if (typeIndex >= 0) {
        this.selectedMorphTypeIndex = typeIndex;
      }

      return true;
    }

    if (!additive) {
      this.selectedAntIds.clear();
    }

    return false;
  }

  selectRoomAt(tileX, tileY) {
    const rooms = this.engine.getSystem("rooms");
    let room = rooms.rooms.find(
      (entry) => entry.tilePosition.x === tileX && entry.tilePosition.y === tileY
    );

    if (!room) {
      let nearest = null;
      let nearestDist = Number.POSITIVE_INFINITY;
      for (const entry of rooms.rooms) {
        const dx = entry.tilePosition.x - tileX;
        const dy = entry.tilePosition.y - tileY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = entry;
        }
      }

      if (nearest && nearestDist <= 1.35) {
        room = nearest;
      }
    }

    this.selectedRoomId = room?.id ?? null;
    if (room) {
      this.selectedAntIds.clear();
    }
    return Boolean(room);
  }

  selectAntsInWorldRect(rect, additive = false) {
    const ants = this.engine.getSystem("ants");
    const minX = Math.min(rect.start.x, rect.end.x);
    const maxX = Math.max(rect.start.x, rect.end.x);
    const minY = Math.min(rect.start.y, rect.end.y);
    const maxY = Math.max(rect.start.y, rect.end.y);

    if (!additive) {
      this.selectedAntIds.clear();
    }

    for (const ant of ants.getAliveAnts()) {
      const antWorldX = ant.x * this.engine.getSystem("terrain").tileSize;
      const antWorldY = ant.y * this.engine.getSystem("terrain").tileSize;
      if (antWorldX >= minX && antWorldX <= maxX && antWorldY >= minY && antWorldY <= maxY) {
        this.selectedAntIds.add(ant.id);
      }
    }

    if (this.selectedAntIds.size > 0) {
      this.selectedRoomId = null;
    }
  }

  finishSelection(pointer) {
    const worldPoint = pointer.positionToCamera(this.cameras.main);
    this.selectionBox.end = { x: worldPoint.x, y: worldPoint.y };

    if (this.selectionBox.dragged) {
      this.selectAntsInWorldRect(
        {
          start: this.selectionBox.start,
          end: this.selectionBox.end
        },
        this.selectionBox.additive
      );
    } else {
      const tile = this.worldToTile(pointer);
      if (!this.engine.getSystem("terrain").inBounds(tile.x, tile.y)) {
        this.selectionBox.active = false;
        this.selectionBox.pointerId = null;
        this.selectionBox.dragged = false;
        return;
      }

      const selectedAnt = this.selectAntAt(tile.x, tile.y, this.selectionBox.additive);
      if (!selectedAnt && !this.selectionBox.additive) {
        this.selectRoomAt(tile.x, tile.y);
      }
    }

    this.selectionBox.active = false;
    this.selectionBox.pointerId = null;
    this.selectionBox.dragged = false;
  }

  morphSelectedAnts() {
    if (this.selectedAntIds.size === 0) {
      return false;
    }

    const ants = this.engine.getSystem("ants");
    const targetTypeId = this.getSelectedMorphTypeId();
    if (!targetTypeId) {
      return false;
    }

    const changed = ants.morphAnts([...this.selectedAntIds], targetTypeId);
    if (changed > 0) {
      this.engine.events.emit("ants:morphed", {
        count: changed,
        targetTypeId
      });
      return true;
    }

    return false;
  }

  upgradeSelectedRoom() {
    if (!this.selectedRoomId) {
      return false;
    }

    const upgraded = this.engine.getSystem("rooms").upgradeRoom(this.selectedRoomId);
    if (upgraded) {
      this.engine.events.emit("rooms:upgraded", {
        roomId: this.selectedRoomId
      });
    }
    return upgraded;
  }

  selectCombatAnts() {
    const ants = this.engine.getSystem("ants");
    this.selectedAntIds.clear();
    for (const ant of ants.getAliveAnts()) {
      if (String(ant.role).includes("soldier") || ant.state === "Fight") {
        this.selectedAntIds.add(ant.id);
      }
    }
    this.selectedRoomId = null;
  }

  selectAllVisibleAnts() {
    const ants = this.engine.getSystem("ants");
    const view = this.cameras.main.worldView;

    this.selectedAntIds.clear();
    for (const ant of ants.getAliveAnts()) {
      const px = ant.x * this.engine.getSystem("terrain").tileSize;
      const py = ant.y * this.engine.getSystem("terrain").tileSize;
      if (view.contains(px, py)) {
        this.selectedAntIds.add(ant.id);
      }
    }

    if (this.selectedAntIds.size > 0) {
      this.selectedRoomId = null;
    }
  }

  cycleSelectedRoom(direction) {
    const rooms = this.engine.getSystem("rooms").rooms;
    if (!rooms || rooms.length === 0) {
      this.selectedRoomId = null;
      return;
    }

    const currentIndex = rooms.findIndex((entry) => entry.id === this.selectedRoomId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Phaser.Math.Wrap(baseIndex + direction, 0, rooms.length);

    this.selectedRoomId = rooms[nextIndex].id;
    this.selectedAntIds.clear();
  }

  handleToolInput(pointer) {
    if (pointer.y >= this.scale.height - this.hintBarHeight) {
      return;
    }

    const terrain = this.engine.getSystem("terrain");
    const rooms = this.engine.getSystem("rooms");
    const pheromones = this.engine.getSystem("pheromones");

    const tile = this.worldToTile(pointer);
    if (!terrain.inBounds(tile.x, tile.y)) {
      return;
    }

    if (this.currentTool === "select") {
      this.selectAntAt(tile.x, tile.y, this.keys.shift.isDown);
      return;
    }

    if (this.currentTool === "dig") {
      terrain.queueDigOrder(tile.x, tile.y);
      pheromones.lay("DigHere", tile.x, tile.y, 2);
      return;
    }

    if (this.currentTool === "build") {
      rooms.queueRoomBuild(this.selectedRoomType, tile.x, tile.y);
      pheromones.lay("BuildHere", tile.x, tile.y, 1.3);
      return;
    }

    if (this.currentTool === "pheromone") {
      pheromones.lay("Rally", tile.x, tile.y, 2.5);
    }
  }

  showLoss(reason) {
    if (this.lossLabel) {
      return;
    }

    this.lossLabel = this.add
      .text(this.scale.width * 0.5, 140, `Colony Defeated: ${reason}`, {
        fontFamily: "Consolas, monospace",
        fontSize: "26px",
        color: "#ffd4cf",
        backgroundColor: "#481e1a",
        padding: {
          left: 10,
          right: 10,
          top: 8,
          bottom: 8
        }
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(500);

    this.time.delayedCall(100, () => {
      if (!this.scene.isActive("PauseScene")) {
        this.scene.launch("PauseScene", {
          reason
        });
      }
      this.scene.pause("UIScene");
      this.scene.pause();
    });
  }

  togglePause() {
    if (this.scene.isActive("PauseScene")) {
      this.scene.stop("PauseScene");
      this.scene.resume("UIScene");
      this.scene.resume();
      return;
    }

    this.scene.launch("PauseScene");
    this.scene.pause("UIScene");
    this.scene.pause();
  }

  handleHotkeys() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) {
      this.setTool("select");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) {
      this.setTool("dig");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) {
      this.setTool("build");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) {
      this.setTool("pheromone");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.tab)) {
      const index = TOOL_MODES.indexOf(this.currentTool);
      this.setTool(TOOL_MODES[(index + 1) % TOOL_MODES.length]);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) {
      this.cycleRoomType(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) {
      this.cycleRoomType(1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.s)) {
      this.engine.getSystem("saveLoad").save("slot1");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.l)) {
      this.engine.getSystem("saveLoad").load("slot1");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.o)) {
      this.events.emit("ui:toggleSettings");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.k)) {
      this.events.emit("ui:toggleTech");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.f3)) {
      this.events.emit("ui:toggleDebug");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.m)) {
      this.engine.getSystem("debug").toggle("showPheromoneHeatmap");
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.keys.p) ||
      Phaser.Input.Keyboard.JustDown(this.keys.esc)
    ) {
      this.togglePause();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.x)) {
      this.clearSelection();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.z)) {
      this.cycleSelectedRoom(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.v)) {
      this.cycleSelectedRoom(1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.leftBracket)) {
      this.cycleSelectedMorphType(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.rightBracket)) {
      this.cycleSelectedMorphType(1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.t)) {
      this.morphSelectedAnts();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.u)) {
      this.upgradeSelectedRoom();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.c)) {
      this.selectCombatAnts();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.equals)) {
      this.zoomAtScreenPoint(this.scale.width * 0.5, this.scale.height * 0.5, this.zoomStep);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.minus)) {
      this.zoomAtScreenPoint(this.scale.width * 0.5, this.scale.height * 0.5, 1 / this.zoomStep);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.zero)) {
      this.cameras.main.setZoom(1);
    }
  }

  handleFreeCamera(dt) {
    const debug = this.engine.getSystem("debug");
    if (!debug.toggles.freeCamera) {
      return;
    }

    const cam = this.cameras.main;
    const speed = (540 * dt) / cam.zoom;
    let moved = false;
    if (this.keys.w.isDown) {
      cam.scrollY -= speed;
      moved = true;
    }
    if (this.keys.s.isDown) {
      cam.scrollY += speed;
      moved = true;
    }
    if (this.keys.a.isDown) {
      cam.scrollX -= speed;
      moved = true;
    }
    if (this.keys.d.isDown) {
      cam.scrollX += speed;
      moved = true;
    }

    if (moved) {
      this.clampCameraToBounds();
    }
  }

  drawTerrain() {
    const terrain = this.engine.getSystem("terrain");
    const fog = this.engine.getSystem("fog");
    const tileSize = terrain.tileSize;

    this.terrainGraphics.clear();
    this.overlayGraphics.clear();

    for (let y = 0; y < terrain.height; y += 1) {
      for (let x = 0; x < terrain.width; x += 1) {
        const tile = terrain.tiles[y][x];
        const color = TILE_COLORS[tile.type] ?? 0x222222;

        this.terrainGraphics.fillStyle(color, 1);
        this.terrainGraphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

        if (tile.flooded) {
          this.overlayGraphics.fillStyle(0x3188ad, 0.45);
          this.overlayGraphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }

        if (!fog.isVisible(x, y)) {
          const alpha = fog.isDiscovered(x, y) ? 0.38 : 0.8;
          this.overlayGraphics.fillStyle(0x000000, alpha);
          this.overlayGraphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }

    for (const digOrder of terrain.digOrders) {
      this.overlayGraphics.lineStyle(1, 0xf6dc7e, 0.9);
      this.overlayGraphics.strokeRect(
        digOrder.x * tileSize + 2,
        digOrder.y * tileSize + 2,
        tileSize - 4,
        tileSize - 4
      );
    }
  }

  drawRooms() {
    const terrain = this.engine.getSystem("terrain");
    const rooms = this.engine.getSystem("rooms");
    const tileSize = terrain.tileSize;

    for (const room of rooms.rooms) {
      const x = room.tilePosition.x * tileSize;
      const y = room.tilePosition.y * tileSize;
      const alpha = room.isComplete ? 0.6 : 0.35;
      const selected = room.id === this.selectedRoomId;

      this.entityGraphics.fillStyle(0xc99861, alpha);
      this.entityGraphics.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

      this.entityGraphics.lineStyle(1, 0x20160f, 0.7);
      this.entityGraphics.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

      if (selected) {
        this.entityGraphics.lineStyle(2, 0xffe394, 0.95);
        this.entityGraphics.strokeRect(x - 1, y - 1, tileSize + 2, tileSize + 2);
      }

      if (!room.isComplete) {
        this.entityGraphics.fillStyle(0xffe18d, 0.7);
        const ratio =
          1 -
          room.buildTimeRemaining /
            Math.max(
              0.001,
              this.engine.configBundle.rooms.roomTypes.find((type) => type.id === room.typeId)
                ?.buildTime ?? 1
            );
        this.entityGraphics.fillRect(x + 2, y + tileSize - 4, (tileSize - 4) * ratio, 2);
      }
    }
  }

  drawAntsAndEnemies() {
    const terrain = this.engine.getSystem("terrain");
    const ants = this.engine.getSystem("ants");
    const enemies = this.engine.getSystem("enemies");
    const tileSize = terrain.tileSize;

    for (const ant of ants.getAliveAnts()) {
      const px = ant.x * tileSize;
      const py = ant.y * tileSize;
      const selected = this.selectedAntIds.has(ant.id);

      this.entityGraphics.fillStyle(roleColor(ant.role), 1);
      this.entityGraphics.fillCircle(px, py, selected ? 4.7 : 3.5);

      if (selected) {
        this.entityGraphics.lineStyle(1, 0xfcf7cb, 0.95);
        this.entityGraphics.strokeCircle(px, py, 7);
      }

      const hpRatio = ant.hp / Math.max(1, ant.stats.health);
      this.entityGraphics.fillStyle(0x132117, 0.9);
      this.entityGraphics.fillRect(px - 5, py - 8, 10, 2);
      this.entityGraphics.fillStyle(0x8be091, 0.95);
      this.entityGraphics.fillRect(px - 5, py - 8, 10 * hpRatio, 2);
    }

    for (const enemy of enemies.getAliveEnemies()) {
      const px = enemy.x * tileSize;
      const py = enemy.y * tileSize;

      this.entityGraphics.fillStyle(0xd46f65, 0.95);
      this.entityGraphics.fillCircle(px, py, 4.5);

      const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
      this.entityGraphics.fillStyle(0x2b1212, 0.9);
      this.entityGraphics.fillRect(px - 6, py - 9, 12, 2);
      this.entityGraphics.fillStyle(0xf7b2ae, 0.95);
      this.entityGraphics.fillRect(px - 6, py - 9, 12 * hpRatio, 2);
    }
  }

  drawDebugOverlays() {
    const debug = this.engine.getSystem("debug");
    const terrain = this.engine.getSystem("terrain");
    const pheromones = this.engine.getSystem("pheromones");

    const tileSize = terrain.tileSize;

    if (debug.toggles.showPathfindingGrid) {
      this.uiGraphics.lineStyle(1, 0x3a5144, 0.18);
      for (let x = 0; x <= terrain.width; x += 1) {
        this.uiGraphics.beginPath();
        this.uiGraphics.moveTo(x * tileSize, 0);
        this.uiGraphics.lineTo(x * tileSize, terrain.height * tileSize);
        this.uiGraphics.strokePath();
      }
      for (let y = 0; y <= terrain.height; y += 1) {
        this.uiGraphics.beginPath();
        this.uiGraphics.moveTo(0, y * tileSize);
        this.uiGraphics.lineTo(terrain.width * tileSize, y * tileSize);
        this.uiGraphics.strokePath();
      }
    }

    if (debug.toggles.showPheromoneHeatmap) {
      for (const [key, payload] of pheromones.trails.entries()) {
        const [xString, yString] = key.split(",");
        const x = Number(xString);
        const y = Number(yString);
        const value =
          Number(payload.FoodTrail ?? 0) +
          Number(payload.Danger ?? 0) +
          Number(payload.Explore ?? 0) +
          Number(payload.Rally ?? 0) +
          Number(payload.Avoid ?? 0) +
          Number(payload.BuildHere ?? 0) +
          Number(payload.DigHere ?? 0);

        const alpha = Phaser.Math.Clamp(value / 8, 0.08, 0.55);
        this.uiGraphics.fillStyle(0x9ee7a8, alpha);
        this.uiGraphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    if (this.selectionBox.active && this.selectionBox.dragged) {
      const minX = Math.min(this.selectionBox.start.x, this.selectionBox.end.x);
      const maxX = Math.max(this.selectionBox.start.x, this.selectionBox.end.x);
      const minY = Math.min(this.selectionBox.start.y, this.selectionBox.end.y);
      const maxY = Math.max(this.selectionBox.start.y, this.selectionBox.end.y);

      this.uiGraphics.fillStyle(0x88b0a0, 0.15);
      this.uiGraphics.fillRect(minX, minY, maxX - minX, maxY - minY);
      this.uiGraphics.lineStyle(1, 0xdcefb1, 0.8);
      this.uiGraphics.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }
  }

  renderWorld() {
    this.entityGraphics.clear();
    this.uiGraphics.clear();

    this.drawTerrain();
    this.drawRooms();
    this.drawAntsAndEnemies();
    this.drawDebugOverlays();
  }

  update(_time, delta) {
    const dt = delta / 1000;

    this.handleHotkeys();
    this.handleFreeCamera(dt);

    this.engine.update(dt);
    this.renderWorld();
  }
}
