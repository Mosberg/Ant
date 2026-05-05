export class Room {
  constructor(type, tiles, level = 1) {
    this.type = type;
    this.tiles = tiles;
    this.level = level;
    this.health = 120 + level * 50;
    this.maxHealth = this.health;
    this.progress = 1;
  }

  center() {
    const mid = this.tiles[Math.floor(this.tiles.length / 2)];
    return { tx: mid.x, ty: mid.y };
  }
}
