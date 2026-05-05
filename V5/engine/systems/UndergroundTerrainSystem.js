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
  }

  init() {
    this.generate();
  }

  generate() {
    this.tiles = [];
    this.digOrders = [];

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
    tile.type = "room";
    tile.hardness = 0;
    tile.flooded = false;
  }

  setTunnelTile(x, y) {
    const tile = this.getTile(x, y);
    if (!tile) {
      return;
    }
    tile.type = "tunnel";
    tile.hardness = 0;
    tile.flooded = false;
  }

  update(dt) {
    const weather = this.engine.getSystem("weather");
    const weatherId = weather?.getCurrentWeather()?.id ?? "clear";

    if (weatherId === "rain" || weatherId === "storm") {
      const floodRows = this.surfaceBandHeight + 2;
      for (let y = this.surfaceBandHeight; y < Math.min(this.height, floodRows + 6); y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const tile = this.tiles[y][x];
          if (tile.type === "tunnel") {
            const floodChance = weatherId === "storm" ? 0.0012 * dt * 60 : 0.00055 * dt * 60;
            if (Math.random() < floodChance) {
              tile.flooded = true;
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
          }
        }
      }
    }

    // Prevent dig queues from growing without bounds.
    this.digOrders = this.digOrders.slice(0, 450);
  }

  serialize() {
    return {
      width: this.width,
      height: this.height,
      surfaceBandHeight: this.surfaceBandHeight,
      tileSize: this.tileSize,
      colonyOrigin: this.colonyOrigin,
      digOrders: this.digOrders,
      tiles: this.tiles
    };
  }

  deserialize(state) {
    this.width = Number(state.width ?? this.width);
    this.height = Number(state.height ?? this.height);
    this.surfaceBandHeight = Number(state.surfaceBandHeight ?? this.surfaceBandHeight);
    this.tileSize = Number(state.tileSize ?? this.tileSize);
    this.colonyOrigin = { ...state.colonyOrigin };
    this.digOrders = Array.isArray(state.digOrders) ? [...state.digOrders] : [];
    this.tiles = Array.isArray(state.tiles) ? state.tiles : [];
  }

  reset() {
    this.generate();
  }
}
