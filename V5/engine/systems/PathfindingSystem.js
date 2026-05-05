import { BaseSystem } from "../BaseSystem.js";

function key(x, y) {
  return `${x},${y}`;
}

export class PathfindingSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "pathfinding", config);
    this.metrics = {
      queries: 0,
      totalVisited: 0,
      averageVisited: 0
    };
  }

  init() {}

  getNeighbors(x, y) {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  findPath(start, goal, maxVisited = 1600) {
    const terrain = this.engine.getSystem("terrain");
    if (!terrain || !terrain.inBounds(start.x, start.y) || !terrain.inBounds(goal.x, goal.y)) {
      return [];
    }

    this.metrics.queries += 1;

    const open = [{ ...start, f: 0, g: 0 }];
    const openMap = new Map([[key(start.x, start.y), open[0]]]);
    const cameFrom = new Map();
    const gScore = new Map([[key(start.x, start.y), 0]]);
    const closed = new Set();
    let visited = 0;

    while (open.length > 0 && visited < maxVisited) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      if (!current) {
        break;
      }
      openMap.delete(key(current.x, current.y));
      visited += 1;

      if (current.x === goal.x && current.y === goal.y) {
        this.metrics.totalVisited += visited;
        this.metrics.averageVisited = this.metrics.totalVisited / this.metrics.queries;
        return this.reconstructPath(cameFrom, current);
      }

      closed.add(key(current.x, current.y));

      for (const neighbor of this.getNeighbors(current.x, current.y)) {
        if (!terrain.inBounds(neighbor.x, neighbor.y)) {
          continue;
        }

        const neighborKey = key(neighbor.x, neighbor.y);
        if (closed.has(neighborKey)) {
          continue;
        }

        const tilePassable =
          terrain.isPassable(neighbor.x, neighbor.y) ||
          (neighbor.x === goal.x && neighbor.y === goal.y);

        if (!tilePassable) {
          continue;
        }

        const tentative = (gScore.get(key(current.x, current.y)) ?? Number.POSITIVE_INFINITY) + 1;
        const existing = gScore.get(neighborKey);

        if (existing == null || tentative < existing) {
          cameFrom.set(neighborKey, { x: current.x, y: current.y });
          gScore.set(neighborKey, tentative);

          const node = {
            x: neighbor.x,
            y: neighbor.y,
            g: tentative,
            f: tentative + this.heuristic(neighbor, goal)
          };

          if (!openMap.has(neighborKey)) {
            open.push(node);
            openMap.set(neighborKey, node);
          }
        }
      }
    }

    this.metrics.totalVisited += visited;
    this.metrics.averageVisited = this.metrics.totalVisited / this.metrics.queries;
    return [];
  }

  reconstructPath(cameFrom, current) {
    const path = [{ x: current.x, y: current.y }];
    let cursorKey = key(current.x, current.y);

    while (cameFrom.has(cursorKey)) {
      const previous = cameFrom.get(cursorKey);
      path.push({ x: previous.x, y: previous.y });
      cursorKey = key(previous.x, previous.y);
    }

    return path.reverse();
  }

  update(_dt) {}

  serialize() {
    return {
      metrics: { ...this.metrics }
    };
  }

  deserialize(state) {
    this.metrics = {
      ...this.metrics,
      ...(state.metrics ?? {})
    };
  }

  reset() {
    this.metrics = {
      queries: 0,
      totalVisited: 0,
      averageVisited: 0
    };
  }
}
