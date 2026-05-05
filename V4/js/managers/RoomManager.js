import { ROOM_KIND, ROOM_TYPES, TILE, UNDERGROUND_START } from "../core/constants.js";
import { Room } from "../entities/Room.js";

export class RoomManager {
  constructor(scene) {
    this.scene = scene;
    this.rooms = [];
    this.roomTileLookup = new Map();
  }

  createInitialRooms() {
    this.placeFixedRoom(ROOM_KIND.QUEEN, 23, 13, 4, 3, 1);
    this.placeFixedRoom(ROOM_KIND.BROOD, 18, 15, 3, 2, 1);
    this.placeFixedRoom(ROOM_KIND.STORAGE, 28, 15, 3, 2, 1);
    this.placeFixedRoom(ROOM_KIND.BARRACKS, 23, 18, 3, 2, 1);
    this.applyRoomBonuses();
  }

  placeFixedRoom(type, x, y, w, h, level = 1) {
    const tiles = [];
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        this.scene.map[ty][tx] = TILE.ROOM;
        this.scene.roomTypeMap[ty][tx] = type;
        tiles.push({ x: tx, y: ty });
        this.roomTileLookup.set(`${tx},${ty}`, type);
      }
    }
    const room = new Room(type, tiles, level);
    this.rooms.push(room);
    return room;
  }

  canPlaceRoom(type, originTx, originTy) {
    const def = ROOM_TYPES[type];
    if (!def) return false;
    const { w, h } = def.size;

    for (let ty = originTy; ty < originTy + h; ty++) {
      for (let tx = originTx; tx < originTx + w; tx++) {
        if (!this.scene.inBounds(tx, ty)) return false;
        if (ty < UNDERGROUND_START) return false;
        if (this.scene.map[ty][tx] !== TILE.TUNNEL) return false;
      }
    }
    return true;
  }

  buildRoom(type, originTx, originTy) {
    const def = ROOM_TYPES[type];
    if (!def) return { ok: false, reason: "Unknown room type" };
    if (type === ROOM_KIND.UTILITY && !this.scene.resources.unlocks.utility) {
      return {
        ok: false,
        reason: "Utility room locked. Gather more food first."
      };
    }
    if (!this.canPlaceRoom(type, originTx, originTy)) {
      return {
        ok: false,
        reason: "Need a cleared underground tunnel area."
      };
    }
    if (!this.scene.resources.spendFood(def.cost)) {
      return { ok: false, reason: "Not enough food." };
    }

    const tiles = [];
    for (let ty = originTy; ty < originTy + def.size.h; ty++) {
      for (let tx = originTx; tx < originTx + def.size.w; tx++) {
        this.scene.map[ty][tx] = TILE.ROOM;
        this.scene.roomTypeMap[ty][tx] = type;
        tiles.push({ x: tx, y: ty });
        this.roomTileLookup.set(`${tx},${ty}`, type);
      }
    }

    const room = new Room(type, tiles, 1);
    room.progress = 0;
    this.rooms.push(room);
    this.scene.audio.build();
    this.scene.spawnBuildParticles(originTx, originTy);
    this.applyRoomBonuses();
    return { ok: true, room };
  }

  roomAt(tx, ty) {
    return this.rooms.find((r) => r.tiles.some((t) => t.x === tx && t.y === ty));
  }

  upgradeRoom(room) {
    const def = ROOM_TYPES[room.type];
    if (!def) return { ok: false, reason: "This room cannot be upgraded." };
    if (room.level >= def.maxLevel) return { ok: false, reason: "Already max level." };
    const cost = Math.ceil(def.cost * (1 + room.level * 0.75));
    if (!this.scene.resources.spendFood(cost)) {
      return { ok: false, reason: "Not enough food to upgrade." };
    }
    room.level += 1;
    room.maxHealth += 60;
    room.health = room.maxHealth;
    this.scene.audio.build();
    this.scene.spawnBuildParticles(room.tiles[0].x, room.tiles[0].y);
    this.applyRoomBonuses();
    return { ok: true };
  }

  applyRoomBonuses() {
    let foodCap = 160;
    let popCap = 12;
    let soldierPower = 1;
    let moraleBonus = 0;
    let soldierCap = 4;

    for (const room of this.rooms) {
      if (room.type === ROOM_KIND.STORAGE) {
        foodCap += ROOM_TYPES.storage.levels[room.level].foodCap;
      }
      if (room.type === ROOM_KIND.BROOD) {
        popCap += ROOM_TYPES.brood.levels[room.level].popBonus;
      }
      if (room.type === ROOM_KIND.BARRACKS) {
        soldierPower *= ROOM_TYPES.barracks.levels[room.level].soldierPower;
        soldierCap += ROOM_TYPES.barracks.levels[room.level].soldierCap;
      }
      if (room.type === ROOM_KIND.UTILITY) {
        moraleBonus += ROOM_TYPES.utility.levels[room.level].moraleBonus;
      }
    }

    this.scene.resources.foodCap = foodCap;
    this.scene.resources.populationCap = popCap;
    this.scene.colonyModifiers.soldierPower = soldierPower;
    this.scene.colonyModifiers.moraleBonus = moraleBonus;
    this.scene.colonyModifiers.soldierCap = soldierCap;
  }

  getQueenRoom() {
    return this.rooms.find((r) => r.type === ROOM_KIND.QUEEN);
  }

  broodRooms() {
    return this.rooms.filter((r) => r.type === ROOM_KIND.BROOD);
  }
}
