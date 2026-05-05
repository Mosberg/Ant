export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randomChoice(list, fallback = null) {
  if (!Array.isArray(list) || list.length === 0) {
    return fallback;
  }
  return list[Math.floor(Math.random() * list.length)];
}

export function weightedChoice(weightedItems, fallback = null) {
  if (!Array.isArray(weightedItems) || weightedItems.length === 0) {
    return fallback;
  }

  const total = weightedItems.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  if (total <= 0) {
    return randomChoice(weightedItems, fallback);
  }

  let roll = Math.random() * total;
  for (const item of weightedItems) {
    roll -= Math.max(0, Number(item.weight) || 0);
    if (roll <= 0) {
      return item;
    }
  }
  return weightedItems[weightedItems.length - 1] ?? fallback;
}

export function getByPath(root, path, fallback = undefined) {
  if (!root || typeof path !== "string") {
    return fallback;
  }

  const keys = path.split(".");
  let current = root;

  for (const key of keys) {
    if (current == null || typeof current !== "object" || !(key in current)) {
      return fallback;
    }
    current = current[key];
  }
  return current;
}

export function setByPath(root, path, value) {
  const keys = path.split(".");
  let current = root;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return root;
}

export function uuid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
