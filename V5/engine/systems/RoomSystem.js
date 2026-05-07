import { RoomEntity } from "../../entities/RoomEntity.js";
import { BaseSystem } from "../BaseSystem.js";

export class RoomSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "rooms", config);
    this.roomTypeMap = new Map();
    this.rooms = [];
    this.defaultBuildType = "food_storage";
    this.aggregateEffectsCache = null;
    this.aggregateEffectsTimer = 0;
  }

  init() {
    for (const roomType of this.config.roomTypes ?? []) {
      this.roomTypeMap.set(roomType.id, roomType);
      if (roomType.defaultBuildSelection) {
        this.defaultBuildType = roomType.id;
      }
    }

    const terrain = this.engine.getSystem("terrain");
    const origin = terrain?.colonyOrigin ?? { x: 48, y: 20 };

    this.placeInstantRoom("queen_chamber", origin.x, origin.y);
    this.placeInstantRoom("food_storage", origin.x + 3, origin.y);
    this.placeInstantRoom("brood_chamber", origin.x - 3, origin.y + 1);
  }

  placeInstantRoom(typeId, x, y) {
    const typeDef = this.roomTypeMap.get(typeId);
    if (!typeDef) {
      return null;
    }

    const room = new RoomEntity(typeDef, { x, y });
    room.isComplete = true;
    room.buildTimeRemaining = 0;
    this.rooms.push(room);
    this.engine.getSystem("terrain")?.setRoomTile(x, y);
    return room;
  }

  isOccupied(x, y) {
    return this.rooms.some((room) => room.tilePosition.x === x && room.tilePosition.y === y);
  }

  canBuildRoom(typeId, x, y) {
    const typeDef = this.roomTypeMap.get(typeId);
    if (!typeDef) {
      return false;
    }

    const terrain = this.engine.getSystem("terrain");
    if (!terrain?.inBounds(x, y) || this.isOccupied(x, y)) {
      return false;
    }

    const tile = terrain.getTile(x, y);
    if (!tile || (tile.type !== "tunnel" && tile.type !== "dirt")) {
      return false;
    }

    const resources = this.engine.getSystem("resources");
    if (!resources?.canAfford(typeDef.buildCost ?? {})) {
      return false;
    }

    return true;
  }

  queueRoomBuild(typeId, x, y) {
    if (!this.canBuildRoom(typeId, x, y)) {
      return false;
    }

    const typeDef = this.roomTypeMap.get(typeId);
    const resources = this.engine.getSystem("resources");
    if (!resources?.applyCost(typeDef.buildCost ?? {})) {
      return false;
    }

    const terrain = this.engine.getSystem("terrain");
    if (terrain?.isDiggable(x, y)) {
      terrain.digTile(x, y, 999);
    }

    const room = new RoomEntity(typeDef, { x, y });
    this.rooms.push(room);
    this.aggregateEffectsCache = null;
    return true;
  }

  upgradeRoom(roomId) {
    const room = this.rooms.find((entry) => entry.id === roomId);
    if (!room || room.upgradeTimeRemaining > 0 || !room.isComplete) {
      return false;
    }

    const typeDef = this.roomTypeMap.get(room.typeId);
    if (!typeDef || room.level >= Number(typeDef.maxLevel ?? 3)) {
      return false;
    }

    const resources = this.engine.getSystem("resources");
    const levelMultiplier = 1 + room.level * 0.5;
    const upgradeCost = {};

    for (const [id, amount] of Object.entries(typeDef.upgradeCost ?? {})) {
      upgradeCost[id] = Math.floor(Number(amount) * levelMultiplier);
    }

    if (!resources?.applyCost(upgradeCost)) {
      return false;
    }

    room.beginUpgrade(typeDef);
    this.aggregateEffectsCache = null;
    return true;
  }

  getRoomCounts() {
    const counts = {};
    for (const room of this.rooms) {
      counts[room.typeId] = (counts[room.typeId] ?? 0) + 1;
    }
    return counts;
  }

  getClosestRoom(typeId, x, y) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const room of this.rooms) {
      if (typeId && room.typeId !== typeId) {
        continue;
      }
      const dx = room.tilePosition.x - x;
      const dy = room.tilePosition.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDist) {
        bestDist = distSq;
        best = room;
      }
    }
    return best;
  }

  computeAggregateEffects() {
    const output = {
      storageBonus: {},
      productionMultiplier: {},
      consumptionMultiplier: {},
      hatchRateMultiplier: 1,
      healingRateBonus: 0,
      researchPerSecond: 0,
      defenseBonus: 0,
      moraleBonus: 0
    };

    const tech = this.engine.getSystem("tech");
    const storageTechMultiplier = Number(tech?.getEffect("storage.capacityMultiplier", 1) ?? 1);
    const hatchTechMultiplier = Number(tech?.getEffect("brood.hatchRateMultiplier", 1) ?? 1);
    const moraleEnvironmentMultiplier = Number(
      tech?.getEffect("morale.environmentMultiplier", 1) ?? 1
    );
    const roomDefenseMultiplier = Number(tech?.getEffect("room.durabilityMultiplier", 1) ?? 1);

    for (const room of this.rooms) {
      if (!room.isComplete) {
        continue;
      }

      const typeDef = this.roomTypeMap.get(room.typeId);
      if (!typeDef) {
        continue;
      }

      const scale = 1 + (room.level - 1) * 0.4;
      const effects = typeDef.passiveEffects ?? {};

      for (const [resourceId, value] of Object.entries(effects.storageBonus ?? {})) {
        output.storageBonus[resourceId] =
          (output.storageBonus[resourceId] ?? 0) + Number(value) * scale * storageTechMultiplier;
      }

      for (const [resourceId, value] of Object.entries(effects.productionMultiplier ?? {})) {
        output.productionMultiplier[resourceId] =
          (output.productionMultiplier[resourceId] ?? 1) * (1 + (Number(value) - 1) * scale);
      }

      for (const [resourceId, value] of Object.entries(effects.consumptionMultiplier ?? {})) {
        output.consumptionMultiplier[resourceId] =
          (output.consumptionMultiplier[resourceId] ?? 1) * (1 + (Number(value) - 1) * scale);
      }

      output.hatchRateMultiplier += Number(effects.hatchRateBonus ?? 0) * scale;
      output.healingRateBonus += Number(effects.healingRateBonus ?? 0) * scale;
      output.researchPerSecond += Number(effects.researchPerSecond ?? 0) * scale;
      output.defenseBonus += Number(effects.defenseBonus ?? 0) * scale;
      output.moraleBonus += Number(effects.moraleBonus ?? 0) * scale * moraleEnvironmentMultiplier;

      for (const synergy of room.synergyBonuses ?? []) {
        const near = this.getClosestRoom(
          synergy.withType,
          room.tilePosition.x,
          room.tilePosition.y
        );
        if (!near || near.id === room.id) {
          continue;
        }

        const dx = Math.abs(near.tilePosition.x - room.tilePosition.x);
        const dy = Math.abs(near.tilePosition.y - room.tilePosition.y);
        if (dx + dy <= Number(synergy.maxDistance ?? 6)) {
          if (synergy.resource && synergy.multiplier) {
            output.productionMultiplier[synergy.resource] =
              (output.productionMultiplier[synergy.resource] ?? 1) * Number(synergy.multiplier);
          }
          output.moraleBonus += Number(synergy.moraleBonus ?? 0) * moraleEnvironmentMultiplier;
        }
      }
    }

    output.hatchRateMultiplier *= hatchTechMultiplier;
    output.defenseBonus *= roomDefenseMultiplier;

    return output;
  }

  getAggregateEffects() {
    if (!this.aggregateEffectsCache || this.aggregateEffectsTimer <= 0) {
      this.aggregateEffectsCache = this.computeAggregateEffects();
      this.aggregateEffectsTimer = 1;
    }
    return this.aggregateEffectsCache;
  }

  update(dt) {
    this.aggregateEffectsTimer -= dt;

    const tech = this.engine.getSystem("tech");
    const buildSpeed = Math.max(0.1, Number(tech?.getEffect("room.buildSpeedMultiplier", 1) ?? 1));
    const upgradeSpeed = Math.max(
      0.1,
      Number(tech?.getEffect("room.upgradeSpeedMultiplier", 1) ?? 1)
    );

    const terrain = this.engine.getSystem("terrain");
    for (const room of this.rooms) {
      const typeDef = this.roomTypeMap.get(room.typeId);
      const wasComplete = room.isComplete;
      const speedMultiplier = room.isComplete ? upgradeSpeed : buildSpeed;
      room.update(dt * speedMultiplier, typeDef);
      if (!wasComplete && room.isComplete) {
        terrain?.setRoomTile(room.tilePosition.x, room.tilePosition.y);
      }
    }
  }

  serialize() {
    return {
      defaultBuildType: this.defaultBuildType,
      rooms: this.rooms.map((room) => room.serialize())
    };
  }

  deserialize(state) {
    this.defaultBuildType = state.defaultBuildType ?? this.defaultBuildType;
    this.rooms = (state.rooms ?? [])
      .map((serialized) => {
        const typeDef = this.roomTypeMap.get(serialized.typeId);
        if (!typeDef) {
          return null;
        }
        return RoomEntity.deserialize(serialized, typeDef);
      })
      .filter(Boolean);
    this.aggregateEffectsCache = null;
    this.aggregateEffectsTimer = 0;
  }

  reset() {
    this.rooms = [];
    this.aggregateEffectsCache = null;
    this.aggregateEffectsTimer = 0;
    this.init();
  }
}
