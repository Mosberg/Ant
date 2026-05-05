/* Ant Colony Manager
   ------------------------------------------------------------
   A complete browser-ready Phaser colony management prototype.

   Architecture:
   - BootScene: game boot and settings initialization
   - PreloadScene: generate placeholder graphics/audio helpers
   - MainMenuScene: title, options, help
   - GameScene: world, ants, rooms, resources, enemies
   - UIScene: HUD, controls, overlays
   - PauseScene: pause menu overlay

   Key extension points:
   - ANT_TYPES: add new ant roles here
   - ROOM_TYPES: add new room types/upgrades here
   - DIFFICULTY_SETTINGS: tweak pacing and challenge here
   - WaveManager.spawnWave(): add new enemy wave compositions here

   Note:
   - Uses procedural graphics and simple WebAudio tones so no external assets are needed.
   - This is intentionally modular and heavily commented for extension.
*/

const GAME_WIDTH = 1440;
const GAME_HEIGHT = 900;

const TILE_SIZE = 24;
const MAP_WIDTH = 52;
const MAP_HEIGHT = 34;
const SURFACE_ROWS = 8;
const UNDERGROUND_START = SURFACE_ROWS;

const TILE = {
    SURFACE: 0,
    DIRT: 1,
    TUNNEL: 2,
    ROCK: 3,
    ROOM: 4,
    ENTRANCE: 5
};

const ROOM_KIND = {
    QUEEN: "queen",
    BROOD: "brood",
    STORAGE: "storage",
    BARRACKS: "barracks",
    UTILITY: "utility"
};

const ROLE = {
    WORKER: "worker",
    SOLDIER: "soldier",
    NURSE: "nurse",
    SCOUT: "scout"
};

const ENEMY_TYPE = {
    SPIDER: "spider",
    BEETLE: "beetle"
};

const ANT_TYPES = {
    worker: {
        label: "Worker",
        color: 0x3b2f2f,
        health: 40,
        speed: 62,
        carry: 12,
        damage: 4,
        vision: 90
    },
    soldier: {
        label: "Soldier",
        color: 0x8d2f2f,
        health: 90,
        speed: 52,
        carry: 2,
        damage: 14,
        vision: 100
    },
    nurse: {
        label: "Nurse",
        color: 0x8058a5,
        health: 50,
        speed: 56,
        carry: 6,
        damage: 3,
        vision: 90
    },
    scout: {
        label: "Scout",
        color: 0x2c6f7a,
        health: 38,
        speed: 78,
        carry: 6,
        damage: 5,
        vision: 140
    }
};

/* How to add a new room type:
   1. Add a new key below.
   2. Give it cost, size, and upgrade levels.
   3. Update RoomManager.applyRoomBonuses() if it affects colony stats.
   4. Add a UI button in UIScene.createBuildButtons().
*/
const ROOM_TYPES = {
    brood: {
        label: "Brood",
        color: 0xd6c18a,
        cost: 35,
        maxLevel: 2,
        size: { w: 3, h: 2 },
        levels: {
            1: { popBonus: 6, hatchRate: 1.0 },
            2: { popBonus: 10, hatchRate: 1.6 }
        }
    },
    storage: {
        label: "Storage",
        color: 0x8f6a3b,
        cost: 30,
        maxLevel: 2,
        size: { w: 3, h: 2 },
        levels: {
            1: { foodCap: 120 },
            2: { foodCap: 220 }
        }
    },
    barracks: {
        label: "Barracks",
        color: 0xa04747,
        cost: 45,
        maxLevel: 2,
        size: { w: 3, h: 2 },
        levels: {
            1: { soldierPower: 1.1, soldierCap: 6 },
            2: { soldierPower: 1.25, soldierCap: 12 }
        }
    },
    utility: {
        label: "Utility",
        color: 0x5a7d44,
        cost: 50,
        maxLevel: 2,
        size: { w: 3, h: 2 },
        levels: {
            1: { moraleBonus: 6, unlockUtility: true },
            2: { moraleBonus: 12, techBoost: true }
        }
    }
};

/* Difficulty tuning lives here.
   To tweak progression:
   - enemyInterval lowers as difficulty rises
   - foodSpawnRate and moraleDrain shape economy pressure
*/
const DIFFICULTY_SETTINGS = {
    easy: {
        label: "Easy",
        enemyInterval: 32,
        foodSpawnRate: 1.3,
        startingFood: 110,
        moraleDrain: 0.2,
        waveScale: 0.9
    },
    normal: {
        label: "Normal",
        enemyInterval: 24,
        foodSpawnRate: 1.0,
        startingFood: 90,
        moraleDrain: 0.35,
        waveScale: 1.0
    },
    hard: {
        label: "Hard",
        enemyInterval: 18,
        foodSpawnRate: 0.85,
        startingFood: 72,
        moraleDrain: 0.55,
        waveScale: 1.2
    }
};

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function distance(a, b) {
    return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
}

class SettingsManager {
    constructor() {
        this.data = {
            musicVolume: 0.35,
            sfxVolume: 0.7,
            gameSpeed: 1,
            graphicsDetail: true,
            difficulty: "normal"
        };
        this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem("ant-colony-manager-settings");
            if (!raw) return;
            this.data = { ...this.data, ...JSON.parse(raw) };
        } catch (e) {
            console.warn("Settings load failed", e);
        }
    }

    save() {
        try {
            localStorage.setItem(
                "ant-colony-manager-settings",
                JSON.stringify(this.data)
            );
        } catch (e) {
            console.warn("Settings save failed", e);
        }
    }

    set(key, value) {
        this.data[key] = value;
        this.save();
    }

    get(key) {
        return this.data[key];
    }
}

class SaveManager {
    static saveGame(state) {
        try {
            localStorage.setItem(
                "ant-colony-manager-save",
                JSON.stringify(state)
            );
            return true;
        } catch (e) {
            console.warn("Save failed", e);
            return false;
        }
    }

    static loadGame() {
        try {
            const raw = localStorage.getItem("ant-colony-manager-save");
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn("Load failed", e);
            return null;
        }
    }

    static clear() {
        localStorage.removeItem("ant-colony-manager-save");
    }
}

class AudioManager {
    constructor(settings) {
        this.settings = settings;
        this.ctx = null;
    }

    ensure() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    tone(freq = 440, type = "sine", duration = 0.08, volume = 0.1) {
        try {
            this.ensure();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(
                volume * this.settings.get("sfxVolume"),
                this.ctx.currentTime
            );
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                this.ctx.currentTime + duration
            );
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Silent fallback for browser restrictions.
        }
    }

    click() {
        this.tone(520, "triangle", 0.06, 0.09);
    }
    build() {
        this.tone(320, "square", 0.18, 0.12);
    }
    dig() {
        this.tone(150, "sawtooth", 0.08, 0.07);
    }
    hit() {
        this.tone(110, "square", 0.05, 0.08);
    }
    collect() {
        this.tone(760, "sine", 0.1, 0.08);
    }
    hatch() {
        this.tone(600, "triangle", 0.16, 0.08);
    }
}

class GridPathfinder {
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

class ResourceManager {
    constructor(scene, difficultyKey) {
        const diff = DIFFICULTY_SETTINGS[difficultyKey];
        this.scene = scene;
        this.food = diff.startingFood;
        this.foodCap = 160;
        this.population = 5;
        this.populationCap = 12;
        this.morale = 100;
        this.totalFoodGathered = 0;
        this.timeSurvived = 0;
        this.unlocks = {
            utility: false,
            advancedRoles: true,
            bossWaveReady: false
        };
    }

    addFood(amount) {
        const before = this.food;
        this.food = clamp(this.food + amount, 0, this.foodCap);
        this.totalFoodGathered += Math.max(0, this.food - before);
    }

    spendFood(amount) {
        if (this.food < amount) return false;
        this.food -= amount;
        return true;
    }

    addMorale(v) {
        this.morale = clamp(this.morale + v, 0, 100);
    }

    update(dt) {
        this.timeSurvived += dt;
        const diff = DIFFICULTY_SETTINGS[this.scene.settings.get("difficulty")];
        this.morale = clamp(this.morale - diff.moraleDrain * dt * 0.16, 0, 100);

        if (this.totalFoodGathered >= 150) this.unlocks.utility = true;
        if (this.timeSurvived >= 180) this.unlocks.bossWaveReady = true;
    }
}

class Room {
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

class RoomManager {
    constructor(scene) {
        this.scene = scene;
        this.rooms = [];
        this.roomTileLookup = new Map();
    }

    createInitialRooms() {
        this.placeFixedRoom(ROOM_KIND.QUEEN, 23, 13, 4, 3, 1);
        this.placeFixedRoom(ROOM_KIND.BROOD, 18, 15, 3, 2, 1);
        this.placeFixedRoom(ROOM_KIND.STORAGE, 28, 15, 3, 2, 1);
        this.placeFixedRoom(ROOM_KIND.BARRACKS, 23, 18, 3, 2, 1);
        this.applyRoomBonuses();
    }

    placeFixedRoom(type, x, y, w, h, level = 1) {
        const tiles = [];
        for (let ty = y; ty < y + h; ty++) {
            for (let tx = x; tx < x + w; tx++) {
                this.scene.map[ty][tx] = TILE.ROOM;
                this.scene.roomTypeMap[ty][tx] = type;
                tiles.push({ x: tx, y: ty });
                this.roomTileLookup.set(`${tx},${ty}`, type);
            }
        }
        const room = new Room(type, tiles, level);
        this.rooms.push(room);
        return room;
    }

    canPlaceRoom(type, originTx, originTy) {
        const def = ROOM_TYPES[type];
        if (!def) return false;
        const { w, h } = def.size;

        for (let ty = originTy; ty < originTy + h; ty++) {
            for (let tx = originTx; tx < originTx + w; tx++) {
                if (!this.scene.inBounds(tx, ty)) return false;
                if (ty < UNDERGROUND_START) return false;
                if (this.scene.map[ty][tx] !== TILE.TUNNEL) return false;
            }
        }
        return true;
    }

    buildRoom(type, originTx, originTy) {
        const def = ROOM_TYPES[type];
        if (!def) return { ok: false, reason: "Unknown room type" };
        if (
            type === ROOM_KIND.UTILITY &&
            !this.scene.resources.unlocks.utility
        ) {
            return {
                ok: false,
                reason: "Utility room locked. Gather more food first."
            };
        }
        if (!this.canPlaceRoom(type, originTx, originTy)) {
            return {
                ok: false,
                reason: "Need a cleared underground tunnel area."
            };
        }
        if (!this.scene.resources.spendFood(def.cost)) {
            return { ok: false, reason: "Not enough food." };
        }

        const tiles = [];
        for (let ty = originTy; ty < originTy + def.size.h; ty++) {
            for (let tx = originTx; tx < originTx + def.size.w; tx++) {
                this.scene.map[ty][tx] = TILE.ROOM;
                this.scene.roomTypeMap[ty][tx] = type;
                tiles.push({ x: tx, y: ty });
                this.roomTileLookup.set(`${tx},${ty}`, type);
            }
        }

        const room = new Room(type, tiles, 1);
        room.progress = 0;
        this.rooms.push(room);
        this.scene.audio.build();
        this.scene.spawnBuildParticles(originTx, originTy);
        this.applyRoomBonuses();
        return { ok: true, room };
    }

    roomAt(tx, ty) {
        return this.rooms.find(r =>
            r.tiles.some(t => t.x === tx && t.y === ty)
        );
    }

    upgradeRoom(room) {
        const def = ROOM_TYPES[room.type];
        if (!def) return { ok: false, reason: "This room cannot be upgraded." };
        if (room.level >= def.maxLevel)
            return { ok: false, reason: "Already max level." };
        const cost = Math.ceil(def.cost * (1 + room.level * 0.75));
        if (!this.scene.resources.spendFood(cost)) {
            return { ok: false, reason: "Not enough food to upgrade." };
        }
        room.level += 1;
        room.maxHealth += 60;
        room.health = room.maxHealth;
        this.scene.audio.build();
        this.scene.spawnBuildParticles(room.tiles[0].x, room.tiles[0].y);
        this.applyRoomBonuses();
        return { ok: true };
    }

    applyRoomBonuses() {
        let foodCap = 160;
        let popCap = 12;
        let soldierPower = 1;
        let moraleBonus = 0;
        let soldierCap = 4;

        for (const room of this.rooms) {
            if (room.type === ROOM_KIND.STORAGE) {
                foodCap += ROOM_TYPES.storage.levels[room.level].foodCap;
            }
            if (room.type === ROOM_KIND.BROOD) {
                popCap += ROOM_TYPES.brood.levels[room.level].popBonus;
            }
            if (room.type === ROOM_KIND.BARRACKS) {
                soldierPower *=
                    ROOM_TYPES.barracks.levels[room.level].soldierPower;
                soldierCap += ROOM_TYPES.barracks.levels[room.level].soldierCap;
            }
            if (room.type === ROOM_KIND.UTILITY) {
                moraleBonus +=
                    ROOM_TYPES.utility.levels[room.level].moraleBonus;
            }
        }

        this.scene.resources.foodCap = foodCap;
        this.scene.resources.populationCap = popCap;
        this.scene.colonyModifiers.soldierPower = soldierPower;
        this.scene.colonyModifiers.moraleBonus = moraleBonus;
        this.scene.colonyModifiers.soldierCap = soldierCap;
    }

    getQueenRoom() {
        return this.rooms.find(r => r.type === ROOM_KIND.QUEEN);
    }

    broodRooms() {
        return this.rooms.filter(r => r.type === ROOM_KIND.BROOD);
    }
}

class AntUnit {
    constructor(scene, tx, ty, role = ROLE.WORKER) {
        this.scene = scene;
        this.role = role;
        this.def = ANT_TYPES[role];
        this.tx = tx;
        this.ty = ty;
        this.x = tx * TILE_SIZE + TILE_SIZE / 2;
        this.y = ty * TILE_SIZE + TILE_SIZE / 2;
        this.health = this.def.health;
        this.maxHealth = this.def.health;
        this.speed = this.def.speed;
        this.carry = this.def.carry;
        this.damage = this.def.damage;
        this.vision = this.def.vision;
        this.state = "idle";
        this.path = [];
        this.pathIndex = 0;
        this.target = null;
        this.carryingFood = 0;
        this.attackCooldown = 0;
        this.taskCooldown = 0;
        this.selected = false;
        this.moveTarget = null;

        this.sprite = scene.add.circle(this.x, this.y, 7, this.def.color, 1);
        this.sprite.setDepth(30);

        this.healthBarBg = scene.add
            .rectangle(this.x, this.y - 10, 16, 3, 0x000000, 0.6)
            .setDepth(31);
        this.healthBar = scene.add
            .rectangle(this.x - 8, this.y - 10, 16, 3, 0x6fe36f, 1)
            .setOrigin(0, 0.5)
            .setDepth(32);
        this.selectionRing = scene.add
            .circle(this.x, this.y, 10, 0xffffff, 0)
            .setStrokeStyle(1.5, 0xf7e8b0, 1)
            .setDepth(29);
        this.selectionRing.setVisible(false);
    }

    setRole(role) {
        this.role = role;
        this.def = ANT_TYPES[role];
        this.maxHealth = this.def.health;
        this.health = Math.min(this.health, this.maxHealth);
        this.speed = this.def.speed;
        this.carry = this.def.carry;
        this.damage = this.def.damage;
        this.vision = this.def.vision;
        this.sprite.fillColor = this.def.color;
        this.state = "idle";
        this.target = null;
        this.path = [];
    }

    getTilePos() {
        return {
            tx: Phaser.Math.Clamp(
                Math.floor(this.x / TILE_SIZE),
                0,
                MAP_WIDTH - 1
            ),
            ty: Phaser.Math.Clamp(
                Math.floor(this.y / TILE_SIZE),
                0,
                MAP_HEIGHT - 1
            )
        };
    }

    moveToTile(tx, ty) {
        const from = this.getTilePos();
        this.path = this.scene.pathfinder.findPath(from.tx, from.ty, tx, ty);
        this.pathIndex = 0;
        if (this.path.length > 1) this.state = "moving";
    }

    update(dt) {
        if (this.health <= 0) {
            this.destroy();
            return;
        }

        this.attackCooldown -= dt;
        this.taskCooldown -= dt;

        if (this.moveTarget) {
            this.moveToTile(this.moveTarget.tx, this.moveTarget.ty);
            this.moveTarget = null;
        }

        switch (this.state) {
            case "idle":
                this.findTask();
                break;
            case "moving":
                this.followPath(dt);
                break;
            case "foraging":
                this.doForage(dt);
                break;
            case "returning":
                this.returnFood(dt);
                break;
            case "fighting":
                this.doFight(dt);
                break;
            case "nursing":
                this.doNursing(dt);
                break;
            case "scouting":
                this.doScouting(dt);
                break;
            case "digging":
                this.doDig(dt);
                break;
        }

        this.selectionRing.setPosition(this.x, this.y);
        this.sprite.setPosition(this.x, this.y);
        this.healthBarBg.setPosition(this.x, this.y - 11);
        this.healthBar.setPosition(this.x - 8, this.y - 11);
        this.healthBar.width = 16 * (this.health / this.maxHealth);
        this.selectionRing.setVisible(this.selected);
        this.scene.revealAround(this, this.vision);
    }

    followPath(dt) {
        if (
            !this.path ||
            this.path.length <= 1 ||
            this.pathIndex >= this.path.length
        ) {
            this.state = "idle";
            return;
        }

        const node = this.path[this.pathIndex];
        const targetX = node.x * TILE_SIZE + TILE_SIZE / 2;
        const targetY = node.y * TILE_SIZE + TILE_SIZE / 2;

        const ang = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const move = this.speed * this.scene.getGameSpeed() * dt;
        this.x += Math.cos(ang) * move;
        this.y += Math.sin(ang) * move;

        this.sprite.scaleX =
            Math.cos(this.scene.time.now * 0.01) < 0 ? 0.95 : 1.05;
        this.sprite.scaleY =
            Math.sin(this.scene.time.now * 0.012) < 0 ? 0.95 : 1.05;

        if (
            Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY) < 4
        ) {
            this.tx = node.x;
            this.ty = node.y;
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.state = "idle";
            }
        }
    }

    findTask() {
        if (this.taskCooldown > 0) return;

        const threat = this.scene.enemyManager.findNearestEnemy(
            this.x,
            this.y,
            this.role === ROLE.SOLDIER ? 250 : 110
        );
        if (
            threat &&
            (this.role === ROLE.SOLDIER || this.role === ROLE.WORKER)
        ) {
            this.target = threat;
            this.state = "fighting";
            return;
        }

        if (this.role === ROLE.WORKER) {
            if (this.scene.pendingDigOrders.length > 0) {
                this.target = this.scene.pendingDigOrders.shift();
                this.moveToTile(this.target.tx, this.target.ty);
                this.state = "digging";
                return;
            }
            const food = this.scene.findNearestFood(this.x, this.y);
            if (food) {
                this.target = food;
                this.moveToTile(food.tx, food.ty);
                this.state = "foraging";
                return;
            }
        }

        if (this.role === ROLE.SOLDIER) {
            const entry = this.scene.entranceTile;
            const patrolX = entry.tx + Phaser.Math.Between(-3, 3);
            const patrolY = entry.ty + Phaser.Math.Between(-2, 3);
            this.moveToTile(
                clamp(patrolX, 0, MAP_WIDTH - 1),
                clamp(patrolY, 0, MAP_HEIGHT - 1)
            );
            this.taskCooldown = 1.5;
            return;
        }

        if (this.role === ROLE.NURSE) {
            const brood = Phaser.Utils.Array.GetRandom(
                this.scene.roomManager.broodRooms()
            );
            if (brood) {
                const c = brood.center();
                this.moveToTile(c.tx, c.ty);
                this.state = "nursing";
                return;
            }
        }

        if (this.role === ROLE.SCOUT) {
            this.state = "scouting";
            const tx = Phaser.Math.Between(1, MAP_WIDTH - 2);
            const ty = Phaser.Math.Between(1, SURFACE_ROWS + 6);
            if (this.scene.isWalkable(tx, ty)) this.moveToTile(tx, ty);
            return;
        }

        this.taskCooldown = 0.8;
    }

    doForage() {
        if (!this.target || !this.scene.foodSources.includes(this.target)) {
            this.state = "idle";
            this.target = null;
            return;
        }
        if (distance(this, this.target) < 10) {
            const amount = Math.min(this.carry, this.target.amount);
            this.carryingFood = amount;
            this.target.amount -= amount;
            this.scene.audio.collect();
            this.scene.spawnFoodParticles(this.target.x, this.target.y);
            if (this.target.amount <= 0)
                this.scene.removeFoodSource(this.target);
            const storage = this.scene.findBestDepositTile();
            this.moveToTile(storage.tx, storage.ty);
            this.state = "returning";
        }
    }

    returnFood() {
        const deposit = this.scene.findBestDepositTile();
        if (
            distance(this, {
                x: deposit.tx * TILE_SIZE + 12,
                y: deposit.ty * TILE_SIZE + 12
            }) < 14
        ) {
            this.scene.resources.addFood(this.carryingFood);
            this.carryingFood = 0;
            this.state = "idle";
        }
    }

    doFight(dt) {
        if (!this.target || this.target.health <= 0) {
            this.state = "idle";
            this.target = null;
            return;
        }

        const targetTile = this.target.getTilePos
            ? this.target.getTilePos()
            : { tx: this.target.tx, ty: this.target.ty };
        if (this.path.length === 0 || this.state !== "moving") {
            this.moveToTile(targetTile.tx, targetTile.ty);
        }
        this.followPath(dt);

        if (distance(this, this.target) < 18 && this.attackCooldown <= 0) {
            const dmg =
                this.damage *
                (this.role === ROLE.SOLDIER
                    ? this.scene.colonyModifiers.soldierPower
                    : 1);
            this.target.takeDamage(dmg);
            this.scene.audio.hit();
            this.scene.spawnCombatParticles(this.x, this.y);
            this.attackCooldown = 0.6;
        }
    }

    doNursing(dt) {
        const brood = this.scene.roomManager.broodRooms()[0];
        if (!brood) {
            this.state = "idle";
            return;
        }
        const c = brood.center();
        if (
            Phaser.Math.Distance.Between(
                this.x,
                this.y,
                c.tx * TILE_SIZE + 12,
                c.ty * TILE_SIZE + 12
            ) < 18
        ) {
            this.scene.broodProgress += 0.16 * dt;
            this.taskCooldown = 1.2;
        } else {
            this.moveToTile(c.tx, c.ty);
            this.followPath(dt);
        }
    }

    doScouting(dt) {
        if (!this.path || this.pathIndex >= this.path.length) {
            const tx = Phaser.Math.Between(1, MAP_WIDTH - 2);
            const ty = Phaser.Math.Between(1, SURFACE_ROWS + 10);
            if (this.scene.isWalkable(tx, ty)) this.moveToTile(tx, ty);
        } else {
            this.followPath(dt);
        }
    }

    doDig() {
        if (!this.target) {
            this.state = "idle";
            return;
        }
        const tileCenterX = this.target.tx * TILE_SIZE + TILE_SIZE / 2;
        const tileCenterY = this.target.ty * TILE_SIZE + TILE_SIZE / 2;
        if (
            Phaser.Math.Distance.Between(
                this.x,
                this.y,
                tileCenterX,
                tileCenterY
            ) < 14
        ) {
            if (this.scene.map[this.target.ty][this.target.tx] === TILE.DIRT) {
                this.scene.map[this.target.ty][this.target.tx] = TILE.TUNNEL;
                this.scene.audio.dig();
                this.scene.spawnDigParticles(this.target.tx, this.target.ty);
            }
            this.target = null;
            this.state = "idle";
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        this.health = Math.max(0, this.health);
    }

    destroy() {
        this.scene.onAntKilled(this);
        this.sprite.destroy();
        this.healthBar.destroy();
        this.healthBarBg.destroy();
        this.selectionRing.destroy();
        this.dead = true;
    }

    serialize() {
        return {
            role: this.role,
            x: this.x,
            y: this.y,
            health: this.health,
            carryingFood: this.carryingFood
        };
    }
}

class EnemyUnit {
    constructor(scene, tx, ty, type = ENEMY_TYPE.SPIDER) {
        this.scene = scene;
        this.type = type;
        this.tx = tx;
        this.ty = ty;
        this.x = tx * TILE_SIZE + TILE_SIZE / 2;
        this.y = ty * TILE_SIZE + TILE_SIZE / 2;
        this.speed = type === ENEMY_TYPE.SPIDER ? 40 : 28;
        this.health = type === ENEMY_TYPE.SPIDER ? 110 : 170;
        this.maxHealth = this.health;
        this.damage = type === ENEMY_TYPE.SPIDER ? 14 : 9;
        this.attackCooldown = 0;
        this.path = [];
        this.pathIndex = 0;

        const color = type === ENEMY_TYPE.SPIDER ? 0x1e1b1b : 0x5b4635;
        const radius = type === ENEMY_TYPE.SPIDER ? 11 : 13;
        this.sprite = scene.add
            .circle(this.x, this.y, radius, color, 1)
            .setDepth(35);
        this.sprite.setStrokeStyle(
            2,
            type === ENEMY_TYPE.SPIDER ? 0xcd5674 : 0xc7a36d,
            1
        );
        this.healthBarBg = scene.add
            .rectangle(this.x, this.y - 14, 20, 4, 0x000000, 0.7)
            .setDepth(36);
        this.healthBar = scene.add
            .rectangle(this.x - 10, this.y - 14, 20, 4, 0xde5a5a, 1)
            .setOrigin(0, 0.5)
            .setDepth(37);
    }

    getTilePos() {
        return {
            tx: Phaser.Math.Clamp(
                Math.floor(this.x / TILE_SIZE),
                0,
                MAP_WIDTH - 1
            ),
            ty: Phaser.Math.Clamp(
                Math.floor(this.y / TILE_SIZE),
                0,
                MAP_HEIGHT - 1
            )
        };
    }

    update(dt) {
        if (this.health <= 0) {
            this.destroy();
            return;
        }

        this.attackCooldown -= dt;

        const ant = this.scene.antManager.findNearestAnt(this.x, this.y, 42);
        if (ant && this.attackCooldown <= 0) {
            ant.takeDamage(this.damage);
            this.scene.audio.hit();
            this.scene.spawnCombatParticles(this.x, this.y);
            this.attackCooldown = 0.9;
            return;
        }

        if (this.type === ENEMY_TYPE.BEETLE) {
            const room = this.scene.findNearestRoomTarget(this.x, this.y);
            if (room) {
                const center = room.center();
                this.moveTowardTile(center.tx, center.ty, dt);
                const roomCenter = {
                    x: center.tx * TILE_SIZE + TILE_SIZE / 2,
                    y: center.ty * TILE_SIZE + TILE_SIZE / 2
                };
                if (
                    Phaser.Math.Distance.Between(
                        this.x,
                        this.y,
                        roomCenter.x,
                        roomCenter.y
                    ) < 16 &&
                    this.attackCooldown <= 0
                ) {
                    room.health -= this.damage;
                    this.attackCooldown = 1.2;
                    this.scene.spawnCombatParticles(this.x, this.y);
                    if (room.health <= 0 && room.type === ROOM_KIND.QUEEN) {
                        this.scene.triggerLose(
                            "The queen chamber was destroyed."
                        );
                    }
                }
            }
        } else {
            const queen = this.scene.roomManager.getQueenRoom();
            const center = queen.center();
            this.moveTowardTile(center.tx, center.ty, dt);
        }

        this.sprite.setPosition(this.x, this.y);
        this.healthBarBg.setPosition(this.x, this.y - 14);
        this.healthBar.setPosition(this.x - 10, this.y - 14);
        this.healthBar.width = 20 * (this.health / this.maxHealth);
    }

    moveTowardTile(tx, ty, dt) {
        const from = this.getTilePos();
        if (this.path.length === 0 || this.scene.time.now % 30 < 1) {
            this.path = this.scene.pathfinder.findPath(
                from.tx,
                from.ty,
                tx,
                ty
            );
            this.pathIndex = 0;
        }
        if (this.path.length <= 1 || this.pathIndex >= this.path.length) return;

        const node = this.path[this.pathIndex];
        const targetX = node.x * TILE_SIZE + TILE_SIZE / 2;
        const targetY = node.y * TILE_SIZE + TILE_SIZE / 2;
        const ang = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const move = this.speed * this.scene.getGameSpeed() * dt;
        this.x += Math.cos(ang) * move;
        this.y += Math.sin(ang) * move;

        if (
            Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY) < 5
        ) {
            this.pathIndex++;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
    }

    destroy() {
        this.sprite.destroy();
        this.healthBar.destroy();
        this.healthBarBg.destroy();
        this.dead = true;
        this.scene.enemyManager.onEnemyKilled(this);
    }
}

class AntManager {
    constructor(scene) {
        this.scene = scene;
        this.ants = [];
    }

    spawn(tx, ty, role = ROLE.WORKER) {
        if (this.ants.length >= this.scene.resources.populationCap) return null;
        const ant = new AntUnit(this.scene, tx, ty, role);
        this.ants.push(ant);
        this.scene.resources.population = this.ants.length;
        return ant;
    }

    update(dt) {
        this.ants = this.ants.filter(a => !a.dead);
        for (const ant of this.ants) ant.update(dt);
        this.scene.resources.population = this.ants.length;
    }

    selectedAnts() {
        return this.ants.filter(a => a.selected);
    }

    selectInRect(rect) {
        for (const ant of this.ants) {
            ant.selected = Phaser.Geom.Rectangle.Contains(rect, ant.x, ant.y);
        }
    }

    clearSelection() {
        for (const ant of this.ants) ant.selected = false;
    }

    assignRoleToSelection(role) {
        const selected = this.selectedAnts();
        if (selected.length === 0) return false;

        const currentSoldiers = this.countByRole(ROLE.SOLDIER);
        for (const ant of selected) {
            if (
                role === ROLE.SOLDIER &&
                ant.role !== ROLE.SOLDIER &&
                currentSoldiers >= this.scene.colonyModifiers.soldierCap
            ) {
                continue;
            }
            ant.setRole(role);
        }
        return true;
    }

    countByRole(role) {
        return this.ants.filter(a => a.role === role).length;
    }

    findNearestAnt(x, y, maxDist = 9999) {
        let best = null;
        let bestD = maxDist;
        for (const ant of this.ants) {
            const d = Phaser.Math.Distance.Between(x, y, ant.x, ant.y);
            if (d < bestD) {
                best = ant;
                bestD = d;
            }
        }
        return best;
    }
}

class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.wave = 0;
        this.waveTimer = 0;
    }

    update(dt) {
        this.enemies = this.enemies.filter(e => !e.dead);
        for (const enemy of this.enemies) enemy.update(dt);

        this.waveTimer += dt;
        const diff = DIFFICULTY_SETTINGS[this.scene.settings.get("difficulty")];
        const nextWaveIn = Math.max(8, diff.enemyInterval - this.wave * 0.8);

        if (this.waveTimer >= nextWaveIn) {
            this.waveTimer = 0;
            this.spawnWave();
        }
    }

    spawnEnemy(type, tx, ty) {
        const e = new EnemyUnit(this.scene, tx, ty, type);
        this.enemies.push(e);
    }

    spawnWave() {
        this.wave += 1;
        const diff = DIFFICULTY_SETTINGS[this.scene.settings.get("difficulty")];
        const scale = diff.waveScale;
        const spiders = Math.ceil((1 + this.wave * 0.6) * scale);
        const beetles =
            this.wave >= 2 ? Math.ceil(this.wave * 0.35 * scale) : 0;

        for (let i = 0; i < spiders; i++) {
            const tx = Phaser.Math.Between(2, MAP_WIDTH - 3);
            const ty = Phaser.Math.Between(1, 3);
            this.spawnEnemy(ENEMY_TYPE.SPIDER, tx, ty);
        }

        for (let i = 0; i < beetles; i++) {
            const tx = Phaser.Math.Between(2, MAP_WIDTH - 3);
            const ty = Phaser.Math.Between(1, 3);
            this.spawnEnemy(ENEMY_TYPE.BEETLE, tx, ty);
        }

        if (this.scene.resources.unlocks.bossWaveReady && this.wave === 8) {
            this.spawnEnemy(
                ENEMY_TYPE.BEETLE,
                Phaser.Math.Between(4, MAP_WIDTH - 4),
                1
            );
            this.spawnEnemy(
                ENEMY_TYPE.BEETLE,
                Phaser.Math.Between(4, MAP_WIDTH - 4),
                2
            );
            this.scene.announce("Boss wave incoming!");
        } else {
            this.scene.announce(`Enemy wave ${this.wave} approaching`);
        }
    }

    findNearestEnemy(x, y, maxDist = 9999) {
        let best = null;
        let bestD = maxDist;
        for (const enemy of this.enemies) {
            const d = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (d < bestD) {
                best = enemy;
                bestD = d;
            }
        }
        return best;
    }

    onEnemyKilled() {
        this.scene.resources.addMorale(1.2);
    }
}

class BootScene extends Phaser.Scene {
    constructor() {
        super("BootScene");
    }

    init() {
        this.registry.set("settings", new SettingsManager());
    }

    create() {
        this.scene.start("PreloadScene");
    }
}

class PreloadScene extends Phaser.Scene {
    constructor() {
        super("PreloadScene");
    }

    create() {
        this.scene.start("MainMenuScene");
    }
}

class MainMenuScene extends Phaser.Scene {
    constructor() {
        super("MainMenuScene");
    }

    create() {
        this.cameras.main.setBackgroundColor("#140f0b");

        const w = this.scale.width;
        const h = this.scale.height;

        this.add.rectangle(w / 2, h / 2, w, h, 0x1b1511, 1);
        this.add.circle(w * 0.2, h * 0.18, 140, 0x6a4426, 0.16);
        this.add.circle(w * 0.78, h * 0.28, 180, 0x442812, 0.15);
        this.add.circle(w * 0.52, h * 0.76, 220, 0x8c5a2d, 0.07);

        this.add
            .text(w / 2, 140, "Ant Colony Manager", {
                fontFamily: "Arial",
                fontSize: "46px",
                color: "#f5e5c8",
                fontStyle: "bold"
            })
            .setOrigin(0.5);

        this.add
            .text(w / 2, 195, "Dig. Forage. Defend. Endure.", {
                fontSize: "20px",
                color: "#ceb48b"
            })
            .setOrigin(0.5);

        this.createButton(w / 2, 310, 260, 56, "Start Game", () => {
            this.scene.start("GameScene");
            this.scene.launch("UIScene");
        });

        this.createButton(w / 2, 382, 260, 56, "Load Save", () => {
            const save = SaveManager.loadGame();
            this.scene.start("GameScene", { saveData: save });
            this.scene.launch("UIScene");
        });

        this.createButton(w / 2, 454, 260, 56, "Options", () =>
            this.openOptions()
        );
        this.createButton(w / 2, 526, 260, 56, "Instructions", () =>
            this.openHelp()
        );

        this.helpPanel = this.createPanel(w / 2, h / 2 + 50, 760, 380, false);
        this.helpText = this.add.text(
            this.helpPanel.x - 340,
            this.helpPanel.y - 150,
            `How to play

- Drag-select ants, then right-click to move them.
- Assign roles in the lower UI: workers, soldiers, nurses, scouts.
- Use Dig mode to carve tunnels through dirt.
- Use Build mode to place rooms in cleared underground tunnel areas.
- Workers gather food on the surface and return it to storage.
- Nurses speed brood growth. Soldiers defend against waves.
- Scouts reveal fog-of-war and discover resources.
- Lose if the queen chamber is destroyed or morale hits zero.
- Win by surviving long enough to beat the late colony assault.

Shortcuts:
P = Pause
1/2/3/4 = Set selected ants to Worker/Soldier/Nurse/Scout
B = Cycle build menu
H = Toggle help
F3 = Debug overlay
Space = 2x game speed`,
            {
                fontSize: "20px",
                color: "#f1e6d1",
                lineSpacing: 8,
                wordWrap: { width: 680 }
            }
        );
        this.helpText.setVisible(false);

        this.optionsPanel = this.createPanel(
            w / 2,
            h / 2 + 40,
            560,
            380,
            false
        );
        this.optionsWidgets = [];
        this.buildOptionsPanel();
        this.setOptionsVisible(false);
    }

    createButton(x, y, width, height, label, onClick) {
        const bg = this.add
            .rectangle(x, y, width, height, 0x3b2a1f, 1)
            .setStrokeStyle(2, 0xd88c36, 1)
            .setInteractive({ useHandCursor: true });

        const txt = this.add
            .text(x, y, label, {
                fontSize: "24px",
                color: "#fff2d9",
                fontStyle: "bold"
            })
            .setOrigin(0.5);

        bg.on("pointerover", () => bg.setFillStyle(0x513826));
        bg.on("pointerout", () => bg.setFillStyle(0x3b2a1f));
        bg.on("pointerdown", () => {
            window.__antAudio?.click();
            onClick();
        });

        return { bg, txt };
    }

    createPanel(x, y, w, h, visible = true) {
        const panel = this.add
            .rectangle(x, y, w, h, 0x241b15, 0.97)
            .setStrokeStyle(2, 0x7a5e44, 1);
        panel.setVisible(visible);
        return panel;
    }

    openHelp() {
        const nowVisible = !this.helpPanel.visible;
        this.helpPanel.setVisible(nowVisible);
        this.helpText.setVisible(nowVisible);
        this.setOptionsVisible(false);
    }

    openOptions() {
        this.setOptionsVisible(!this.optionsPanel.visible);
        this.helpPanel.setVisible(false);
        this.helpText.setVisible(false);
    }

    setOptionsVisible(v) {
        this.optionsPanel.setVisible(v);
        for (const item of this.optionsWidgets) item.setVisible(v);
    }

    buildOptionsPanel() {
        const settings = this.registry.get("settings");
        const x = this.optionsPanel.x - 200;
        let y = this.optionsPanel.y - 120;

        const title = this.add
            .text(this.optionsPanel.x, this.optionsPanel.y - 150, "Options", {
                fontSize: "28px",
                color: "#f6e6cb",
                fontStyle: "bold"
            })
            .setOrigin(0.5);

        const labels = [
            {
                key: "musicVolume",
                text: "Music Volume",
                type: "slider",
                min: 0,
                max: 1,
                step: 0.1
            },
            {
                key: "sfxVolume",
                text: "SFX Volume",
                type: "slider",
                min: 0,
                max: 1,
                step: 0.1
            },
            {
                key: "gameSpeed",
                text: "Game Speed",
                type: "choice",
                choices: [0.5, 1, 2]
            },
            {
                key: "graphicsDetail",
                text: "Graphics Detail",
                type: "choice",
                choices: [true, false]
            },
            {
                key: "difficulty",
                text: "Difficulty",
                type: "choice",
                choices: ["easy", "normal", "hard"]
            }
        ];

        this.optionsWidgets.push(title);

        labels.forEach(row => {
            const label = this.add.text(x, y, row.text, {
                fontSize: "22px",
                color: "#f3e4cf"
            });
            this.optionsWidgets.push(label);

            if (row.type === "choice") {
                let bx = x + 220;
                row.choices.forEach(choice => {
                    const chosen = settings.get(row.key) === choice;
                    const btn = this.add
                        .rectangle(
                            bx,
                            y + 14,
                            74,
                            34,
                            chosen ? 0xd88c36 : 0x4b392c,
                            1
                        )
                        .setStrokeStyle(1, 0x9d7a50, 1)
                        .setInteractive({ useHandCursor: true });
                    const text = this.add
                        .text(bx, y + 14, String(choice), {
                            fontSize: "16px",
                            color: "#fff7ea"
                        })
                        .setOrigin(0.5);
                    btn.on("pointerdown", () => {
                        settings.set(row.key, choice);
                        this.scene.restart();
                    });
                    this.optionsWidgets.push(btn, text);
                    bx += 92;
                });
            } else if (row.type === "slider") {
                const val = settings.get(row.key);
                for (let i = 0; i <= 10; i++) {
                    const slot = this.add
                        .rectangle(
                            x + 220 + i * 24,
                            y + 14,
                            18,
                            18,
                            i / 10 <= val ? 0xd88c36 : 0x564232,
                            1
                        )
                        .setStrokeStyle(1, 0x8c6b4a, 1)
                        .setInteractive({ useHandCursor: true });
                    slot.on("pointerdown", () => {
                        settings.set(row.key, i / 10);
                        this.scene.restart();
                    });
                    this.optionsWidgets.push(slot);
                }
            }

            y += 58;
        });

        this.optionsWidgets.forEach(item => item.setVisible(false));
    }
}

class PauseScene extends Phaser.Scene {
    constructor() {
        super("PauseScene");
    }

    create() {
        const w = this.scale.width;
        const h = this.scale.height;
        this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55);
        this.add
            .text(w / 2, h / 2 - 130, "Paused", {
                fontSize: "42px",
                color: "#fff0d8",
                fontStyle: "bold"
            })
            .setOrigin(0.5);

        this.createBtn(w / 2, h / 2 - 30, "Resume", () => this.resumeGame());
        this.createBtn(w / 2, h / 2 + 40, "Quit to Menu", () => {
            this.scene.stop("UIScene");
            this.scene.stop("GameScene");
            this.scene.start("MainMenuScene");
        });
    }

    createBtn(x, y, label, cb) {
        const bg = this.add
            .rectangle(x, y, 220, 52, 0x3b2a1f, 1)
            .setStrokeStyle(2, 0xd88c36, 1)
            .setInteractive({ useHandCursor: true });
        const txt = this.add
            .text(x, y, label, {
                fontSize: "24px",
                color: "#fff7ea"
            })
            .setOrigin(0.5);
        bg.on("pointerdown", cb);
        return { bg, txt };
    }

    resumeGame() {
        this.scene.stop();
        this.scene.resume("GameScene");
        this.scene.resume("UIScene");
    }
}

class UIScene extends Phaser.Scene {
    constructor() {
        super("UIScene");
    }

    create() {
        this.gameScene = this.scene.get("GameScene");
        this.selectedRole = ROLE.WORKER;
        this.selectedBuild = ROOM_KIND.BROOD;
        this.messageTimer = 0;

        const w = this.scale.width;

        this.topBar = this.add
            .rectangle(w / 2, 24, w, 48, 0x1e1712, 0.92)
            .setDepth(500);
        this.foodText = this.add
            .text(18, 10, "", {
                fontSize: "18px",
                color: "#f5ead6",
                fontStyle: "bold"
            })
            .setDepth(501);
        this.popText = this.add
            .text(220, 10, "", {
                fontSize: "18px",
                color: "#f5ead6",
                fontStyle: "bold"
            })
            .setDepth(501);
        this.moraleText = this.add
            .text(450, 10, "", {
                fontSize: "18px",
                color: "#f5ead6",
                fontStyle: "bold"
            })
            .setDepth(501);
        this.timeText = this.add
            .text(660, 10, "", {
                fontSize: "18px",
                color: "#f5ead6",
                fontStyle: "bold"
            })
            .setDepth(501);
        this.waveText = this.add
            .text(860, 10, "", {
                fontSize: "18px",
                color: "#f5ead6",
                fontStyle: "bold"
            })
            .setDepth(501);

        this.helpBox = this.add
            .rectangle(1110, 24, 620, 48, 0x33261d, 0.9)
            .setOrigin(0.5, 0.5)
            .setDepth(500);
        this.helpText = this.add
            .text(860, 10, "", { fontSize: "15px", color: "#dec8a3" })
            .setDepth(501);

        this.bottomPanel = this.add
            .rectangle(240, this.scale.height - 90, 470, 170, 0x1f1813, 0.94)
            .setStrokeStyle(2, 0x624d39, 1)
            .setDepth(500);

        this.roleLabel = this.add
            .text(26, this.scale.height - 162, "Assign Roles", {
                fontSize: "18px",
                color: "#f5ead6",
                fontStyle: "bold"
            })
            .setDepth(501);

        this.buildLabel = this.add
            .text(26, this.scale.height - 96, "Build Rooms", {
                fontSize: "18px",
                color: "#f5ead6",
                fontStyle: "bold"
            })
            .setDepth(501);

        this.debugText = this.add
            .text(this.scale.width - 250, 58, "", {
                fontSize: "14px",
                color: "#d8f2d0",
                backgroundColor: "#172012cc",
                padding: { x: 8, y: 6 }
            })
            .setDepth(520)
            .setVisible(false);

        this.messageText = this.add
            .text(this.scale.width / 2, 66, "", {
                fontSize: "20px",
                color: "#fff4d8",
                fontStyle: "bold",
                backgroundColor: "#3a2c18cc",
                padding: { x: 12, y: 6 }
            })
            .setOrigin(0.5, 0)
            .setDepth(510)
            .setVisible(false);

        this.createRoleButtons();
        this.createBuildButtons();
        this.createUtilityButtons();

        this.input.keyboard.on("keydown-H", () => this.toggleTutorial());
        this.input.keyboard.on("keydown-P", () => this.togglePause());
        this.input.keyboard.on("keydown-F3", () => this.toggleDebug());
        this.events.on("wake", () => this.syncRefs());
    }

    syncRefs() {
        this.gameScene = this.scene.get("GameScene");
    }

    createRoleButtons() {
        const roles = [ROLE.WORKER, ROLE.SOLDIER, ROLE.NURSE, ROLE.SCOUT];
        let x = 120;
        roles.forEach(role => {
            const btn = this.makeButton(
                x,
                this.scale.height - 130,
                86,
                36,
                ANT_TYPES[role].label,
                () => {
                    this.gameScene.assignRole(role);
                }
            );
            x += 100;
            btn.bg.setFillStyle(ANT_TYPES[role].color);
            btn.label.setColor("#fff7ea");
        });
    }

    createBuildButtons() {
        const rooms = [
            ROOM_KIND.BROOD,
            ROOM_KIND.STORAGE,
            ROOM_KIND.BARRACKS,
            ROOM_KIND.UTILITY
        ];
        let x = 120;
        rooms.forEach(room => {
            const btn = this.makeButton(
                x,
                this.scale.height - 66,
                86,
                36,
                ROOM_TYPES[room]?.label || "Utility",
                () => {
                    this.gameScene.setBuildMode(room);
                    this.flashMessage(
                        `Build mode: ${ROOM_TYPES[room]?.label || room}`
                    );
                }
            );
            x += 100;
            btn.bg.setFillStyle(ROOM_TYPES[room]?.color || 0x5a7d44);
            btn.label.setColor("#22170f");
        });
    }

    createUtilityButtons() {
        this.makeButton(
            this.scale.width - 300,
            this.scale.height - 74,
            90,
            40,
            "Pause",
            () => this.togglePause()
        );
        this.makeButton(
            this.scale.width - 200,
            this.scale.height - 74,
            90,
            40,
            "Save",
            () => {
                const ok = this.gameScene.saveCurrentGame();
                this.flashMessage(ok ? "Game saved." : "Save failed.");
            }
        );
        this.makeButton(
            this.scale.width - 100,
            this.scale.height - 74,
            90,
            40,
            "Help",
            () => this.toggleTutorial()
        );
    }

    makeButton(x, y, w, h, label, cb) {
        const bg = this.add
            .rectangle(x, y, w, h, 0x4b392c, 1)
            .setStrokeStyle(1, 0x8d6d46, 1)
            .setDepth(501)
            .setInteractive({ useHandCursor: true });
        const txt = this.add
            .text(x, y, label, {
                fontSize: "14px",
                color: "#fff6e6",
                fontStyle: "bold",
                align: "center"
            })
            .setOrigin(0.5)
            .setDepth(502);

        bg.on("pointerover", () => bg.setFillStyle(0x624832));
        bg.on("pointerout", () => bg.setFillStyle(0x4b392c));
        bg.on("pointerdown", cb);
        return { bg, label: txt };
    }

    togglePause() {
        if (this.scene.isActive("PauseScene")) {
            this.scene.stop("PauseScene");
            this.scene.resume("GameScene");
            this.scene.resume();
        } else {
            this.scene.pause("GameScene");
            this.scene.launch("PauseScene");
            this.scene.pause();
        }
    }

    toggleDebug() {
        this.gameScene.debugEnabled = !this.gameScene.debugEnabled;
        this.debugText.setVisible(this.gameScene.debugEnabled);
    }

    toggleTutorial() {
        this.gameScene.helpVisible = !this.gameScene.helpVisible;
    }

    flashMessage(msg) {
        this.messageText.setText(msg).setVisible(true);
        this.messageTimer = 2.5;
    }

    update(_, dtMs) {
        if (!this.gameScene || !this.gameScene.scene.isActive()) return;
        const g = this.gameScene;
        const dt = dtMs / 1000;

        this.foodText.setText(
            `Food: ${Math.floor(g.resources.food)} / ${g.resources.foodCap}`
        );
        this.popText.setText(
            `Population: ${g.antManager.ants.length} / ${g.resources.populationCap}`
        );
        this.moraleText.setText(`Morale: ${Math.floor(g.resources.morale)}`);
        this.timeText.setText(
            `Time: ${g.formatTime(g.resources.timeSurvived)}`
        );
        this.waveText.setText(`Wave: ${g.enemyManager.wave}`);

        this.helpText.setText(
            `Priority: ${g.globalPriority.toUpperCase()} | Build: ${(
                g.currentBuildMode || "none"
            ).toUpperCase()} | ` +
                `Drag-select ants, right-click to move, left-click dirt to dig/build`
        );

        if (g.debugEnabled) {
            const fps = Math.round(this.game.loop.actualFps);
            this.debugText.setText(
                `Workers: ${g.antManager.countByRole(ROLE.WORKER)}
` +
                    `Soldiers: ${g.antManager.countByRole(ROLE.SOLDIER)}
` +
                    `Nurses: ${g.antManager.countByRole(ROLE.NURSE)}
` +
                    `Scouts: ${g.antManager.countByRole(ROLE.SCOUT)}
` +
                    `Enemies: ${g.enemyManager.enemies.length}
` +
                    `Wave Timer: ${g.enemyManager.waveTimer.toFixed(1)}
` +
                    `FPS: ${fps}`
            );
        }

        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) this.messageText.setVisible(false);
        }

        if (g.uiMessage && g.uiMessageTime > 0) {
            this.flashMessage(g.uiMessage);
            g.uiMessageTime = 0;
        }
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }

    init(data) {
        this.saveData = data?.saveData || null;
    }

    create() {
        this.settings = this.registry.get("settings");
        this.audio = window.__antAudio = new AudioManager(this.settings);
        this.debugEnabled = false;
        this.helpVisible = true;
        this.globalPriority = "food";
        this.currentBuildMode = null;
        this.currentTool = "dig";
        this.pendingDigOrders = [];
        this.foodSources = [];
        this.roomTypeMap = Array.from({ length: MAP_HEIGHT }, () =>
            Array(MAP_WIDTH).fill(null)
        );
        this.colonyModifiers = {
            soldierPower: 1,
            moraleBonus: 0,
            soldierCap: 4
        };
        this.broodProgress = 0;
        this.unlockMilestones = new Set();
        this.uiMessage = "";
        this.uiMessageTime = 0;

        this.resources = new ResourceManager(
            this,
            this.settings.get("difficulty")
        );
        this.pathfinder = new GridPathfinder(this);

        this.generateMap();
        this.createVisualLayers();
        this.roomManager = new RoomManager(this);
        this.roomManager.createInitialRooms();

        this.antManager = new AntManager(this);
        this.enemyManager = new EnemyManager(this);

        this.entranceTile = { tx: 25, ty: 7 };
        this.map[this.entranceTile.ty][this.entranceTile.tx] = TILE.ENTRANCE;
        this.map[this.entranceTile.ty + 1][this.entranceTile.tx] = TILE.TUNNEL;
        this.map[this.entranceTile.ty + 2][this.entranceTile.tx] = TILE.TUNNEL;

        this.spawnStartingAnts();
        this.spawnInitialFood();

        this.selectionGraphics = this.add.graphics().setDepth(450);
        this.buildPreview = this.add.graphics().setDepth(451);
        this.helpOverlay = this.add.container(0, 0).setDepth(480);
        this.createHelpOverlay();

        this.input.mouse?.disableContextMenu();

        this.dragStart = null;
        this.isDragging = false;

        this.input.on("pointerdown", pointer =>
            this.handlePointerDown(pointer)
        );
        this.input.on("pointerup", pointer => this.handlePointerUp(pointer));
        this.input.on("pointermove", pointer =>
            this.handlePointerMove(pointer)
        );

        this.createKeyboardShortcuts();

        if (this.saveData) {
            this.restoreSave(this.saveData);
        }

        this.cameras.main.setBackgroundColor("#19120d");
        this.redrawWorld(true);
        this.announce("Colony founded.");
    }

    createKeyboardShortcuts() {
        this.input.keyboard.on("keydown-ONE", () =>
            this.assignRole(ROLE.WORKER)
        );
        this.input.keyboard.on("keydown-TWO", () =>
            this.assignRole(ROLE.SOLDIER)
        );
        this.input.keyboard.on("keydown-THREE", () =>
            this.assignRole(ROLE.NURSE)
        );
        this.input.keyboard.on("keydown-FOUR", () =>
            this.assignRole(ROLE.SCOUT)
        );

        this.input.keyboard.on("keydown-B", () => {
            const rooms = [
                ROOM_KIND.BROOD,
                ROOM_KIND.STORAGE,
                ROOM_KIND.BARRACKS,
                ROOM_KIND.UTILITY
            ];
            const idx = rooms.indexOf(this.currentBuildMode);
            this.currentBuildMode =
                rooms[(idx + 1 + rooms.length) % rooms.length];
            this.announce(`Build mode: ${this.currentBuildMode}`);
        });

        this.input.keyboard.on("keydown-SPACE", () => {
            const current = this.settings.get("gameSpeed");
            const next = current === 1 ? 2 : 1;
            this.settings.set("gameSpeed", next);
            this.announce(`Game speed set to ${next}x`);
        });

        this.input.keyboard.on("keydown-H", () => {
            this.helpVisible = !this.helpVisible;
        });

        this.input.keyboard.on("keydown-P", () => {
            this.scene.pause();
            this.scene.launch("PauseScene");
            this.scene.pause("UIScene");
        });

        this.input.keyboard.on("keydown-F", () => {
            this.globalPriority =
                this.globalPriority === "food" ? "defense" : "food";
            this.announce(`Priority: ${this.globalPriority}`);
        });
    }

    generateMap() {
        this.map = [];

        for (let y = 0; y < MAP_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (y < SURFACE_ROWS) {
                    row.push(TILE.SURFACE);
                } else {
                    const rockChance =
                        (y > 24 ? 0.16 : 0.08) +
                        (Math.abs(x - MAP_WIDTH / 2) > 18 ? 0.04 : 0);
                    row.push(
                        Math.random() < rockChance ? TILE.ROCK : TILE.DIRT
                    );
                }
            }
            this.map.push(row);
        }

        for (let x = 22; x <= 28; x++) {
            for (let y = 11; y <= 20; y++) {
                this.map[y][x] = TILE.TUNNEL;
            }
        }

        for (let x = 18; x <= 32; x++) {
            this.map[14][x] = TILE.TUNNEL;
            this.map[17][x] = TILE.TUNNEL;
        }

        for (let y = 7; y <= 13; y++) {
            this.map[y][25] = TILE.TUNNEL;
        }
    }

    createVisualLayers() {
        this.worldGfx = this.add.graphics();
        this.fogGfx = this.add.graphics().setDepth(400);
        this.effectGfx = this.add.graphics().setDepth(410);

        this.vision = Array.from({ length: MAP_HEIGHT }, () =>
            Array(MAP_WIDTH).fill(0)
        );
        this.discovered = Array.from({ length: MAP_HEIGHT }, () =>
            Array(MAP_WIDTH).fill(false)
        );
    }

    createHelpOverlay() {
        const box = this.add
            .rectangle(720, 440, 760, 300, 0x000000, 0.8)
            .setStrokeStyle(2, 0xb3844f, 1);
        const txt = this.add.text(
            390,
            310,
            `Tutorial

- Left-click dirt with Dig mode to queue tunnel digging.
- Clear tunnel space, then build underground rooms.
- Drag to select ants; right-click to order movement.
- Assign roles with the role buttons or number keys.
- Workers collect food, soldiers defend, nurses hatch faster, scouts reveal more.
- Survive escalating waves; if the queen dies or morale reaches zero, the colony falls.`,
            {
                fontSize: "22px",
                color: "#f5ead8",
                wordWrap: { width: 650 },
                lineSpacing: 8
            }
        );
        this.helpOverlay.add([box, txt]);
    }

    spawnStartingAnts() {
        const queenRoom = this.roomManager.getQueenRoom();
        const c = queenRoom.center();
        this.antManager.spawn(c.tx, c.ty, ROLE.WORKER);
        this.antManager.spawn(c.tx + 1, c.ty, ROLE.WORKER);
        this.antManager.spawn(c.tx - 1, c.ty, ROLE.WORKER);
        this.antManager.spawn(c.tx, c.ty + 1, ROLE.SOLDIER);
        this.antManager.spawn(c.tx, c.ty - 1, ROLE.NURSE);
    }

    spawnInitialFood() {
        for (let i = 0; i < 8; i++) this.spawnFoodSource();
    }

    spawnFoodSource() {
        const tx = Phaser.Math.Between(2, MAP_WIDTH - 3);
        const ty = Phaser.Math.Between(1, SURFACE_ROWS - 2);
        const amount = Phaser.Math.Between(18, 46);
        this.foodSources.push({
            tx,
            ty,
            x: tx * TILE_SIZE + TILE_SIZE / 2,
            y: ty * TILE_SIZE + TILE_SIZE / 2,
            amount
        });
    }

    removeFoodSource(food) {
        Phaser.Utils.Array.Remove(this.foodSources, food);
    }

    getGameSpeed() {
        return this.settings.get("gameSpeed") || 1;
    }

    inBounds(tx, ty) {
        return tx >= 0 && ty >= 0 && tx < MAP_WIDTH && ty < MAP_HEIGHT;
    }

    isWalkable(tx, ty) {
        if (!this.inBounds(tx, ty)) return false;
        const t = this.map[ty][tx];
        return (
            t === TILE.SURFACE ||
            t === TILE.TUNNEL ||
            t === TILE.ROOM ||
            t === TILE.ENTRANCE
        );
    }

    findNearestFood(x, y) {
        let best = null;
        let bestD = Number.MAX_VALUE;
        for (const food of this.foodSources) {
            const d = Phaser.Math.Distance.Between(x, y, food.x, food.y);
            if (d < bestD) {
                best = food;
                bestD = d;
            }
        }
        return best;
    }

    findBestDepositTile() {
        const storage = this.roomManager.rooms.find(
            r => r.type === ROOM_KIND.STORAGE
        );
        if (!storage) return this.roomManager.getQueenRoom().center();
        return storage.center();
    }

    findNearestRoomTarget(x, y) {
        let best = null;
        let bestD = Number.MAX_VALUE;
        for (const room of this.roomManager.rooms) {
            const c = room.center();
            const px = c.tx * TILE_SIZE + TILE_SIZE / 2;
            const py = c.ty * TILE_SIZE + TILE_SIZE / 2;
            const d = Phaser.Math.Distance.Between(x, y, px, py);
            if (d < bestD) {
                best = room;
                bestD = d;
            }
        }
        return best;
    }

    setBuildMode(roomType) {
        this.currentBuildMode = roomType;
        this.currentTool = "build";
    }

    assignRole(role) {
        const changed = this.antManager.assignRoleToSelection(role);
        if (changed) this.announce(`Assigned ${ANT_TYPES[role].label}`);
    }

    queueDig(tx, ty) {
        if (!this.inBounds(tx, ty)) return;
        if (this.map[ty][tx] !== TILE.DIRT) return;
        const already = this.pendingDigOrders.some(
            o => o.tx === tx && o.ty === ty
        );
        if (!already) {
            this.pendingDigOrders.push({ tx, ty });
            this.announce(`Dig queued at ${tx},${ty}`);
        }
    }

    handlePointerDown(pointer) {
        const tx = Math.floor(pointer.worldX / TILE_SIZE);
        const ty = Math.floor(pointer.worldY / TILE_SIZE);

        if (pointer.rightButtonDown()) return;

        if (pointer.y < 48) return;

        this.dragStart = { x: pointer.worldX, y: pointer.worldY };
        this.isDragging = true;

        if (this.currentTool === "dig" && this.map[ty]?.[tx] === TILE.DIRT) {
            this.queueDig(tx, ty);
        } else if (this.currentTool === "build" && this.currentBuildMode) {
            const room = this.roomManager.roomAt(tx, ty);
            if (room && room.type !== ROOM_KIND.QUEEN) {
                const result = this.roomManager.upgradeRoom(room);
                this.announce(
                    result.ok ? `${room.type} upgraded` : result.reason
                );
            } else {
                const result = this.roomManager.buildRoom(
                    this.currentBuildMode,
                    tx,
                    ty
                );
                this.announce(
                    result.ok
                        ? `${this.currentBuildMode} room placed`
                        : result.reason
                );
            }
        }
    }

    handlePointerMove(pointer) {
        if (!this.isDragging || !this.dragStart) return;
        this.selectionGraphics.clear();
        this.selectionGraphics.lineStyle(1, 0xf0e2a5, 1);
        this.selectionGraphics.fillStyle(0xf0e2a5, 0.08);
        const rect = new Phaser.Geom.Rectangle(
            Math.min(this.dragStart.x, pointer.worldX),
            Math.min(this.dragStart.y, pointer.worldY),
            Math.abs(pointer.worldX - this.dragStart.x),
            Math.abs(pointer.worldY - this.dragStart.y)
        );
        this.selectionGraphics.fillRectShape(rect);
        this.selectionGraphics.strokeRectShape(rect);

        this.drawBuildPreview(pointer.worldX, pointer.worldY);
    }

    handlePointerUp(pointer) {
        const tx = Math.floor(pointer.worldX / TILE_SIZE);
        const ty = Math.floor(pointer.worldY / TILE_SIZE);

        if (pointer.rightButtonReleased()) {
            const selected = this.antManager.selectedAnts();
            for (const ant of selected) {
                ant.moveTarget = { tx, ty };
            }
            return;
        }

        if (this.dragStart) {
            const rect = new Phaser.Geom.Rectangle(
                Math.min(this.dragStart.x, pointer.worldX),
                Math.min(this.dragStart.y, pointer.worldY),
                Math.abs(pointer.worldX - this.dragStart.x),
                Math.abs(pointer.worldY - this.dragStart.y)
            );
            if (rect.width > 4 || rect.height > 4) {
                this.antManager.selectInRect(rect);
            }
        }

        this.isDragging = false;
        this.dragStart = null;
        this.selectionGraphics.clear();
    }

    drawBuildPreview(worldX, worldY) {
        this.buildPreview.clear();
        if (this.currentTool !== "build" || !this.currentBuildMode) return;
        const def = ROOM_TYPES[this.currentBuildMode];
        if (!def) return;
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);
        const ok = this.roomManager.canPlaceRoom(this.currentBuildMode, tx, ty);
        this.buildPreview.lineStyle(2, ok ? 0x79d26d : 0xd96b6b, 1);
        this.buildPreview.fillStyle(ok ? 0x79d26d : 0xd96b6b, 0.18);
        this.buildPreview.fillRect(
            tx * TILE_SIZE,
            ty * TILE_SIZE,
            def.size.w * TILE_SIZE,
            def.size.h * TILE_SIZE
        );
        this.buildPreview.strokeRect(
            tx * TILE_SIZE,
            ty * TILE_SIZE,
            def.size.w * TILE_SIZE,
            def.size.h * TILE_SIZE
        );
    }

    revealAround(unit, radius) {
        const tileRadius = Math.ceil(radius / TILE_SIZE);
        const pos = unit.getTilePos
            ? unit.getTilePos()
            : { tx: unit.tx, ty: unit.ty };

        for (let y = pos.ty - tileRadius; y <= pos.ty + tileRadius; y++) {
            for (let x = pos.tx - tileRadius; x <= pos.tx + tileRadius; x++) {
                if (!this.inBounds(x, y)) continue;
                const dist = Phaser.Math.Distance.Between(x, y, pos.tx, pos.ty);
                if (dist <= tileRadius) {
                    this.vision[y][x] = Math.max(this.vision[y][x], 1);
                    this.discovered[y][x] = true;
                }
            }
        }
    }

    redrawWorld(force = false) {
        this.worldGfx.clear();
        this.worldGfx.fillStyle(0x17100c, 1);
        this.worldGfx.fillRect(
            0,
            0,
            MAP_WIDTH * TILE_SIZE,
            MAP_HEIGHT * TILE_SIZE
        );

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;
                let c = 0x000000;

                switch (this.map[y][x]) {
                    case TILE.SURFACE:
                        c = 0x5d8a3a;
                        break;
                    case TILE.DIRT:
                        c = 0x67462a;
                        break;
                    case TILE.TUNNEL:
                        c = 0x3d2b1d;
                        break;
                    case TILE.ROCK:
                        c = 0x4d4a49;
                        break;
                    case TILE.ROOM:
                        c = this.getRoomColor(this.roomTypeMap[y][x]);
                        break;
                    case TILE.ENTRANCE:
                        c = 0xc9b483;
                        break;
                }

                this.worldGfx.fillStyle(c, 1);
                this.worldGfx.fillRect(px, py, TILE_SIZE - 1, TILE_SIZE - 1);

                if (this.map[y][x] === TILE.SURFACE) {
                    this.worldGfx.fillStyle(0x7ab24c, 0.14);
                    this.worldGfx.fillRect(
                        px + 2,
                        py + 2,
                        TILE_SIZE - 6,
                        TILE_SIZE - 12
                    );
                }
            }
        }

        for (const food of this.foodSources) {
            this.worldGfx.fillStyle(0xa9d84c, 1);
            this.worldGfx.fillCircle(food.x, food.y, 7);
            this.worldGfx.fillStyle(0xdceb84, 1);
            this.worldGfx.fillCircle(food.x + 3, food.y - 2, 3);
        }

        if (force || this.settings.get("graphicsDetail")) {
            this.drawMinimap();
        }
    }

    drawMinimap() {
        if (this.minimapGfx) this.minimapGfx.destroy();
        this.minimapGfx = this.add.graphics().setDepth(500);
        const scale = 4;
        const width = MAP_WIDTH * scale;
        const height = MAP_HEIGHT * scale;
        const ox = this.scale.width - width - 18;
        const oy = 76;

        this.minimapGfx.fillStyle(0x150f0b, 0.9);
        this.minimapGfx.fillRoundedRect(
            ox - 8,
            oy - 8,
            width + 16,
            height + 16,
            8
        );
        this.minimapGfx.lineStyle(1, 0x8d704b, 1);
        this.minimapGfx.strokeRoundedRect(
            ox - 8,
            oy - 8,
            width + 16,
            height + 16,
            8
        );

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                let color = 0x000000;
                switch (this.map[y][x]) {
                    case TILE.SURFACE:
                        color = 0x5e8c3b;
                        break;
                    case TILE.DIRT:
                        color = 0x5b3e29;
                        break;
                    case TILE.TUNNEL:
                        color = 0x3a281b;
                        break;
                    case TILE.ROCK:
                        color = 0x515151;
                        break;
                    case TILE.ROOM:
                        color = this.getRoomColor(this.roomTypeMap[y][x]);
                        break;
                    case TILE.ENTRANCE:
                        color = 0xd8bf8a;
                        break;
                }
                this.minimapGfx.fillStyle(color, 1);
                this.minimapGfx.fillRect(
                    ox + x * scale,
                    oy + y * scale,
                    scale,
                    scale
                );
            }
        }

        for (const ant of this.antManager.ants) {
            const tp = ant.getTilePos();
            this.minimapGfx.fillStyle(0xf8edd0, 1);
            this.minimapGfx.fillRect(
                ox + tp.tx * scale,
                oy + tp.ty * scale,
                scale,
                scale
            );
        }

        for (const enemy of this.enemyManager.enemies) {
            const tp = enemy.getTilePos();
            this.minimapGfx.fillStyle(0xde5d5d, 1);
            this.minimapGfx.fillRect(
                ox + tp.tx * scale,
                oy + tp.ty * scale,
                scale,
                scale
            );
        }
    }

    getRoomColor(type) {
        switch (type) {
            case ROOM_KIND.QUEEN:
                return 0x9a6cc7;
            case ROOM_KIND.BROOD:
                return 0xd6c18a;
            case ROOM_KIND.STORAGE:
                return 0x8f6a3b;
            case ROOM_KIND.BARRACKS:
                return 0xa04747;
            case ROOM_KIND.UTILITY:
                return 0x5a7d44;
            default:
                return 0x6d533a;
        }
    }

    spawnDigParticles(tx, ty) {
        if (!this.settings.get("graphicsDetail")) return;
        const px = tx * TILE_SIZE + 12;
        const py = ty * TILE_SIZE + 12;
        for (let i = 0; i < 6; i++) {
            const p = this.add.circle(px, py, 2, 0xb27a4a, 1).setDepth(420);
            this.tweens.add({
                targets: p,
                x: px + Phaser.Math.Between(-12, 12),
                y: py + Phaser.Math.Between(-12, 12),
                alpha: 0,
                duration: 350,
                onComplete: () => p.destroy()
            });
        }
    }

    spawnBuildParticles(tx, ty) {
        if (!this.settings.get("graphicsDetail")) return;
        const px = tx * TILE_SIZE + 20;
        const py = ty * TILE_SIZE + 20;
        for (let i = 0; i < 8; i++) {
            const p = this.add.circle(px, py, 2, 0xd3c28e, 1).setDepth(420);
            this.tweens.add({
                targets: p,
                x: px + Phaser.Math.Between(-20, 20),
                y: py + Phaser.Math.Between(-16, 16),
                alpha: 0,
                scale: 0.2,
                duration: 450,
                onComplete: () => p.destroy()
            });
        }
    }

    spawnCombatParticles(x, y) {
        if (!this.settings.get("graphicsDetail")) return;
        for (let i = 0; i < 5; i++) {
            const p = this.add.circle(x, y, 2, 0xe06d6d, 1).setDepth(420);
            this.tweens.add({
                targets: p,
                x: x + Phaser.Math.Between(-12, 12),
                y: y + Phaser.Math.Between(-12, 12),
                alpha: 0,
                duration: 260,
                onComplete: () => p.destroy()
            });
        }
    }

    spawnFoodParticles(x, y) {
        if (!this.settings.get("graphicsDetail")) return;
        for (let i = 0; i < 5; i++) {
            const p = this.add.circle(x, y, 2, 0xc4ee61, 1).setDepth(420);
            this.tweens.add({
                targets: p,
                x: x + Phaser.Math.Between(-10, 10),
                y: y + Phaser.Math.Between(-10, 10),
                alpha: 0,
                duration: 300,
                onComplete: () => p.destroy()
            });
        }
    }

    onAntKilled(ant) {
        Phaser.Utils.Array.Remove(this.antManager.ants, ant);
        this.resources.population = this.antManager.ants.length;
        this.resources.addMorale(-5);
        this.announce(`${ANT_TYPES[ant.role].label} ant lost`);
    }

    restoreSave(save) {
        if (!save) return;

        if (save.settingsDifficulty)
            this.settings.set("difficulty", save.settingsDifficulty);

        if (save.resources) {
            Object.assign(this.resources, save.resources);
        }

        if (Array.isArray(save.map)) {
            this.map = save.map;
        }

        if (Array.isArray(save.roomTypeMap)) {
            this.roomTypeMap = save.roomTypeMap;
        }

        if (Array.isArray(save.rooms)) {
            this.roomManager.rooms = save.rooms.map(data => {
                const room = new Room(data.type, data.tiles, data.level);
                room.health = data.health;
                room.maxHealth = data.maxHealth;
                return room;
            });
            this.roomManager.applyRoomBonuses();
        }

        if (Array.isArray(save.foodSources)) {
            this.foodSources = save.foodSources;
        }

        this.antManager.ants.forEach(a => a.destroy());
        this.antManager.ants = [];
        if (Array.isArray(save.ants)) {
            save.ants.forEach(a => {
                const tx = Math.floor(a.x / TILE_SIZE);
                const ty = Math.floor(a.y / TILE_SIZE);
                const ant = this.antManager.spawn(tx, ty, a.role);
                if (ant) {
                    ant.x = a.x;
                    ant.y = a.y;
                    ant.health = a.health;
                    ant.carryingFood = a.carryingFood || 0;
                }
            });
        }

        if (save.enemyWave) this.enemyManager.wave = save.enemyWave;
        this.redrawWorld(true);
        this.announce("Save loaded.");
    }

    saveCurrentGame() {
        const state = {
            settingsDifficulty: this.settings.get("difficulty"),
            resources: this.resources,
            map: this.map,
            roomTypeMap: this.roomTypeMap,
            rooms: this.roomManager.rooms.map(r => ({
                type: r.type,
                tiles: r.tiles,
                level: r.level,
                health: r.health,
                maxHealth: r.maxHealth
            })),
            ants: this.antManager.ants.map(a => a.serialize()),
            foodSources: this.foodSources,
            enemyWave: this.enemyManager.wave
        };
        return SaveManager.saveGame(state);
    }

    announce(text) {
        this.uiMessage = text;
        this.uiMessageTime = 0.1;
    }

    formatTime(seconds) {
        const s = Math.floor(seconds);
        const m = Math.floor(s / 60);
        const rs = s % 60;
        return `${String(m).padStart(2, "0")}:${String(rs).padStart(2, "0")}`;
    }

    triggerLose(reason) {
        this.scene.pause();
        this.scene.pause("UIScene");
        this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.72
            )
            .setDepth(600);
        this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2 - 40,
                "Colony Lost",
                {
                    fontSize: "44px",
                    color: "#f0d7d7",
                    fontStyle: "bold"
                }
            )
            .setOrigin(0.5)
            .setDepth(601);
        this.add
            .text(this.scale.width / 2, this.scale.height / 2 + 20, reason, {
                fontSize: "24px",
                color: "#f2dfc4"
            })
            .setOrigin(0.5)
            .setDepth(601);
    }

    triggerWin() {
        this.scene.pause();
        this.scene.pause("UIScene");
        this.add
            .rectangle(
                this.scale.width / 2,
                this.scale.height / 2,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.72
            )
            .setDepth(600);
        this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2 - 40,
                "Colony Endures",
                {
                    fontSize: "44px",
                    color: "#e6f0cb",
                    fontStyle: "bold"
                }
            )
            .setOrigin(0.5)
            .setDepth(601);
        this.add
            .text(
                this.scale.width / 2,
                this.scale.height / 2 + 20,
                "You survived the final assault.",
                {
                    fontSize: "24px",
                    color: "#f2dfc4"
                }
            )
            .setOrigin(0.5)
            .setDepth(601);
    }

    updateFog() {
        this.fogGfx.clear();
        this.fogGfx.fillStyle(0x000000, 0.86);

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const visible = this.vision[y][x] > 0;
                const seen = this.discovered[y][x];
                if (!visible) {
                    const alpha = seen ? 0.42 : 0.88;
                    this.fogGfx.fillStyle(0x000000, alpha);
                    this.fogGfx.fillRect(
                        x * TILE_SIZE,
                        y * TILE_SIZE,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                }
            }
        }

        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                this.vision[y][x] = 0;
            }
        }
    }

    processBrood(dt) {
        const broodBonus = this.roomManager.broodRooms().reduce((sum, room) => {
            return sum + (ROOM_TYPES.brood.levels[room.level]?.hatchRate || 0);
        }, 0);

        this.broodProgress += dt * 0.02 * broodBonus;

        if (
            this.broodProgress >= 1 &&
            this.antManager.ants.length < this.resources.populationCap
        ) {
            this.broodProgress = 0;
            const queen = this.roomManager.getQueenRoom().center();
            this.antManager.spawn(queen.tx, queen.ty, ROLE.WORKER);
            this.resources.addMorale(2);
            this.audio.hatch();
            this.announce("A new ant has hatched");
        }
    }

    handleProgression() {
        if (
            this.resources.totalFoodGathered >= 150 &&
            !this.unlockMilestones.has("utility")
        ) {
            this.unlockMilestones.add("utility");
            this.resources.unlocks.utility = true;
            this.announce("Utility room unlocked");
        }

        if (
            this.resources.timeSurvived >= 300 &&
            !this.unlockMilestones.has("final")
        ) {
            this.unlockMilestones.add("final");
            this.resources.unlocks.bossWaveReady = true;
            this.announce("Late colony assault expected");
        }

        if (this.resources.timeSurvived >= 420 && this.enemyManager.wave >= 8) {
            this.triggerWin();
        }
    }

    update(_, dtMs) {
        const dt = (dtMs / 1000) * this.getGameSpeed();

        this.resources.update(dt);
        this.processBrood(dt);
        this.antManager.update(dt);
        this.enemyManager.update(dt);

        if (
            Math.random() <
            0.004 *
                DIFFICULTY_SETTINGS[this.settings.get("difficulty")]
                    .foodSpawnRate
        ) {
            if (this.foodSources.length < 16) this.spawnFoodSource();
        }

        if (this.resources.morale <= 0) {
            this.triggerLose("Colony morale collapsed.");
        }

        const queen = this.roomManager.getQueenRoom();
        if (!queen || queen.health <= 0) {
            this.triggerLose("The queen has died.");
        }

        this.handleProgression();
        this.redrawWorld();
        this.updateFog();
        this.helpOverlay.setVisible(this.helpVisible);
    }
}

// Mobile integration - add this to the end of your main.js, before the config
class BootScene extends Phaser.Scene {
    constructor() {
        super("BootScene");
    }

    init() {
        this.registry.set("settings", new SettingsManager());
    }

    create() {
        // Mobile support integration
        const mobileSupport = window.mobileSupport;
        if (mobileSupport) {
            MobileSupport.attachSceneHelpers(this);
            this.isMobile = MobileSupport.isMobileDevice();
        }

        this.scene.start("PreloadScene");
    }
}

// Add mobile action bar to UIScene create() method
// Insert this after the existing UI creation in UIScene.create():
/*
if (this.isMobileDevice) {
  const mobileButtons = [
    { label: "Dig", onClick: () => this.gameScene.currentTool = 'dig' },
    { label: "Build", onClick: () => this.gameScene.currentTool = 'build' },
    { label: "Pause", onClick: () => this.togglePause() }
  ];
  this.mobileBar = this.createMobileActionBar(mobileButtons);
}
*/

// Update config to support mobile input
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: "game-root",
    backgroundColor: "#15110d",
    scene: [
        BootScene,
        PreloadScene,
        MainMenuScene,
        GameScene,
        UIScene,
        PauseScene
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT
    },
    input: {
        activePointers: 4, // Support multi-touch
        mouse: true,
        touch: true,
        gamepad: false
    },
    dom: {
        createContainer: true
    }
};

new Phaser.Game(config);
