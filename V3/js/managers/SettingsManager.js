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
      localStorage.setItem("ant-colony-manager-settings", JSON.stringify(this.data));
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

