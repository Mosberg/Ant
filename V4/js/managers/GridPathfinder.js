export class GridPathfinder {
  constructor(scene) {
    this.scene = scene;
  }

  findPath(startTx, startTy, endTx, endTy) {
    if (!this.scene.isWalkable(endTx, endTy)) return [];
    const key = (x, y) => `${x},${y}`;
    const queue = [{ x: startTx, y: startTy }];
    const cameFrom = new Map();
    cameFrom.set(key(startTx, startTy), null);

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.x === endTx && current.y === endTy) break;

      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const k = key(nx, ny);
        if (!this.scene.inBounds(nx, ny)) continue;
        if (!this.scene.isWalkable(nx, ny)) continue;
        if (cameFrom.has(k)) continue;
        cameFrom.set(k, current);
        queue.push({ x: nx, y: ny });
      }
    }

    const endKey = key(endTx, endTy);
    if (!cameFrom.has(endKey)) return [];

    const path = [];
    let current = { x: endTx, y: endTy };
    while (current) {
      path.push(current);
      current = cameFrom.get(key(current.x, current.y));
    }
    path.reverse();
    return path;
  }
}
