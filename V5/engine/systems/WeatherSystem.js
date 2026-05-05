import { BaseSystem } from "../BaseSystem.js";
import { weightedChoice } from "../utils.js";

export class WeatherSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "weather", config);
    this.state = {
      seasonIndex: 0,
      currentWeatherId: "clear",
      dayClock: 0,
      weatherClock: 0,
      dayCount: 0,
      isDay: true
    };
  }

  init() {
    this.pickNextWeather(true);
  }

  getCurrentSeason() {
    const seasons = this.config.seasons ?? [];
    return seasons[this.state.seasonIndex % Math.max(1, seasons.length)] ?? { id: "neutral" };
  }

  getCurrentWeather() {
    const weatherTypes = this.config.weatherTypes ?? [];
    return (
      weatherTypes.find((item) => item.id === this.state.currentWeatherId) ??
      weatherTypes[0] ?? { id: "clear", effects: {} }
    );
  }

  pickNextWeather(force = false) {
    const season = this.getCurrentSeason();
    const seasonWeights = this.config.seasonWeatherWeights?.[season.id] ?? {};
    const weatherTypes = this.config.weatherTypes ?? [];

    const weighted = weatherTypes.map((weather) => ({
      value: weather,
      weight: Number(seasonWeights[weather.id] ?? weather.weight ?? 1)
    }));

    const selected = weightedChoice(weighted, { value: weatherTypes[0] })?.value;
    if (!selected) {
      return;
    }

    if (!force && selected.id === this.state.currentWeatherId && weatherTypes.length > 1) {
      const alternative = weatherTypes.find((entry) => entry.id !== this.state.currentWeatherId);
      this.state.currentWeatherId = alternative?.id ?? selected.id;
    } else {
      this.state.currentWeatherId = selected.id;
    }

    this.engine.events.emit("weather:changed", {
      weather: this.getCurrentWeather(),
      season
    });
  }

  update(dt) {
    const dayDuration = Number(this.config.dayNight?.dayDuration ?? 180);
    const nightDuration = Number(this.config.dayNight?.nightDuration ?? 120);
    const seasonLengthDays = Number(this.config.seasonLengthDays ?? 5);

    this.state.dayClock += dt;
    this.state.weatherClock += dt;

    const activeDayLength = this.state.isDay ? dayDuration : nightDuration;
    if (this.state.dayClock >= activeDayLength) {
      this.state.dayClock = 0;
      this.state.isDay = !this.state.isDay;

      if (this.state.isDay) {
        this.state.dayCount += 1;
        if (this.state.dayCount > 0 && this.state.dayCount % seasonLengthDays === 0) {
          const count = (this.config.seasons ?? []).length || 1;
          this.state.seasonIndex = (this.state.seasonIndex + 1) % count;
          this.engine.events.emit("weather:seasonChanged", this.getCurrentSeason());
        }
      }
    }

    const currentWeather = this.getCurrentWeather();
    const minDuration = Number(currentWeather.minDuration ?? 35);
    const maxDuration = Number(currentWeather.maxDuration ?? 90);
    const weatherDuration = (minDuration + maxDuration) * 0.5;

    if (this.state.weatherClock >= weatherDuration) {
      this.state.weatherClock = 0;
      this.pickNextWeather(false);
    }
  }

  getModifier(key, fallback = 1) {
    const weather = this.getCurrentWeather();
    const modifiers = weather.effects ?? {};
    if (key in modifiers) {
      return Number(modifiers[key]);
    }
    return fallback;
  }

  serialize() {
    return { ...this.state };
  }

  deserialize(state) {
    this.state = {
      ...this.state,
      ...state
    };
  }

  reset() {
    this.state = {
      seasonIndex: 0,
      currentWeatherId: "clear",
      dayClock: 0,
      weatherClock: 0,
      dayCount: 0,
      isDay: true
    };
    this.pickNextWeather(true);
  }
}
