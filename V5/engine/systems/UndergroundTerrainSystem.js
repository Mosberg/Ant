import { BaseSystem } from "../BaseSystem.js";

function createTile(type, hardness = 1) {
  return {
    type,
    hardness,
    flooded: false
  };
}

export class UndergroundTerrainSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "terrain", config);
    this.width = Number(config.world?.width ?? 96);
    this.height = Number(config.world?.height ?? 64);
    this.surfaceBandHeight = Number(config.world?.surfaceBandHeight ?? 11);
    this.tileSize = Number(config.world?.tileSize ?? 16);
    this.colonyOrigin = {
      x: Math.floor(this.width * 0.5),
      y: this.surfaceBandHeight + 9
    };
    this.tiles = [];
    this.digOrders = [];
    this.entryLanes = [];
    this.entryCorridor = null;
    this.revision = 0;
  }

  init() {
    this.generate();
  }

  generate() {
    this.tiles = [];
    this.digOrders = [];
    this.entryLanes = [];
    this.entryCorridor = null;

    for (let y = 0; y < this.height; y += 1) {
      const row = [];
      for (let x = 0; x < this.width; x += 1) {
        if (y < this.surfaceBandHeight) {
          row.push(createTile("surface", 0));
          continue;
        }

        const roll = Math.random();
        if (roll < 0.115) {
          row.push(createTile("rock", 999));
        } else if (roll < 0.136) {
          row.push(createTile("crystal", 3));
        } else {
          row.push(createTile("dirt", 1.6));
        }
      }
      this.tiles.push(row);
    }

    for (let y = this.colonyOrigin.y - 3; y <= this.colonyOrigin.y + 3; y += 1) {
      for (let x = this.colonyOrigin.x - 4; x <= this.colonyOrigin.x + 4; x += 1) {
        if (!this.inBounds(x, y)) {
          continue;
        }
        this.tiles[y][x] = createTile("tunnel", 0);
      }
    }

    this.generateEntryLanes();

    this.markDirty();
  }

  generateEntryLanes() {
    const offsets = [-8, -2, 5];
    const connectorY = Math.max(this.surfaceBandHeight, this.colonyOrigin.y - 3);
    const laneXs = [];

    for (const offset of offsets) {
      const x = Math.max(1, Math.min(this.width - 2, this.colonyOrigin.x + offset));
      laneXs.push(x);

      for (let y = this.surfaceBandHeight; y <= connectorY; y += 1) {
        if (!this.inBounds(x, y)) {
          continue;
        }
        this.tiles[y][x] = createTile("tunnel", 0);
      }

      this.entryLanes.push({
        x,
        surfaceY: 0,
        entryY: this.surfaceBandHeight,
        connectorY
      });
    }

    const minX = Math.min(...laneXs, this.colonyOrigin.x - 4);
    const maxX = Math.max(...laneXs, this.colonyOrigin.x + 4);
    this.entryCorridor = {
      y: connectorY,
      minX,
      maxX
    };

    for (let x = minX; x <= maxX; x += 1) {
      if (!this.inBounds(x, connectorY)) {
        continue;
      }
      this.tiles[connectorY][x] = createTile("tunnel", 0);
    }
  }

  isCriticalEntryTile(x, y) {
    if (this.entryCorridor) {
      if (
        y === this.entryCorridor.y &&
        x >= this.entryCorridor.minX &&
        x <= this.entryCorridor.maxX
      ) {
        return true;
      }
    }

    for (const lane of this.entryLanes) {
      if (x !== lane.x) {
        continue;
      }
      if (y >= this.surfaceBandHeight && y <= Number(lane.connectorY ?? this.surfaceBandHeight)) {
        return true;
      }
    }

    return false;
  }

  getEnemyEntryLanes() {
    if (!Array.isArray(this.entryLanes) || this.entryLanes.length === 0) {
      return [];
    }
    return this.entryLanes.map((lane) => ({ ...lane }));
  }

  markDirty() {
    this.revision += 1;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) {
      return null;
    }
    return this.tiles[y][x];
  }

  isPassable(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) {
      return false;
    }
    if (tile.flooded) {
      return false;
    }
    return tile.type === "tunnel" || tile.type === "surface" || tile.type === "room";
  }

  isDiggable(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) {
      return false;
    }
    return tile.type === "dirt" || tile.type === "crystal";
  }

  queueDigOrder(x, y) {
    if (!this.isDiggable(x, y)) {
      return false;
    }

    if (this.digOrders.some((order) => order.x === x && order.y === y)) {
      return false;
    }

    this.digOrders.push({ x, y });
    return true;
  }

  hasDigOrder(x, y) {
    return this.digOrders.some((order) => order.x === x && order.y === y);
  }

  removeDigOrder(x, y) {
    const index = this.digOrders.findIndex((order) => order.x === x && order.y === y);
    if (index < 0) {
      return false;
    }
    this.digOrders.splice(index, 1);
    return true;
  }

  findDigOrderNear(x, y, radius = 6) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const order of this.digOrders) {
      const dx = order.x - x;
      const dy = order.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius && distSq < bestDistance) {
        bestDistance = distSq;
        best = order;
      }
    }

    return best ? { ...best } : null;
  }

  consumeDigOrderNear(x, y, radius = 6) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.digOrders.length; i += 1) {
      const order = this.digOrders[i];
      const dx = order.x - x;
      const dy = order.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radius * radius && distSq < bestDistance) {
        bestDistance = distSq;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      return null;
    }

    const [order] = this.digOrders.splice(bestIndex, 1);
    return order;
  }

  digTile(x, y, power = 1) {
    const tile = this.getTile(x, y);
    if (!tile || !this.isDiggable(x, y)) {
      return null;
    }

    tile.hardness -= power;
    if (tile.hardness > 0) {
      return null;
    }

    const yieldType = tile.type === "crystal" ? "crystal" : "stone";
    this.tiles[y][x] = createTile("tunnel", 0);
    this.markDirty();
    return {
      resource: yieldType,
      amount: yieldType === "crystal" ? 2 : 1
    };
  }

  setRoomTile(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) {
      return;
    }
    if (tile.type === "room" && !tile.flooded && tile.hardness === 0) {
      return;
    }
    tile.type = "room";
    tile.hardness = 0;
    tile.flooded = false;
    this.markDirty();
  }

  setTunnelTile(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) {
      return;
    }
    if (tile.type === "tunnel" && !tile.flooded && tile.hardness === 0) {
      return;
    }
    tile.type = "tunnel";
    tile.hardness = 0;
    tile.flooded = false;
    this.markDirty();
  }

  update(dt) {
    const weather = this.engine.getSystem("weather");
    const weatherId = weather?.getCurrentWeather()?.id ?? "clear";
    let changed = false;

    if (weatherId === "rain" || weatherId === "storm") {
      const floodRows = this.surfaceBandHeight + 2;
      for (let y = this.surfaceBandHeight; y < Math.min(this.height, floodRows + 6); y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const tile = this.tiles[y][x];
          if (tile.type === "tunnel") {
            if (this.isCriticalEntryTile(x, y)) {
              continue;
            }
            const floodChance = weatherId === "storm" ? 0.0012 * dt * 60 : 0.00055 * dt * 60;
            if (Math.random() < floodChance) {
              if (!tile.flooded) {
                tile.flooded = true;
                changed = true;
              }
            }
          }
        }
      }
    } else {
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const tile = this.tiles[y][x];
          if (tile.flooded && Math.random() < 0.0015 * dt * 60) {
            tile.flooded = false;
            changed = true;
          }
        }
      }
    }

    // Prevent dig queues from growing without bounds.
    this.digOrders = this.digOrders.slice(0, 450);

    if (changed) {
      this.markDirty();
    }
  }

  serialize() {
    return {
      width: this.width,
      height: this.height,
      surfaceBandHeight: this.surfaceBandHeight,
      tileSize: this.tileSize,
      colonyOrigin: this.colonyOrigin,
      revision: this.revision,
      digOrders: this.digOrders,
      entryLanes: this.entryLanes,
      entryCorridor: this.entryCorridor,
      tiles: this.tiles
    };
  }

  deserialize(state) {
    this.width = Number(state.width ?? this.width);
    this.height = Number(state.height ?? this.height);
    this.surfaceBandHeight = Number(state.surfaceBandHeight ?? this.surfaceBandHeight);
    this.tileSize = Number(state.tileSize ?? this.tileSize);
    this.colonyOrigin = { ...state.colonyOrigin };
    this.revision = Number(state.revision ?? this.revision + 1);
    this.digOrders = Array.isArray(state.digOrders) ? [...state.digOrders] : [];
    this.entryLanes = Array.isArray(state.entryLanes) ? [...state.entryLanes] : [];
    this.entryCorridor = state.entryCorridor ? { ...state.entryCorridor } : null;
    this.tiles = Array.isArray(state.tiles) ? state.tiles : [];

    if (this.entryLanes.length === 0 && this.tiles.length > 0) {
      this.generateEntryLanes();
      this.markDirty();
    }
  }

  reset() {
    this.generate();
  }
}
