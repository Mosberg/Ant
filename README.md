# Ant Colony Manager

A browser-ready HTML5 colony management game built with Phaser, centered on running an underground ant nest and a small above-ground foraging zone.

The project is designed to stay easy to read, easy to extend, and easy to run locally without build tools. It uses a single `index.html`, one `main.js`, and one `styles.css`, with scene-based game flow and manager-style gameplay systems.[file:1]

## Features

- Scene-based structure with `BootScene`, `PreloadScene`, `MainMenuScene`, `GameScene`, `UIScene`, and `PauseScene`.
- Four ant roles: Worker, Soldier, Nurse, and Scout.
- Underground colony management with queen chamber, brood support, storage, barracks, tunnels, and utility progression.
- Surface foraging with random food spawns and invading threats.
- Room construction and upgrades with food costs.
- Tile-based digging, simple fog-of-war, and basic grid pathfinding.
- Enemy wave progression with spiders and beetles.
- HUD, help overlay, pause menu, options, shortcuts, debug overlay, and save/load support via `localStorage`.

## File Structure

```text
.
├── index.html
├── styles.css
└── main.js
```

### index.html

Loads the Phaser browser build, mounts the game into the page, and links the stylesheet and main JavaScript entry point.

### styles.css

Provides the earthy visual shell around the Phaser canvas and basic page-level styling.

### main.js

Contains the full game implementation, including scenes, game entities, managers, configuration objects, procedural visuals, and simple synthesized audio helpers.

## Requirements

- A modern desktop browser such as Chrome, Edge, or Firefox.
- A local web server is recommended for best results, although simple setups may also run by opening the HTML directly in a browser.

## Running the Game

### Option 1: Open directly

1. Put `index.html`, `styles.css`, and `main.js` in the same folder.
2. Double-click `index.html`.

### Option 2: Use a local server

Using a local server avoids browser restrictions and is the safer option.

#### Python

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

#### VS Code Live Server

1. Open the folder in VS Code.
2. Start Live Server on `index.html`.
3. Open the local URL in the browser.

## How to Play

The goal is to grow and protect the colony long enough to survive escalating enemy pressure.

### Core loop

1. Send workers to gather food from the surface.
2. Dig tunnels and expand underground space.
3. Build and upgrade rooms to improve capacity and colony bonuses.
4. Reassign ants into combat, support, or exploration roles as threats increase.
5. Hold off enemy waves while maintaining food, morale, and population.

### Controls

- Left click: issue dig/build interactions, depending on the active tool.
- Drag left mouse: select ants.
- Right click: move selected ants.
- `1`: assign selected ants to Worker.
- `2`: assign selected ants to Soldier.
- `3`: assign selected ants to Nurse.
- `4`: assign selected ants to Scout.
- `B`: cycle build mode.
- `F`: toggle colony priority between food and defense.
- `H`: toggle help overlay.
- `P`: pause the game.
- `Space`: toggle game speed.
- `F3`: toggle debug overlay.

## Gameplay Systems

### Ant roles

#### Worker

Workers forage for food, carry resources, dig tunnels, and support expansion.

#### Soldier

Soldiers patrol, intercept threats, and gain the most value from barracks upgrades and soldier modifiers.

#### Nurse

Nurses stay near brood chambers and increase hatch progress.

#### Scout

Scouts move quickly and reveal more of the map through larger vision radius.

### Resources

- **Food**: Used for building, upgrading, and sustaining colony growth.
- **Population capacity**: Increased primarily by brood chambers and colony expansion.
- **Morale**: Drops under pressure and losses; if it reaches zero, the colony collapses.

### Rooms

The code currently supports these room types:

| Room | Purpose |
|------|---------|
| Queen Chamber | Core survival room; losing it ends the game. |
| Brood Chamber | Increases population capacity and hatch efficiency. |
| Food Storage | Raises food capacity. |
| Barracks | Improves military scaling and soldier capacity. |
| Utility Room | Adds colony bonuses and progression unlocks. |

### Enemies

| Enemy | Behavior |
|-------|----------|
| Spider | Faster, more aggressive anti-ant threat. |
| Beetle | Slower, tankier attacker that pressures colony rooms. |

## Architecture

The game is organized around Phaser scenes plus focused gameplay classes.

### Scenes

- `BootScene`: initializes persistent settings.
- `PreloadScene`: lightweight startup scene.
- `MainMenuScene`: start, load, options, and instructions.
- `GameScene`: main simulation, world state, and core update loop.
- `UIScene`: HUD, build buttons, role assignment buttons, and overlays.
- `PauseScene`: pause-state overlay menu.

### Core managers and classes

- `SettingsManager`: option storage and retrieval.
- `SaveManager`: save/load helpers using `localStorage`.
- `AudioManager`: generated tone-based placeholder sound effects.
- `GridPathfinder`: simple tile BFS pathfinding.
- `ResourceManager`: food, morale, population, unlocks, and progression counters.
- `RoomManager`: room placement, upgrades, and room-derived colony bonuses.
- `AntManager`: spawning, selection, updates, and role reassignment.
- `EnemyManager`: wave timing, spawning, and threat tracking.
- `AntUnit` and `EnemyUnit`: per-entity gameplay logic.

## Extending the Game

The project is intentionally driven by top-level configuration objects and small, readable classes.

### Add a new ant type

1. Add a new entry to `ANT_TYPES` in `main.js`.
2. Give it stats such as `health`, `speed`, `carry`, `damage`, and `vision`.
3. Update role assignment UI in `UIScene`.
4. Add role-specific behavior inside `AntUnit.findTask()` and related state handlers.

### Add a new room type

1. Add a new entry to `ROOM_TYPES`.
2. Define `label`, `cost`, `size`, `maxLevel`, and `levels` data.
3. Update build UI creation in `UIScene.createBuildButtons()`.
4. Apply the room's gameplay effect in `RoomManager.applyRoomBonuses()`.
5. Optionally add custom visuals in `GameScene.getRoomColor()`.

### Tweak difficulty

Edit `DIFFICULTY_SETTINGS` to adjust:

- Starting food.
- Enemy interval.
- Food spawn rate.
- Morale drain.
- Wave scale.

### Improve AI or pathfinding

The current pathfinding uses a simple breadth-first tile search and role state machine. That makes it approachable for upgrades such as:

- Better target scoring.
- Threat weighting.
- Smarter tunnel routing.
- Job reservation systems.
- A* pathfinding.

## Save Data

The project includes basic save/load support through `localStorage`.

Saved state can include:

- Resources.
- Room data.
- Ant roster and role state basics.
- Food sources.
- Wave progression.
- Difficulty context.

If the game is embedded in a restricted environment, `localStorage` may be unavailable and save/load may fail silently.

## Placeholder Art and Audio

No external game assets are required.

- Visuals are drawn with Phaser shapes and simple graphics routines.
- Effects such as digging, combat, and food pickup use lightweight particles.
- Audio feedback uses generated Web Audio tones.

This makes the project fast to prototype and easy to replace later with real sprites, animation sheets, and sound assets.

## Known Limitations

This version is a strong prototype foundation, but not a full production RTS. Current limitations include:

- Simple pathfinding and ant decision-making.
- Lightweight combat resolution.
- Basic room construction footprint rules.
- Minimal animation set.
- Placeholder audio instead of authored sound design.
- Save/load that focuses on practical state rather than every transient runtime detail.

## Suggested Next Steps

Good expansion paths for the project include:

- Replacing shape graphics with sprite sheets and animation states.
- Upgrading pathfinding to A* with dynamic costs.
- Adding pheromone trails, jobs, and task reservation.
- Expanding tech progression and colony upgrades.
- Adding biome variations, rival ant factions, and boss encounters.
- Splitting `main.js` into separate ES modules such as `scenes/`, `managers/`, `entities/`, and `config/`.

## Credits

Built as a Phaser-based HTML5 game prototype and structured from a scene-and-manager architecture suited for direct browser execution and future expansion.[file:1]
