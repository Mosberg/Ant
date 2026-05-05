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

    this.healthBarBg = scene.add.rectangle(this.x, this.y - 10, 16, 3, 0x000000, 0.6).setDepth(31);
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
      tx: Phaser.Math.Clamp(Math.floor(this.x / TILE_SIZE), 0, MAP_WIDTH - 1),
      ty: Phaser.Math.Clamp(Math.floor(this.y / TILE_SIZE), 0, MAP_HEIGHT - 1)
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
    if (!this.path || this.path.length <= 1 || this.pathIndex >= this.path.length) {
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

    this.sprite.scaleX = Math.cos(this.scene.time.now * 0.01) < 0 ? 0.95 : 1.05;
    this.sprite.scaleY = Math.sin(this.scene.time.now * 0.012) < 0 ? 0.95 : 1.05;

    if (Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY) < 4) {
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
    if (threat && (this.role === ROLE.SOLDIER || this.role === ROLE.WORKER)) {
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
      this.moveToTile(clamp(patrolX, 0, MAP_WIDTH - 1), clamp(patrolY, 0, MAP_HEIGHT - 1));
      this.taskCooldown = 1.5;
      return;
    }

    if (this.role === ROLE.NURSE) {
      const brood = Phaser.Utils.Array.GetRandom(this.scene.roomManager.broodRooms());
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
      if (this.target.amount <= 0) this.scene.removeFoodSource(this.target);
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
        this.damage * (this.role === ROLE.SOLDIER ? this.scene.colonyModifiers.soldierPower : 1);
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
      Phaser.Math.Distance.Between(this.x, this.y, c.tx * TILE_SIZE + 12, c.ty * TILE_SIZE + 12) <
      18
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
    if (Phaser.Math.Distance.Between(this.x, this.y, tileCenterX, tileCenterY) < 14) {
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

