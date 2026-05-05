import { BaseSystem } from "../BaseSystem.js";
import { randomChoice } from "../utils.js";

export class EventSystem extends BaseSystem {
  constructor(engine, config) {
    super(engine, "events", config);
    this.cooldown = 0;
    this.activeEvents = [];
    this.eventLog = [];
  }

  init() {
    this.cooldown = Number(this.config.baseCooldownSeconds ?? 25);
    this.activeEvents = [];
    this.eventLog = [];
  }

  isEligible(eventDef) {
    const trigger = eventDef.trigger ?? {};
    const weather = this.engine.getSystem("weather");
    const ants = this.engine.getSystem("ants");
    const enemies = this.engine.getSystem("enemies");
    const resources = this.engine.getSystem("resources");

    if (trigger.minDay != null && (weather?.state?.dayCount ?? 0) < Number(trigger.minDay)) {
      return false;
    }

    if (trigger.weather && weather?.getCurrentWeather()?.id !== trigger.weather) {
      return false;
    }

    if (trigger.minAnts != null && ants.getAliveAnts().length < Number(trigger.minAnts)) {
      return false;
    }

    if (
      trigger.minEnemies != null &&
      enemies.getAliveEnemies().length < Number(trigger.minEnemies)
    ) {
      return false;
    }

    if (trigger.resource) {
      const value = resources.getValue(trigger.resource.id);
      if (value < Number(trigger.resource.min ?? 0)) {
        return false;
      }
    }

    return true;
  }

  applyOutcome(outcome) {
    const resources = this.engine.getSystem("resources");
    const enemies = this.engine.getSystem("enemies");
    const morale = this.engine.getSystem("morale");
    const weather = this.engine.getSystem("weather");
    const terrain = this.engine.getSystem("terrain");
    const tech = this.engine.getSystem("tech");

    if (outcome.resourceDelta) {
      resources.applyDelta(outcome.resourceDelta);
    }

    if (typeof outcome.moraleDelta === "number") {
      morale.addInstant(outcome.moraleDelta, outcome.label ?? "event");
    }

    if (outcome.spawnEnemy) {
      enemies.spawnEnemy(outcome.spawnEnemy);
    }

    if (Array.isArray(outcome.spawnEnemies)) {
      for (const enemyId of outcome.spawnEnemies) {
        enemies.spawnEnemy(enemyId);
      }
    }

    if (outcome.forceWeather) {
      weather.state.currentWeatherId = outcome.forceWeather;
      weather.state.weatherClock = 0;
    }

    if (outcome.techPoints) {
      tech.addResearchPoints(Number(outcome.techPoints));
    }

    if (outcome.digOrders && Array.isArray(outcome.digOrders)) {
      for (const order of outcome.digOrders) {
        terrain.queueDigOrder(order.x, order.y);
      }
    }
  }

  triggerEvent(eventDef, choiceId = null) {
    const selectedChoice = eventDef.choices?.find((choice) => choice.id === choiceId) ??
      eventDef.choices?.[0] ?? { id: "accept", outcome: eventDef.effects };

    const outcome = selectedChoice.outcome ?? eventDef.effects ?? {};
    this.applyOutcome(outcome);

    const logEntry = {
      time: this.engine.time,
      eventId: eventDef.id,
      name: eventDef.name,
      selectedChoice: selectedChoice.id,
      outcome
    };

    this.eventLog.push(logEntry);
    if (this.eventLog.length > 160) {
      this.eventLog.shift();
    }

    this.engine.events.emit("events:triggered", logEntry);
  }

  pickRandomEvent() {
    const eligible = (this.config.events ?? []).filter((eventDef) => this.isEligible(eventDef));
    if (eligible.length === 0) {
      return null;
    }

    const weighted = [];
    for (const eventDef of eligible) {
      const weight = Number(eventDef.weight ?? 1);
      for (let i = 0; i < Math.max(1, Math.floor(weight)); i += 1) {
        weighted.push(eventDef);
      }
    }

    return randomChoice(weighted, eligible[0]);
  }

  resolveEvent(eventId, choiceId) {
    const index = this.activeEvents.findIndex((eventDef) => eventDef.id === eventId);
    if (index < 0) {
      return false;
    }

    const [eventDef] = this.activeEvents.splice(index, 1);
    this.triggerEvent(eventDef, choiceId);
    return true;
  }

  update(dt) {
    this.cooldown -= dt;

    for (const pending of [...this.activeEvents]) {
      pending._ttl = Number(pending._ttl ?? 8) - dt;
      if (pending._ttl <= 0) {
        this.resolveEvent(pending.id, pending.choices?.[0]?.id);
      }
    }

    if (this.cooldown > 0) {
      return;
    }

    const difficulty = this.engine.getSystem("difficulty");
    const multiplier = Number(difficulty?.getMultiplier("eventIntensityMultiplier", 1) ?? 1);
    this.cooldown = Math.max(
      8,
      Number(this.config.baseCooldownSeconds ?? 25) / Math.max(0.3, multiplier)
    );

    const eventDef = this.pickRandomEvent();
    if (!eventDef) {
      return;
    }

    if (eventDef.requiresChoice) {
      this.activeEvents.push({ ...eventDef, _ttl: Number(eventDef.choiceTimeoutSeconds ?? 9) });
      this.engine.events.emit("events:pending", eventDef);
    } else {
      this.triggerEvent(eventDef);
    }
  }

  serialize() {
    return {
      cooldown: this.cooldown,
      activeEvents: this.activeEvents,
      eventLog: this.eventLog
    };
  }

  deserialize(state) {
    this.cooldown = Number(state.cooldown ?? this.cooldown);
    this.activeEvents = Array.isArray(state.activeEvents) ? [...state.activeEvents] : [];
    this.eventLog = Array.isArray(state.eventLog) ? [...state.eventLog] : [];
  }

  reset() {
    this.init();
  }
}
