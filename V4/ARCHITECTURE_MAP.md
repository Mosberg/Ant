# Ant Colony Manager V4 Architecture Map

This map is a quick onboarding reference for where each system lives.

## Entry + Boot

- [index.html](index.html): Browser entry, Phaser CDN, module entrypoint.
- [js/main.js](js/main.js): Phaser game config and scene registration.
- [js/scenes/BootScene.js](js/scenes/BootScene.js): Initializes settings + mobile support.
- [js/scenes/PreloadScene.js](js/scenes/PreloadScene.js): Startup handoff into main menu.

## Core Config + Utilities

- [js/core/constants.js](js/core/constants.js):
  - Global enums/types: `TILE`, `ROOM_KIND`, `ROLE`, `ENEMY_TYPE`
  - Tunable game configs: difficulty, balance, HUD, events
  - Defaults: `DEFAULT_SETTINGS`
  - Helpers: `clamp`, `distance`
- [js/core/mobileSupport.js](js/core/mobileSupport.js):
  - Touch/mobile detection
  - Safe-area viewport helpers
  - Pinch zoom helper
  - Mobile action bar helper

## Managers (Gameplay Systems)

- [js/managers/SettingsManager.js](js/managers/SettingsManager.js): Persistent settings with validation.
- [js/managers/SaveManager.js](js/managers/SaveManager.js): Local save/load helpers.
- [js/managers/AudioManager.js](js/managers/AudioManager.js): WebAudio SFX generation.
- [js/managers/GridPathfinder.js](js/managers/GridPathfinder.js): Tile BFS pathfinding.
- [js/managers/ResourceManager.js](js/managers/ResourceManager.js): Food/morale/population progression.
- [js/managers/RoomManager.js](js/managers/RoomManager.js): Room placement, upgrades, room bonuses.
- [js/managers/AntManager.js](js/managers/AntManager.js): Ant spawn/update/selection/role assignment.
- [js/managers/EnemyManager.js](js/managers/EnemyManager.js): Enemy wave timing + spawning.
- [js/managers/ColonyEventManager.js](js/managers/ColonyEventManager.js): Dynamic world events.

## Entities

- [js/entities/Room.js](js/entities/Room.js): Room data model.
- [js/entities/AntUnit.js](js/entities/AntUnit.js): Ant state machine + behaviors.
- [js/entities/EnemyUnit.js](js/entities/EnemyUnit.js): Enemy behaviors + combat logic.

## Scenes

- [js/scenes/MainMenuScene.js](js/scenes/MainMenuScene.js): Main menu, options, instructions.
- [js/scenes/GameScene.js](js/scenes/GameScene.js): Core simulation loop + world rendering.
- [js/scenes/UIScene.js](js/scenes/UIScene.js): HUD, controls, mobile action bar.
- [js/scenes/PauseScene.js](js/scenes/PauseScene.js): Pause overlay + resume/save/quit.

## High-Impact Extension Points

- Add ant roles: update [js/core/constants.js](js/core/constants.js), [js/entities/AntUnit.js](js/entities/AntUnit.js), and role UI in [js/scenes/UIScene.js](js/scenes/UIScene.js).
- Add room types: update [js/core/constants.js](js/core/constants.js), room effects in [js/managers/RoomManager.js](js/managers/RoomManager.js), and build controls in [js/scenes/UIScene.js](js/scenes/UIScene.js).
- Add events: extend [js/managers/ColonyEventManager.js](js/managers/ColonyEventManager.js).
- Rebalance gameplay: tweak `DIFFICULTY_SETTINGS`, `BALANCE_CONFIG`, and `EVENT_CONFIG` in [js/core/constants.js](js/core/constants.js).
- Add new settings/options: add defaults + validation in [js/managers/SettingsManager.js](js/managers/SettingsManager.js), then surface controls in [js/scenes/MainMenuScene.js](js/scenes/MainMenuScene.js).
