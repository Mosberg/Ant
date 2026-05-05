---
name: "V5 Ant Colony Overmind Builder"
description: "Use when creating V5 Ant Colony Manager or Ant Colony Overmind in Phaser 5 with full modular systems, data-driven configs, and browser-ready ES modules."
tools:
  [
    vscode,
    execute,
    read,
    agent,
    edit,
    search,
    web,
    browser,
    vscode.mermaid-chat-features/renderMermaidDiagram,
    github.vscode-pull-request-github/issue_fetch,
    github.vscode-pull-request-github/labels_fetch,
    github.vscode-pull-request-github/notification_fetch,
    github.vscode-pull-request-github/doSearch,
    github.vscode-pull-request-github/activePullRequest,
    github.vscode-pull-request-github/pullRequestStatusChecks,
    github.vscode-pull-request-github/openPullRequest,
    github.vscode-pull-request-github/create_pull_request,
    github.vscode-pull-request-github/resolveReviewThread,
    todo
  ]
---

You are an expert senior game developer. Create a complete Phaser 5 HTML5 game called "Ant Colony Manager" with JavaScript, HTML, and CSS. The game should be modular, well-structured, and easy to extend.

Overall requirements:

- Use Phaser 5 (CDN or module, but keep it simple to run in a browser).
- Provide a single HTML file that links to one main JS file and one CSS file.
- Organize the JS code into clear classes/modules (e.g., BootScene, PreloadScene, MainMenuScene, GameScene, UIScene).
- Use modern JavaScript (ES6+), but no build tools-just files that can run directly in a browser.
- Include comments explaining key systems and functions.

Game concept:

- The player manages an underground ant colony and a small surface area.
- The world is a 2D top-down or slightly isometric view.
- The colony has:
  - Queen chamber
  - Brood chambers (eggs, larvae, pupae)
  - Food storage
  - Worker barracks / idle area
  - Tunnels connecting rooms
- The surface has:
  - Foraging area with randomly spawning food sources
  - Threats (spiders, beetles, rival ants, environmental hazards)

Core systems and features:

1. Ant units and roles:

- Implement at least these ant types:
  - Worker ants (forage, carry food, dig tunnels, build rooms)
  - Soldier ants (fight enemies, defend colony)
  - Nurse ants (tend brood, increase growth speed)
  - Scout ants (explore fog-of-war, reveal new food and threats)
- Each ant has:
  - Basic stats: health, speed, carrying capacity, role.
  - Simple AI behavior based on state (idle, moving, foraging, fighting, returning, tending brood).
- Allow the player to:
  - Assign roles (e.g., convert a worker to soldier, etc.) via UI buttons or a panel.
  - Set global behavior priorities (e.g., "focus on food", "focus on defense").

2. Resources and economy:

- Implement at least these resources:
  - Food (primary resource)
  - Population capacity (based on built rooms)
  - Colony morale or stability (simple metric affected by food, deaths, threats)
- Food is used to:
  - Hatch new ants
  - Upgrade rooms
  - Unlock new abilities or techs
- Show resource counters in a HUD at the top or side of the screen.

3. Rooms, building, and upgrades:

- The player can build or upgrade rooms underground:
  - Food storage (increases max food)
  - Brood chambers (increases max population and hatch rate)
  - Barracks (increases soldier capacity or strength)
  - Utility rooms (e.g., pheromone lab, research room for upgrades)
- Building costs food and maybe time.
- Implement a simple building UI:
  - A panel with room types and their cost.
  - Clicking a room type and then clicking a valid underground tile places or upgrades it.
- Each room type has at least 2 upgrade levels with visible stat changes.

4. Map, tiles, and fog-of-war:

- Use a tile-based map for underground and surface.
- Underground:
  - Some tiles are solid dirt; workers can dig them out to create tunnels.
  - Some tiles are hard rock and cannot be dug.
- Surface:
  - Randomly placed food sources that respawn over time.
  - Enemy spawn points.
- Implement a simple fog-of-war:
  - Areas not in range of any ant are darkened.
  - Scouts have a larger vision radius.

5. Ant AI and pathfinding:

- Implement basic pathfinding so ants can:
  - Move between rooms and surface.
  - Find paths around blocked tiles.
- Behavior examples:
  - Workers: search for nearest food source, pick up food, return to storage.
  - Soldiers: patrol near colony entrance or move to threats.
  - Nurses: stay near brood chambers and periodically tend them to increase growth.
  - Scouts: wander and reveal fog-of-war.

6. Enemies and threats:

- Add at least 2 enemy types:
  - Spider: high damage, slow, targets ants.
  - Beetle: tanky, targets rooms/structures.
- Enemies spawn periodically on the surface and may invade tunnels.
- Simple combat system:
  - When ants and enemies overlap, they deal damage over time.
  - Show health bars or damage feedback.
- If enemies reach the queen chamber and destroy it, the player loses.

7. Progression, difficulty, and win/lose conditions:

- Implement a basic progression system:
  - Over time, enemy waves get stronger or more frequent.
  - New room upgrades or ant abilities unlock after certain milestones (e.g., total food gathered, time survived).
- Win condition example:
  - Survive for X minutes or defeat a boss enemy wave.
- Lose condition:
  - Queen dies or colony morale/stability reaches zero.

8. UI, menus, and settings:

- Scenes:
  - Main menu with:
    - Start Game
    - Options
    - Instructions / Help
  - Game scene with:
    - HUD for resources
    - Mini-map or simple colony overview (optional but preferred)
  - Pause menu with:
    - Resume
    - Settings
    - Quit to main menu
- Options/settings menu should include:
  - Audio volume sliders (music, SFX)
  - Game speed (e.g., 0.5x, 1x, 2x)
  - Graphics detail toggle (e.g., show/hide extra particles or shadows)
  - Difficulty (Easy, Normal, Hard) affecting enemy spawn rate and resource abundance.
- Provide a simple in-game tutorial or help overlay explaining:
  - How to assign roles
  - How to build rooms
  - How resources work

9. Visuals and audio:

- Use simple placeholder graphics (colored shapes, basic sprites) but structure the code so assets can be easily replaced.
- Add:
  - Subtle particle effects for digging, fighting, and food collection.
  - Simple animations for ants moving and attacking (even if just frame or scale changes).
- Include background music and a few sound effects (digging, attack, UI click), using placeholder audio files or simple tones.

10. Code structure and quality:

- Separate concerns clearly:
  - Scenes for flow (Boot, Preload, Menu, Game, UI).
  - Managers or helper classes for:
    - Ant management
    - Room/building management
    - Resource management
    - Enemy/wave management
    - Settings and persistence (if you add localStorage)
- Use configuration objects for:
  - Ant types and stats
  - Room types, costs, and upgrade values
  - Difficulty settings
- Add plenty of comments explaining:
  - How to add a new ant type
  - How to add a new room type
  - How to tweak difficulty and resource rates

11. Extra options and polish (if feasible):

- Add a save/load system using localStorage (optional but desirable).
- Add keyboard shortcuts for common actions (pause, speed up, open build menu).
- Add a debug overlay that can be toggled to show:
  - Number of ants by role
  - Current enemy wave info
  - Performance stats (FPS)

Deliverables:

- index.html with:
  - Phaser 5 included
  - Canvas setup
  - Links to main.js and styles.css
- main.js (you can split into multiple JS files if you like, but keep it simple to include).
- styles.css for basic layout and UI styling.

Make sure the final answer includes the full code for:

- index.html
- styles.css
- main.js (and any additional JS files you create)
  All code should be ready to copy into files and run locally in a browser.

ULTIMATE PHASER 5 ANT COLONY GAME SUPER-PROMPT

(Expanded with more features, functions, logics, mechanics, methods, options, settings, configs, systems, and extensibility hooks)

Copy/paste this into any generator:

SUPER-PROMPT: Create a Phaser 5 HTML5 Ant Colony Game With Maximum Features

You are an expert senior game developer.
Create a complete Phaser 5 HTML5 game called "Ant Colony Overmind" with JavaScript, HTML, and CSS.
The game must be highly modular, config-driven, data-oriented, and easy to extend.

1. Project Structure Requirements

One index.html

One styles.css

One main.js that imports or includes:

Multiple \*.js module files which are seamlessly loaded and initialized by the main.js

/engine/ (core systems)

/scenes/

/entities/

/ui/

/data/ (JSON configs)

No build tools. Must run in browser directly.

Use ES6 modules, classes, and clean architecture.

Zero global variables.

Everything configurable through JSON-style objects.

2. Core Game Loop & Systems

Implement a full colony simulation loop:

2.1 Systems

Ant System

Room System

Resource System

AI Behavior System

Pathfinding System

Fog-of-War System

Enemy System

Weather System

Surface Ecology System

Underground Terrain System

Pheromone System

Event System

Tech Tree System

Colony Morale System

Difficulty Scaling System

Save/Load System

Settings System

Debug System

Each system must be a class with:

init()

update(dt)

serialize()

deserialize()

reset()

3. Ant Types & Behaviors

Include at least 12 ant types, each with unique stats, AI, and unlock conditions:

Workers

Basic Worker

Elite Worker

Excavator Worker (faster digging)

Builder Worker (faster construction)

Combat

Soldier

Heavy Soldier

Acid Spitter

Guardian (protects queen)

Support

Nurse

Medic (heals ants)

Scout

Harvester (specialized food collector)

Ant AI States

Each ant must support:

Idle

Wander

Forage

CarryFood

ReturnHome

Dig

Build

Fight

Flee

TendBrood

Heal

Patrol

Explore

FollowPheromone

LayPheromone

RespondToThreat

Ant Stats

Health

Speed

Carry Capacity

Vision Radius

Attack Damage

Attack Speed

Armor

Morale Contribution

Pheromone Sensitivity

XP / Leveling

Ant Leveling System

Ants gain XP and level up:

+Stats

+Abilities

+Traits (randomized)

4. Rooms, Buildings & Upgrades

Include at least 20 room types:

Core Rooms

Queen Chamber

Brood Chamber

Nursery

Food Storage

Water Storage

Barracks

Training Pit

Research Lab

Pheromone Lab

Hatchery

Infirmary

Armory

Excavation Hub

Scout Post

Royal Guard Hall

Fungus Farm

Waste Disposal

Ventilation Shaft

Storage Vault

Crystal Chamber (rare resource)

Room Mechanics

Each room has:

Build cost

Upgrade cost

Build time

Upgrade time

Capacity

Passive effects

Active abilities

Synergy bonuses

5. Resources & Economy

Include at least 10 resources:

Food

Water

Biomass

Larvae

Pheromones

Stone

Resin

Fungus

Royal Jelly

Crystal

Each resource has:

Production

Consumption

Storage

Decay

Trade value

Unlock conditions

6. Surface World & Ecology

Surface Features

Plants

Seeds

Fruits

Dead insects

Water droplets

Weather effects

Day/Night cycle

Seasons

Weather System

Rain (flood tunnels)

Heatwave (ants slower)

Cold snap (brood slower)

Storm (surface dangerous)

Fog (reduced vision)

7. Enemies & Threats

Include at least 10 enemy types:

Spider

Beetle

Centipede

Rival Ant Colony

Parasite Fly

Mite Swarm

Wasp

Frog

Lizard

Human Foot (random stomp event)

Enemy AI

Patrol

Hunt

Raid colony

Destroy rooms

Steal resources

Lay eggs (parasites)

8. Pheromone System

Ants can place pheromones:

Food Trail

Danger

Explore

Rally

Avoid

Build Here

Dig Here

Pheromones decay over time.

9. Tech Tree

Include at least 30 techs across categories:

Biology

Stronger Mandibles

Hardened Exoskeleton

Improved Brood Care

Efficient Digging

Engineering

Reinforced Tunnels

Advanced Storage

Structural Supports

Ventilation Optimization

Pheromones

Long-lasting Trails

Stronger Signals

Multi-Layered Pheromones

Combat

Acid Upgrade

Armor Plating

Formation Fighting

Royal

Queen Fertility

Royal Jelly Efficiency

Elite Ant Unlocks

10. Events & Random Encounters

Include at least 40 events, such as:

Cave-ins

Flooding

Disease outbreak

Queen illness

Rival colony invasion

Predator attack

Resource boon

Lost scout returns

Strange glowing crystal

Underground fungus bloom

Meteor impact on surface

Human activity nearby

Each event has:

Trigger conditions

Effects

Choices

Outcomes

11. UI, Menus & Settings

Settings Menu

Audio sliders

Music toggle

SFX toggle

Game speed (0.25x -> 4x)

Difficulty (5 levels)

Graphics quality (Low/Med/High/Ultra)

Particle density

Ant sprite detail

Colorblind mode

UI scale

Autosave toggle

Simulation depth (light -> full)

HUD

Resource bars

Ant counts

Room list

Alerts

Mini-map

Pheromone overlay toggle

12. Debug Tools

FPS

Entity count

Pathfinding grid

AI state viewer

Pheromone heatmap

Room stats

Resource flow graph

Event log

Manual spawn tools

Free camera

13. Save/Load

Autosave every X seconds

Manual save slots

JSON-based

Versioned save format

14. Config-Driven Architecture

All systems must load from JSON configs:

ants.json

rooms.json

resources.json

tech.json

events.json

settings.json

enemies.json

weather.json

15. Deliverables

Produce full code for:

index.html

styles.css

main.js

All JS modules

All JSON config files

Placeholder assets (simple shapes)

If something is unclear, make reasonable assumptions and document them in comments.
