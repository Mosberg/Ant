# V5 Ant Colony Manager

V5 is now a full browser-runnable ES module game implementation with config-driven systems.

## Run

Use a local static web server (recommended) and open `V5/index.html`.

Example with Python:

```bash
python -m http.server 8000
```

Then open:

`http://localhost:8000/V5/index.html`

## Architecture

- Entry files: `index.html`, `styles.css`, `main.js`
- Modules: `engine/`, `scenes/`, `entities/`, `ui/`
- Config JSON: `data/ants.json`, `data/rooms.json`, `data/resources.json`, `data/tech.json`, `data/events.json`, `data/settings.json`, `data/enemies.json`, `data/weather.json`

## Included Coverage

- 18 simulation systems, each with `init()`, `update(dt)`, `serialize()`, `deserialize()`, `reset()`
- 12 ant types with unlock logic and leveling/traits
- 20 room types with costs, build/upgrade timings, passive effects, active abilities, and synergy entries
- 10 resources with production/consumption/storage/decay/trade/unlock fields
- 10 enemy types with wave spawning and behavior profiles
- 30+ tech entries across biology/engineering/pheromones/combat/royal categories
- 40 events with trigger conditions, choices, and outcomes

## Controls

- `1/2/3/4`: tool mode (select/dig/build/pheromone)
- `Q/E`: previous or next room type
- `S/L`: save/load `slot1`
- `O`: toggle settings panel
- `F3`: toggle debug panel
- `M`: toggle pheromone heatmap
- `P` or `Esc`: pause menu
- `X`: deselect ant
- Middle mouse drag: pan camera
- Mouse wheel: zoom

## Assumptions

- Phaser is loaded as a browser ESM dependency from CDN.
- Assets are placeholder vector shapes drawn at runtime.
- Event choices auto-resolve after timeout if not manually handled.
- Save format is versioned through `settings.json -> saveLoad.version`.
