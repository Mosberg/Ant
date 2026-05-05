export class BaseSystem {
  constructor(engine, key, config = {}) {
    this.engine = engine;
    this.key = key;
    this.config = config;
    this.enabled = true;
  }

  init() {}

  update(_dt) {}

  serialize() {
    return {};
  }

  deserialize(_state) {}

  reset() {}
}
