export class AudioManager {
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
      gain.gain.setValueAtTime(volume * this.settings.get("sfxVolume"), this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
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
