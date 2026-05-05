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
    this.ants = this.ants.filter((a) => !a.dead);
    for (const ant of this.ants) ant.update(dt);
    this.scene.resources.population = this.ants.length;
  }

  selectedAnts() {
    return this.ants.filter((a) => a.selected);
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
    return this.ants.filter((a) => a.role === role).length;
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

