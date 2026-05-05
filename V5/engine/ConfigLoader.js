const REQUIRED_CONFIGS = [
  "ants",
  "rooms",
  "resources",
  "tech",
  "events",
  "settings",
  "enemies",
  "weather"
];

async function readJson(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Unable to load ${url} (HTTP ${response.status})`);
  }
  return response.json();
}

function validateBundle(bundle) {
  for (const key of REQUIRED_CONFIGS) {
    if (!bundle[key]) {
      throw new Error(`Missing required config: ${key}.json`);
    }
  }

  if (!Array.isArray(bundle.ants.types) || bundle.ants.types.length < 12) {
    throw new Error("ants.json must define at least 12 ant types");
  }

  if (!Array.isArray(bundle.rooms.roomTypes) || bundle.rooms.roomTypes.length < 20) {
    throw new Error("rooms.json must define at least 20 room types");
  }

  if (!Array.isArray(bundle.events.events) || bundle.events.events.length < 40) {
    throw new Error("events.json must define at least 40 events");
  }

  if (!Array.isArray(bundle.tech.techs) || bundle.tech.techs.length < 30) {
    throw new Error("tech.json must define at least 30 tech entries");
  }
}

export async function loadConfigBundle(basePath) {
  const bundle = {};

  await Promise.all(
    REQUIRED_CONFIGS.map(async (name) => {
      const url = `${basePath}/${name}.json`;
      bundle[name] = await readJson(url);
    })
  );

  validateBundle(bundle);
  return Object.freeze(bundle);
}
