class SaveManager {
  static saveGame(state) {
    try {
      localStorage.setItem("ant-colony-manager-save", JSON.stringify(state));
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

