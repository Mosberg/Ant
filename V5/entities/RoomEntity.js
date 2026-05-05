import { uuid } from "../engine/utils.js";

export class RoomEntity {
  constructor(typeDef, tilePosition) {
    this.id = uuid("room");
    this.typeId = typeDef.id;
    this.name = typeDef.name;
    this.level = 1;
    this.tilePosition = { x: tilePosition.x, y: tilePosition.y };
    this.capacity = typeDef.capacity ?? 0;
    this.passiveEffects = { ...(typeDef.passiveEffects ?? {}) };
    this.activeAbilities = [...(typeDef.activeAbilities ?? [])];
    this.synergyBonuses = [...(typeDef.synergyBonuses ?? [])];
    this.buildTimeRemaining = Number(typeDef.buildTime ?? 0);
    this.upgradeTimeRemaining = 0;
    this.isComplete = this.buildTimeRemaining <= 0;
  }

  beginUpgrade(typeDef) {
    this.upgradeTimeRemaining = Number(typeDef.upgradeTime ?? 0);
  }

  update(dt, typeDef) {
    if (!this.isComplete) {
      this.buildTimeRemaining = Math.max(0, this.buildTimeRemaining - dt);
      this.isComplete = this.buildTimeRemaining <= 0;
      return;
    }

    if (this.upgradeTimeRemaining > 0) {
      this.upgradeTimeRemaining = Math.max(0, this.upgradeTimeRemaining - dt);
      if (this.upgradeTimeRemaining === 0) {
        this.level += 1;
        this.capacity += Number(typeDef.upgradeCapacityGain ?? 0);
      }
    }
  }

  serialize() {
    return {
      id: this.id,
      typeId: this.typeId,
      name: this.name,
      level: this.level,
      tilePosition: this.tilePosition,
      capacity: this.capacity,
      passiveEffects: this.passiveEffects,
      activeAbilities: this.activeAbilities,
      synergyBonuses: this.synergyBonuses,
      buildTimeRemaining: this.buildTimeRemaining,
      upgradeTimeRemaining: this.upgradeTimeRemaining,
      isComplete: this.isComplete
    };
  }

  static deserialize(serialized, typeDef) {
    const room = new RoomEntity(typeDef, serialized.tilePosition);
    room.id = serialized.id;
    room.level = serialized.level;
    room.capacity = serialized.capacity;
    room.passiveEffects = { ...serialized.passiveEffects };
    room.activeAbilities = [...serialized.activeAbilities];
    room.synergyBonuses = [...serialized.synergyBonuses];
    room.buildTimeRemaining = serialized.buildTimeRemaining;
    room.upgradeTimeRemaining = serialized.upgradeTimeRemaining;
    room.isComplete = serialized.isComplete;
    return room;
  }
}
